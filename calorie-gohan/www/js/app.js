// カロリーごはん帳 本体
(function () {
  const S = window.Store;
  const $view = document.getElementById('view');
  const $file = document.getElementById('photoInput');
  const state = { screen: 'home', p: {} };

  // ───────── 小道具 ─────────
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const n0 = (v) => Math.round(v).toLocaleString('ja-JP');
  const n1 = (v) => (Math.round(v * 10) / 10).toFixed(1);
  const set = () => S.d.settings;
  const back = (to = 'home') => `<button class="back no-print" data-go="${to}">← もどる</button>`;

  function mealsOf(date) { return S.d.meals.filter((m) => m.date === date); }
  function sum(list, k) { return list.reduce((a, m) => a + (m[k] || 0), 0); }
  function latestWeight() {
    const w = [...S.d.weights].sort((a, b) => (a.date < b.date ? -1 : 1));
    return w.length ? w[w.length - 1].kg : null;
  }
  function bmi() {
    const w = latestWeight(), h = set().height / 100;
    return w && h ? w / (h * h) : null;
  }
  function autoGoal() {
    const h = set().height / 100;
    const std = 22 * h * h; // 標準体重
    return Math.max(1200, Math.min(2600, Math.round((std * 27) / 50) * 50));
  }
  function slotByTime(d = new Date()) {
    const h = d.getHours();
    if (h >= 4 && h < 10) return '朝ごはん';
    if (h >= 10 && h < 15) return '昼ごはん';
    if (h >= 17 || h < 4) return '夜ごはん';
    return '間食';
  }
  const SLOTS = ['朝ごはん', '昼ごはん', '夜ごはん', '間食'];

  function streak() {
    const days = new Set(S.d.meals.map((m) => m.date));
    let d = Day.key();
    if (!days.has(d)) d = Day.add(d, -1);
    let n = 0;
    while (days.has(d)) { n++; d = Day.add(d, -1); }
    return n;
  }

  // ───────── お腹の具合 ─────────
  // 食べた時刻（「朝ごはん」をお昼に入力した時などは、ふつうの食事時間とみなす）
  const SLOT_TIME = { '朝ごはん': [7, 30], '昼ごはん': [12, 30], '夜ごはん': [19, 0] };
  function mealTime(m) {
    const [y, mo, d] = m.date.split('-').map(Number);
    const [hh, mm] = (m.time || '12:00').split(':').map(Number);
    const rec = new Date(y, mo - 1, d, hh, mm);
    const st = SLOT_TIME[m.slot];
    if (st) {
      const std = new Date(y, mo - 1, d, st[0], st[1]);
      // 記録が食事時間より2時間以上あと → あとからまとめて入力したとみなす
      if (rec - std > 2 * 3600e3) return std;
    }
    return rec;
  }

  // 満腹度（0=からっぽ、1=ふつうの1食を食べた直後、2以上=食べすぎ）
  // 1食ぶん＝1日の目標の3分の1。食べた量が多いほど長く続き、時間とともに減っていく。
  function fullness(now = new Date()) {
    const one = set().goalKcal / 3;
    const since = Day.add(Day.key(now), -1);
    let f = 0, lastAt = null;
    for (const m of S.d.meals) {
      if (m.date < since) continue;
      const t = mealTime(m);
      const hrs = (now - t) / 3600e3;
      if (hrs < 0) continue;
      const amount = (m.kcal || 0) / one;
      const lasts = 2 + 2.5 * Math.min(amount, 2); // 何時間でお腹がすくか（1食ぶんで約4.5時間）
      f += amount * Math.max(0, 1 - hrs / lasts);
      if (!lastAt || t > lastAt) lastAt = t;
    }
    return { f, hoursSince: lastAt ? (now - lastAt) / 3600e3 : null };
  }

  // キャラの気分
  //   weak=痩せすぎ / full=お腹パンパン / hungry=お腹がグ〜 / peckish=少しすいてきた
  //   happy=ニコニコ（食べた直後・ちょうど良い）/ slim=体重が減った / normal=ふつう
  function mood() {
    const b = bmi();
    if (b && b < 18.5) return 'weak';
    const now = new Date(), h = now.getHours();
    const eaten = sum(mealsOf(Day.key()), 'kcal');
    const goal = set().goalKcal;
    const { f, hoursSince } = fullness(now);
    if (eaten > goal * 1.1) return 'full';          // 今日は食べすぎ
    if (f >= 1.8) return 'full';                    // 1回にたくさん食べた直後
    if (f >= 0.7) return 'happy';                   // 食べてまだ間もない
    const night = h >= 22 || h < 5;
    if (eaten >= goal * 0.85) return f < 0.25 && !night && hoursSince >= 3 ? 'normal' : 'happy'; // 今日はもう十分食べた
    // 足りない日：夜になっても目標の6割に届かない
    if (h >= 19 && !night && eaten < goal * 0.6 && f < 0.5) return 'hungry';
    // 前の食事から時間がたって、お腹がからっぽ（夜中は寝ているのでグ〜は鳴らさない）
    if (!night && f < 0.15 && (hoursSince === null ? h >= 9 : hoursSince >= 4)) return 'hungry';
    if (weightDown()) return 'slim';
    if (!night && f < 0.4 && hoursSince !== null && hoursSince >= 2.5) return 'peckish';
    return eaten > 0 ? 'happy' : 'normal';
  }
  // 最近、体重が減った（直近の記録が1つ前より0.3kg以上少なく、3日以内に記録）
  function weightDown() {
    const w = [...S.d.weights].sort((a, b) => (a.date < b.date ? -1 : 1));
    if (w.length < 2) return false;
    const last = w[w.length - 1], prev = w[w.length - 2];
    return last.kg <= prev.kg - 0.3 && last.date >= Day.add(Day.key(), -2);
  }
  // せりふを選ぶための、いまの状況
  function talkContext(m = mood()) {
    const s = set(), now = new Date(), today = mealsOf(Day.key());
    const eaten = sum(today, 'kcal');
    const ws = [...S.d.weights].sort((a, b) => (a.date < b.date ? -1 : 1));
    let daysSinceWeight = null;
    if (ws.length) {
      const [y, mo, d] = ws[ws.length - 1].date.split('-').map(Number);
      daysSinceWeight = Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - new Date(y, mo - 1, d)) / 864e5);
    }
    return {
      mood: m, hour: now.getHours(), month: now.getMonth() + 1, weekday: now.getDay(),
      eaten, goal: s.goalKcal, left: s.goalKcal - eaten, slots: new Set(today.map((x) => x.slot)),
      streak: streak(), salt: sum(today, 'salt'), saltGoal: s.saltGoal,
      water: S.d.water[Day.key()] || 0, waterGoal: s.waterGoal, daysSinceWeight,
      doctor: s.goalSource === 'doctor', firstTime: S.d.meals.length === 0,
      hoursSince: fullness(now).hoursSince,
    };
  }

  function charaSVG(m = mood(), type = Chara.fix(set().chara)) {
    return Chara.svg(type, { build: Chara.buildFromBMI(bmi()), mood: m });
  }

  function go(screen, p = {}) {
    // 入力の途中で画面いっぱいの広告は出さない（呼び出し場所を限定している）
    state.screen = screen; state.p = p;
    render();
    window.scrollTo(0, 0);
  }

  function applyFont() { document.documentElement.style.setProperty('--fs', set().fontScale); }

  // ───────── 画面 ─────────
  const R = {};

  // 最初の設定（質問は3つだけ。あとから変えられる）
  R.setup = () => {
    const st = state.p.step || 1;
    const s = set();
    let h = `<p class="steps">${st} / 3</p>`;
    if (st === 1) {
      h += `<h1>カロリーごはん帳へ<br>ようこそ</h1>
        <div class="row"><button class="btn-sub" data-act="font">文字を大きくする</button></div>
        <h2>いっしょに記録する<br>なかまを選んでね</h2>
        <div class="chara-pick">${Object.entries(Chara.TYPES).map(([k, t]) =>
          `<button data-act="chara" data-v="${k}" class="${Chara.fix(s.chara) === k ? 'sel' : ''}">${Chara.svg(k)}<div>${t.label}</div></button>`).join('')}</div>
        <button data-act="next">つぎへ</button>`;
    } else if (st === 2) {
      h += `<h1>身長と体重</h1>
        <p class="muted">だいたいで大丈夫です。あとから変えられます。</p>
        <label for="hIn">身長（cm）</label><input id="hIn" type="number" inputmode="decimal" value="${s.height}">
        <label for="wIn">体重（kg）</label><input id="wIn" type="number" inputmode="decimal" value="${latestWeight() || ''}" placeholder="例：55">
        <button data-act="next">つぎへ</button><button class="btn-ghost" data-act="prev">もどる</button>`;
    } else {
      const g = s.goalSource === 'auto' ? autoGoal() : s.goalKcal;
      h += `<h1>1日の目標カロリー</h1>
        <p>どれにしますか？</p>
        <button class="${s.goalSource === 'auto' ? '' : 'btn-sub'}" data-act="src" data-v="auto">おまかせ（${n0(autoGoal())} kcal）</button>
        <button class="${s.goalSource === 'self' ? '' : 'btn-sub'}" data-act="src" data-v="self">自分で決める</button>
        <button class="${s.goalSource === 'doctor' ? '' : 'btn-sub'}" data-act="src" data-v="doctor">お医者さんに言われている</button>
        ${s.goalSource === 'auto' ? '' : `<label for="gIn">目標（kcal）</label><input id="gIn" type="number" inputmode="numeric" value="${g}">`}
        ${s.goalSource === 'doctor' ? '<p class="doctor">先生の指示を優先してね。アプリが勝手に目標を変えることはありません。</p>' : ''}
        <button data-act="finish">はじめる</button><button class="btn-ghost" data-act="prev">もどる</button>`;
    }
    return h;
  };

  R.home = () => {
    const s = set();
    const today = mealsOf(Day.key());
    const eaten = sum(today, 'kcal');
    const left = s.goalKcal - eaten;
    const pct = Math.min(100, (eaten / s.goalKcal) * 100);
    const m = mood();
    if (!state.p.talk) state.p.talk = Talk.home(talkContext(m));
    const talk = state.p.talk;
    const st = streak();
    return `
      <div class="top"><span>${Day.label(Day.key())}</span>${st ? `<span class="streak">${st}日連続 記録中</span>` : ''}</div>
      <div class="stage ${state.p.react ? 'react' : ''}" data-act="talk" role="button" aria-label="キャラに話しかける">
        <div class="bubble" id="bubble" aria-live="polite">${esc(talk)}</div>
        ${charaSVG(m)}
      </div>
      <div class="card center">
        ${left >= 0 ? `<div>今日の残り</div><div class="big">${n0(left)}<span class="unit">kcal</span></div>`
                    : `<div>今日は目標より</div><div class="big" style="color:var(--warn)">${n0(-left)}<span class="unit">kcal 多め</span></div>`}
        <div class="meter ${left < 0 ? 'over' : ''}" role="img" aria-label="目標の${Math.round(pct)}%"><div style="width:${pct}%"></div></div>
        <div class="muted">目標 ${n0(s.goalKcal)} ／ 食べた ${n0(eaten)} kcal</div>
        ${s.goalSource === 'doctor' ? '<p class="doctor">先生の指示を優先してね</p>' : ''}
      </div>
      <button class="btn-photo" data-act="photo">📷 写真を撮る</button>
      <p class="center muted">料理だけを撮ってね（顔や名前は写さないでね）</p>
      <button class="btn-sub" data-go="manual">写真なしで記録する</button>
      <button class="btn-sub" data-go="menu">ほかの機能</button>`;
  };

  R.menu = () => `${back()}<h1>ほかの機能</h1>
    <button class="btn-sub" data-go="today">今日の記録・塩分</button>
    <button class="btn-sub" data-go="weight">体重</button>
    <button class="btn-sub" data-go="water">水分</button>
    <button class="btn-sub" data-go="summary">1週間・1か月のまとめ</button>
    <button class="btn-sub" data-go="share">家族・ケアマネに送る</button>
    <button class="btn-sub" data-go="settings">設定（文字の大きさなど）</button>`;

  // 写真 → 判定
  R.photo = () => {
    const p = state.p;
    let h = `${back()}<h1>写真の料理</h1><img class="photo" src="${p.url}" alt="撮った写真">`;
    if (p.loading) {
      h += `<div class="spinner" role="status" aria-label="調べています"></div><p class="center">なんの料理か調べています…</p>
        <p class="center muted">はじめての時は少し時間がかかります</p>`;
    } else if (p.results && p.results.length) {
      h += `<h2>これかな？</h2>${p.results.map((r) =>
        `<button class="food-btn" data-act="pickFood" data-id="${r.food.id}"><span>${esc(r.food.name)}</span><span>${r.food.kcal} kcal</span></button>`).join('')}
        <button class="btn-sub" data-act="manualFromPhoto">ちがう料理を選ぶ</button>`;
    } else {
      h += `<div class="notice">ごめんね、うまく分からなかったよ。<br>下のボタンから料理を選んでね。</div>
        <button data-act="manualFromPhoto">料理を選ぶ</button>`;
    }
    h += `<p class="notice">※ 写真から出すカロリーは<br>あくまで目安です。</p>`;
    return h;
  };

  // メニューを選ぶ・入力する
  R.manual = () => {
    const p = state.p;
    const q = (p.q || '').trim();
    const cat = p.cat || (q ? '' : 'ごはん');
    const list = FOODS.filter((f) => (q ? f.name.includes(q) : f.cat === cat));
    return `${back()}<h1>料理を選ぶ</h1>
      <label for="q">名前でさがす</label>
      <input id="q" type="search" placeholder="例：カレー" value="${esc(q)}" data-input="q">
      <div class="chips">${FOOD_CATS.map((c) => `<button data-act="cat" data-v="${c}" class="${c === cat ? 'sel' : ''}">${c}</button>`).join('')}</div>
      <div id="foodList">${list.map((f) =>
        `<button class="food-btn" data-act="pickFood" data-id="${f.id}"><span>${esc(f.name)}</span><span>${f.kcal} kcal</span></button>`).join('') ||
        '<p class="muted">見つかりませんでした。下から自分で入力できます。</p>'}</div>
      <h2>リストにない時</h2>
      <button class="btn-sub" data-go="custom">自分で入力する</button>`;
  };

  R.custom = () => `${back('manual')}<h1>自分で入力</h1>
    <label for="cName">料理の名前</label><input id="cName" type="text" placeholder="例：さばのみそ煮">
    <label for="cKcal">カロリー（kcal）</label><input id="cKcal" type="number" inputmode="numeric" placeholder="分からなければ空でOK">
    <label for="cSalt">塩分（g）</label><input id="cSalt" type="number" inputmode="decimal" placeholder="分からなければ空でOK">
    <button data-act="customNext">つぎへ</button>`;

  // 量と食事の区分を選んで記録
  R.portion = () => {
    const p = state.p;
    const f = p.food;
    const por = PORTIONS.find((x) => x.id === (p.portion || 'normal'));
    const kcal = Math.round(f.kcal * por.rate);
    const salt = f.salt * por.rate;
    return `${back(p.via === 'photo' ? 'home' : 'manual')}<h1>${esc(f.name)}</h1>
      ${p.url ? `<img class="photo" src="${p.url}" alt="撮った写真">` : ''}
      <h2>量はどれくらい？</h2>
      <div class="row">${PORTIONS.map((x) => `<button data-act="portion" data-v="${x.id}" class="${x.id === por.id ? '' : 'btn-sub'}">${x.label}</button>`).join('')}</div>
      <div class="card center"><div class="big">${n0(kcal)}<span class="unit">kcal</span></div><div class="muted">塩分 約${n1(salt)}g</div></div>
      <h2>いつの食事？</h2>
      <div class="grid2">${SLOTS.map((s) => `<button data-act="slot" data-v="${s}" class="${s === p.slot ? '' : 'btn-sub'}">${s}</button>`).join('')}</div>
      ${p.via === 'photo' ? '<p class="notice">※ 写真から出したカロリーはあくまで目安です。</p>' : ''}
      <button class="btn-photo" data-act="save">記録する</button>`;
  };

  // 今日の記録・塩分
  R.today = () => {
    const date = state.p.date || Day.key();
    const list = mealsOf(date);
    const s = set();
    const kcal = sum(list, 'kcal'), salt = sum(list, 'salt');
    const water = S.d.water[date] || 0;
    const isToday = date === Day.key();
    return `${back('menu')}
      <div class="row no-print"><button class="btn-sub" data-act="day" data-v="-1">◀ 前の日</button>${isToday ? '<span></span>' : '<button class="btn-sub" data-act="day" data-v="1">次の日 ▶</button>'}</div>
      <h1>${Day.label(date)}</h1>
      <div class="card">
        <p>カロリー：<b>${n0(kcal)}</b> ／ 目標 ${n0(s.goalKcal)} kcal</p>
        <p>塩分の目安：<b style="color:${salt > s.saltGoal ? 'var(--warn)' : 'var(--ok)'}">${n1(salt)} g</b> ／ ${n1(s.saltGoal)} g まで
          ${salt > s.saltGoal ? '<br>しょっぱい物が多めかも。汁を残すと減らせるよ' : ''}</p>
        <p>水分：<b>${n0(water)}</b> ml</p>
      </div>
      ${SLOTS.map((slot) => {
        const ms = list.filter((m) => m.slot === slot);
        if (!ms.length) return '';
        return `<h2>${slot}</h2><ul class="list card">${ms.map((m) =>
          `<li><span>${esc(m.name)}${m.portion && m.portion !== '普通' ? `（${m.portion}）` : ''}<br><span class="muted">${m.kcal} kcal・塩分${n1(m.salt)}g</span></span>
           <button class="btn-danger btn-inline" data-act="delMeal" data-id="${m.id}" aria-label="${esc(m.name)}を消す">消す</button></li>`).join('')}</ul>`;
      }).join('') || '<p class="card muted">まだ記録がありません</p>'}
      <p class="muted">※ 写真から出したカロリーは目安です。</p>`;
  };

  // 体重
  R.weight = () => {
    const s = set();
    const w = latestWeight();
    const b = bmi();
    const shape = !b ? '' : b < 18.5 ? '痩せぎみ' : b < 25 ? 'ふつう' : 'ふっくら';
    const ws = [...S.d.weights].sort((a, c) => (a.date < c.date ? -1 : 1)).slice(-30);
    return `${back('menu')}<h1>体重</h1>
      <div class="card center">${w ? `<div>いまの体重</div><div class="big">${n1(w)}<span class="unit">kg</span></div><div class="muted">体格の目安：${shape}</div>` : '<p>まだ記録がありません</p>'}</div>
      ${b && b < 18.5 ? '<p class="notice">痩せすぎに気をつけてね。無理なダイエットはやめよう。</p>' : ''}
      <label for="wIn">今日の体重（kg）</label>
      <div class="inline-input"><input id="wIn" type="number" inputmode="decimal" step="0.1" value="${w ? n1(w) : ''}"><button class="btn-inline" data-act="saveWeight">記録</button></div>
      <h2>グラフ（最近30回）</h2>
      <div class="card graph">${ws.length >= 2 ? graph(ws) : '<p class="muted">2回以上記録するとグラフが出ます</p>'}</div>
      ${s.goalSource === 'doctor' ? '<p class="doctor">目標カロリーは先生の指示を優先してね</p>' : ''}`;
  };

  function graph(ws) {
    const W = 320, H = 180, P = 34;
    const vals = ws.map((x) => x.kg);
    let lo = Math.min(...vals), hi = Math.max(...vals);
    if (hi - lo < 2) { lo -= 1; hi += 1; }
    const X = (i) => P + (i * (W - P - 12)) / (ws.length - 1);
    const Y = (v) => 12 + ((hi - v) * (H - 40)) / (hi - lo);
    const pts = ws.map((x, i) => `${X(i)},${Y(x.kg)}`).join(' ');
    const lab = (k) => { const [, m, d] = k.split('-').map(Number); return `${m}/${d}`; };
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="体重のグラフ">
      <line x1="${P}" y1="${Y(hi)}" x2="${W - 12}" y2="${Y(hi)}" stroke="#F1E2CC" stroke-width="2"/>
      <line x1="${P}" y1="${Y(lo)}" x2="${W - 12}" y2="${Y(lo)}" stroke="#F1E2CC" stroke-width="2"/>
      <text x="2" y="${Y(hi) + 5}" font-size="13" fill="#5C4330">${n1(hi)}</text>
      <text x="2" y="${Y(lo) + 5}" font-size="13" fill="#5C4330">${n1(lo)}</text>
      <polyline points="${pts}" fill="none" stroke="#C2410C" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>
      ${ws.map((x, i) => `<circle cx="${X(i)}" cy="${Y(x.kg)}" r="4.5" fill="#fff" stroke="#C2410C" stroke-width="3"/>`).join('')}
      <text x="${P}" y="${H - 6}" font-size="13" fill="#5C4330">${lab(ws[0].date)}</text>
      <text x="${W - 12}" y="${H - 6}" font-size="13" fill="#5C4330" text-anchor="end">${lab(ws[ws.length - 1].date)}</text>
    </svg>`;
  }

  // 水分
  R.water = () => {
    const s = set();
    const ml = S.d.water[Day.key()] || 0;
    const cups = Math.round(ml / 200);
    return `${back('menu')}<h1>水分</h1>
      <div class="card center"><div>今日飲んだ量</div><div class="big">${n0(ml)}<span class="unit">ml</span></div>
        <div class="cups" aria-hidden="true">${'🥛'.repeat(Math.min(cups, 15))}</div>
        <div class="muted">目標 ${n0(s.waterGoal)} ml（コップ${Math.round(s.waterGoal / 200)}杯）</div></div>
      <button class="btn-photo" data-act="water" data-v="200">＋ コップ1杯（200ml）</button>
      <button class="btn-sub" data-act="water" data-v="-200">1杯ぶん もどす</button>
      <p class="muted">※ 水分を控えるように言われている方は、先生の指示を優先してね。</p>`;
  };

  // まとめ（受診時に見せられる）
  function rangeDays(n) {
    const out = []; let d = Day.key();
    for (let i = 0; i < n; i++) { out.unshift(d); d = Day.add(d, -1); }
    return out;
  }
  function weightOn(date) { const w = S.d.weights.find((x) => x.date === date); return w ? w.kg : null; }
  function summaryData(n) {
    const s = set();
    const days = rangeDays(n).map((date) => {
      const ms = mealsOf(date);
      return { date, kcal: sum(ms, 'kcal'), salt: sum(ms, 'salt'), water: S.d.water[date] || 0, kg: weightOn(date), n: ms.length };
    });
    const rec = days.filter((d) => d.n > 0);
    const avg = (k) => (rec.length ? rec.reduce((a, d) => a + d[k], 0) / rec.length : 0);
    const ok = rec.filter((d) => d.kcal >= s.goalKcal * 0.9 && d.kcal <= s.goalKcal * 1.1).length;
    const kgs = days.filter((d) => d.kg);
    return { days, rec, avgKcal: avg('kcal'), avgSalt: avg('salt'), avgWater: avg('water'), ok,
      kgFrom: kgs[0] && kgs[0].kg, kgTo: kgs.length && kgs[kgs.length - 1].kg };
  }
  function summaryText(n) {
    const s = set(), d = summaryData(n);
    const src = { auto: 'おまかせ', self: '自分で決めた', doctor: '医師の指示' }[s.goalSource];
    let t = `【カロリーごはん帳 ${n === 7 ? '1週間' : '1か月'}のまとめ】\n${Day.label(d.days[0].date)}〜${Day.label(d.days[d.days.length - 1].date)}\n`;
    t += `目標カロリー：${n0(s.goalKcal)}kcal（${src}）\n記録した日：${d.rec.length}日／${n}日\n`;
    t += `1日の平均：${n0(d.avgKcal)}kcal・塩分${n1(d.avgSalt)}g・水分${n0(d.avgWater)}ml\n`;
    if (d.kgFrom) t += `体重：${n1(d.kgFrom)}kg → ${n1(d.kgTo)}kg\n`;
    t += '※ 写真から出したカロリーは目安です。';
    return t;
  }
  R.summary = () => {
    const n = state.p.n || 7;
    const s = set();
    const d = summaryData(n);
    const src = { auto: 'おまかせ', self: '自分で決めた', doctor: '医師の指示' }[s.goalSource];
    return `${back('menu')}
      <div class="row no-print"><button data-act="sumN" data-v="7" class="${n === 7 ? '' : 'btn-sub'}">1週間</button><button data-act="sumN" data-v="30" class="${n === 30 ? '' : 'btn-sub'}">1か月</button></div>
      <h1>${n === 7 ? '1週間' : '1か月'}のまとめ</h1>
      <p class="muted">${Day.label(d.days[0].date)} 〜 ${Day.label(d.days[d.days.length - 1].date)}</p>
      <div class="card">
        <p>目標カロリー：<b>${n0(s.goalKcal)} kcal</b>（${src}）</p>
        <p>記録した日：<b>${d.rec.length}</b> 日 ／ ${n} 日</p>
        <p>目標どおり（±10%）の日：<b>${d.ok}</b> 日</p>
        <p>1日の平均：<b>${n0(d.avgKcal)}</b> kcal</p>
        <p>塩分の平均：<b>${n1(d.avgSalt)}</b> g（目安 ${n1(s.saltGoal)} g）</p>
        <p>水分の平均：<b>${n0(d.avgWater)}</b> ml</p>
        ${d.kgFrom ? `<p>体重：<b>${n1(d.kgFrom)} kg → ${n1(d.kgTo)} kg</b></p>` : ''}
      </div>
      <h2>日ごとの記録</h2>
      <div class="card"><table><thead><tr><th>日付</th><th>kcal</th><th>塩分</th><th>体重</th></tr></thead><tbody>
        ${d.days.slice().reverse().map((x) => {
          const [, m, dd] = x.date.split('-').map(Number);
          return `<tr><td>${m}/${dd}</td><td>${x.n ? n0(x.kcal) : '−'}</td><td>${x.n ? n1(x.salt) + 'g' : '−'}</td><td>${x.kg ? n1(x.kg) : '−'}</td></tr>`;
        }).join('')}
      </tbody></table></div>
      <p class="muted">※ 写真から出したカロリーは目安です。</p>
      <div class="no-print"><button data-act="print">印刷・PDFにする</button><button class="btn-sub" data-go="share">家族・ケアマネに送る</button></div>`;
  };

  // 共有（本人が許可した人だけ）
  R.share = () => {
    const list = set().share;
    return `${back('menu')}<h1>家族・ケアマネに送る</h1>
      <p>あなたが<b>許可した人だけ</b>に、まとめを送れます。勝手に送られることはありません。</p>
      <h2>許可した人</h2>
      ${list.length ? `<ul class="list card">${list.map((p, i) => `<li><span>${esc(p.name)}<br><span class="muted">${esc(p.role)}</span></span>
        <span><button class="btn-inline" data-act="sendTo" data-i="${i}">送る</button></span></li>`).join('')}</ul>
        ${list.map((p, i) => `<button class="btn-danger" data-act="delShare" data-i="${i}">${esc(p.name)}さんの許可をやめる</button>`).join('')}`
        : '<p class="card muted">まだいません</p>'}
      <h2>許可する人を追加</h2>
      <label for="shName">名前</label><input id="shName" type="text" placeholder="例：長女 さくら">
      <div class="chips" role="group" aria-label="関係">${['家族', 'ケアマネ', 'その他'].map((r, i) => `<button data-act="shRole" data-v="${r}" class="${(state.p.role || '家族') === r ? 'sel' : ''}">${r}</button>`).join('')}</div>
      <button class="btn-sub" data-act="addShare">追加する</button>`;
  };

  // 設定
  R.settings = () => {
    const s = set();
    const fs = [[1, '大'], [1.2, 'もっと大'], [1.4, 'とても大']];
    return `${back('menu')}<h1>設定</h1>
      <h2>文字の大きさ</h2>
      <div class="row">${fs.map(([v, l]) => `<button data-act="fs" data-v="${v}" class="${s.fontScale === v ? '' : 'btn-sub'}">${l}</button>`).join('')}</div>
      <h2>キャラクター</h2>
      <div class="chara-pick">${Object.entries(Chara.TYPES).map(([k, t]) =>
        `<button data-act="chara" data-v="${k}" class="${Chara.fix(s.chara) === k ? 'sel' : ''}">${Chara.svg(k)}<div>${t.label}</div></button>`).join('')}</div>
      <h2>身長</h2>
      <div class="inline-input"><input id="hIn" type="number" inputmode="decimal" value="${s.height}"><span>cm</span></div>
      <h2>1日の目標カロリー</h2>
      <div class="chips">${[['auto', 'おまかせ'], ['self', '自分で決めた'], ['doctor', '医師の指示']].map(([k, l]) =>
        `<button data-act="src" data-v="${k}" class="${s.goalSource === k ? 'sel' : ''}">${l}</button>`).join('')}</div>
      <div class="inline-input"><input id="gIn" type="number" inputmode="numeric" value="${s.goalKcal}" ${s.goalSource === 'auto' ? 'disabled' : ''}><span>kcal</span></div>
      ${s.goalSource === 'doctor' ? '<p class="doctor">先生の指示を優先してね。アプリが勝手に目標を変えることはありません。</p>' : ''}
      <h2>塩分の目安（1日）</h2>
      <div class="inline-input"><input id="saltIn" type="number" inputmode="decimal" step="0.5" value="${s.saltGoal}"><span>g</span></div>
      <p class="muted">目安：男性 7.5g未満、女性 6.5g未満。高血圧の方は 6g未満（先生の指示を優先）。</p>
      <h2>水分の目標（1日）</h2>
      <div class="inline-input"><input id="waterIn" type="number" inputmode="numeric" step="100" value="${s.waterGoal}"><span>ml</span></div>
      <h2>食事の時間のお知らせ</h2>
      <div class="row"><button data-act="notify" data-v="1" class="${s.notify.on ? '' : 'btn-sub'}">お知らせする</button><button data-act="notify" data-v="0" class="${s.notify.on ? 'btn-sub' : ''}">しない</button></div>
      ${['朝', '昼', '夜'].map((l, i) => `<label for="t${i}">${l}ごはん</label><input id="t${i}" type="time" value="${s.notify.times[i]}">`).join('')}
      <button data-act="saveSettings">設定を保存する</button>
      <h2>プラン</h2>
      <div class="card"><p>いまは<b>${s.plan === 'paid' ? '有料版' : '無料版'}</b>です。</p>
        <p class="muted">有料版（準備中）：AIで写真の判定がもっと正確に。広告なし。月額制・1か月の利用回数に上限あり。<br>
        ※ 外部のAIサービスを使う時、写真がサービスの改善に使われることがあります。顔や名前が写らないようにしてください。</p></div>
      <h2>データ</h2>
      <button class="btn-danger" data-act="reset">記録をすべて消す</button>`;
  };

  // ───────── 描画と操作 ─────────
  function render() {
    applyFont();
    const r = R[state.screen] || R.home;
    $view.innerHTML = r();
    document.title = 'カロリーごはん帳';
  }

  function readNum(id) { const el = document.getElementById(id); if (!el) return NaN; return parseFloat(el.value); }

  async function handlePhoto(file) {
    if (!file) return;
    const url = URL.createObjectURL(file);
    go('photo', { url, loading: true });
    const img = new Image();
    img.src = url;
    await img.decode().catch(() => {});
    const results = await Recognizer.recognize(img);
    if (state.screen !== 'photo' || state.p.url !== url) return; // 途中で戻った
    go('photo', { url, loading: false, results });
  }

  function saveMeal() {
    const p = state.p;
    const por = PORTIONS.find((x) => x.id === (p.portion || 'normal'));
    const now = new Date();
    S.d.meals.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      date: Day.key(now),
      time: now.toTimeString().slice(0, 5),
      slot: p.slot,
      name: p.food.name,
      kcal: Math.round(p.food.kcal * por.rate),
      salt: Math.round(p.food.salt * por.rate * 10) / 10,
      portion: por.label,
      via: p.via,
    });
    S.save();
    if (p.url) URL.revokeObjectURL(p.url);
    // 記録が終わったらキャラが反応 → その後なら画面いっぱいの広告を出してよい
    const talk = Talk.afterMeal(talkContext(), { name: p.food.name, salt: p.food.salt * por.rate, portion: por.label, foodId: p.food.id, cat: p.food.cat });
    go('home', { react: true, talk });
    setTimeout(() => { if (state.screen === 'home') Ads.maybeFullScreen(); }, 2600);
  }

  async function scheduleNotify() {
    const LN = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.LocalNotifications;
    const s = set();
    if (!LN) { if (s.notify.on) alert('お知らせは、スマホのアプリ版で使えます。'); return; }
    try {
      await LN.cancel({ notifications: [{ id: 1 }, { id: 2 }, { id: 3 }] });
      if (!s.notify.on) return;
      const perm = await LN.requestPermissions();
      if (perm.display !== 'granted') { alert('スマホの設定で「通知」を許可してください。'); return; }
      const names = ['朝ごはん', '昼ごはん', '夜ごはん'];
      await LN.schedule({ notifications: s.notify.times.map((t, i) => {
        const [hour, minute] = t.split(':').map(Number);
        return { id: i + 1, title: 'カロリーごはん帳', body: `${names[i]}の時間だよ。食べたら写真を撮ってね`, schedule: { on: { hour, minute }, allowWhileIdle: true } };
      }) });
    } catch (e) { console.warn(e); }
  }

  async function shareText(text) {
    const Sh = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.Share;
    try {
      if (Sh) { await Sh.share({ title: 'カロリーごはん帳のまとめ', text }); return; }
      if (navigator.share) { await navigator.share({ title: 'カロリーごはん帳のまとめ', text }); return; }
      await navigator.clipboard.writeText(text);
      alert('まとめをコピーしました。メールやLINEに貼りつけて送ってください。');
    } catch (e) { /* 取り消した時など */ }
  }

  const ACT = {
    photo: () => { $file.value = ''; $file.click(); },
    // キャラをさわると、別のことをしゃべる
    talk: () => {
      const b = document.getElementById('bubble');
      if (!b) return;
      state.p.talk = Talk.home(talkContext());
      b.textContent = state.p.talk;
      const st = document.querySelector('.stage');
      st.classList.remove('react'); void st.offsetWidth; st.classList.add('react');
    },
    manualFromPhoto: () => go('manual', { fromPhoto: true, url: state.p.url }),
    pickFood: (el) => {
      const food = FOODS.find((f) => f.id === el.dataset.id);
      go('portion', { food, portion: 'normal', slot: slotByTime(), via: state.screen === 'photo' || state.p.fromPhoto ? 'photo' : 'manual', url: state.p.url });
    },
    cat: (el) => go('manual', Object.assign({}, state.p, { cat: el.dataset.v, q: '' })),
    customNext: () => {
      const name = document.getElementById('cName').value.trim();
      if (!name) { alert('料理の名前を入れてください'); return; }
      const kcal = parseFloat(document.getElementById('cKcal').value) || 0;
      const salt = parseFloat(document.getElementById('cSalt').value) || 0;
      go('portion', { food: { id: 'custom', name, kcal, salt }, portion: 'normal', slot: slotByTime(), via: 'manual' });
    },
    portion: (el) => { state.p.portion = el.dataset.v; render(); },
    slot: (el) => { state.p.slot = el.dataset.v; render(); },
    save: saveMeal,
    delMeal: (el) => {
      if (!confirm('この記録を消しますか？')) return;
      S.d.meals = S.d.meals.filter((m) => m.id !== el.dataset.id); S.save(); render();
    },
    day: (el) => go('today', { date: Day.add(state.p.date || Day.key(), Number(el.dataset.v)) }),
    saveWeight: () => {
      const kg = readNum('wIn');
      if (!(kg > 20 && kg < 300)) { alert('体重を数字で入れてください'); return; }
      const date = Day.key();
      S.d.weights = S.d.weights.filter((w) => w.date !== date).concat({ date, kg });
      S.save(); render();
    },
    water: (el) => {
      const k = Day.key();
      S.d.water[k] = Math.max(0, (S.d.water[k] || 0) + Number(el.dataset.v)); S.save(); render();
    },
    sumN: (el) => go('summary', { n: Number(el.dataset.v) }),
    print: () => window.print(),
    shRole: (el) => { const name = document.getElementById('shName').value; state.p.role = el.dataset.v; render(); document.getElementById('shName').value = name; },
    addShare: () => {
      const name = document.getElementById('shName').value.trim();
      if (!name) { alert('名前を入れてください'); return; }
      if (!confirm(`${name}さんに、あなたの記録のまとめを送ることを許可しますか？`)) return;
      set().share.push({ name, role: state.p.role || '家族' }); S.save(); go('share');
    },
    delShare: (el) => { set().share.splice(Number(el.dataset.i), 1); S.save(); render(); },
    sendTo: (el) => shareText(`${set().share[Number(el.dataset.i)].name}さんへ\n` + summaryText(7)),
    fs: (el) => { set().fontScale = Number(el.dataset.v); S.save(); render(); },
    font: () => { const s = set(); s.fontScale = s.fontScale >= 1.4 ? 1 : Math.round((s.fontScale + 0.2) * 10) / 10; S.save(); render(); },
    chara: (el) => { set().chara = el.dataset.v; S.save(); render(); },
    src: (el) => {
      const s = set();
      keepInputs();
      s.goalSource = el.dataset.v;
      if (s.goalSource === 'auto') s.goalKcal = autoGoal();
      S.save(); render();
    },
    notify: (el) => { keepInputs(); set().notify.on = el.dataset.v === '1'; S.save(); render(); },
    saveSettings: () => {
      keepInputs(); S.save(); scheduleNotify(); Ads.showBanner();
      alert('保存しました'); go('menu');
    },
    reset: () => {
      if (!confirm('記録をすべて消します。元にもどせません。よろしいですか？')) return;
      S.reset(); Ads.showBanner(); go('setup', { step: 1 });
    },
    // 最初の設定
    next: () => { keepInputs(); go('setup', { step: (state.p.step || 1) + 1 }); },
    prev: () => { keepInputs(); go('setup', { step: (state.p.step || 1) - 1 }); },
    finish: () => {
      keepInputs();
      const s = set();
      if (s.goalSource === 'auto') s.goalKcal = autoGoal();
      S.d.setup = true; S.save(); Ads.showBanner(); go('home');
    },
  };

  // 画面の入力欄の値を設定に反映
  function keepInputs() {
    const s = set();
    const h = readNum('hIn');
    if (h > 90 && h < 230) s.height = h;
    const w = readNum('wIn');
    if (state.screen === 'setup' && w > 20 && w < 300) {
      const date = Day.key();
      S.d.weights = S.d.weights.filter((x) => x.date !== date).concat({ date, kg: w });
    }
    const g = readNum('gIn');
    if (s.goalSource !== 'auto' && g >= 600 && g <= 5000) s.goalKcal = Math.round(g);
    if (s.goalSource === 'auto') s.goalKcal = autoGoal();
    const salt = readNum('saltIn'); if (salt > 0 && salt < 30) s.saltGoal = salt;
    const water = readNum('waterIn'); if (water >= 0 && water < 6000) s.waterGoal = water;
    for (let i = 0; i < 3; i++) { const t = document.getElementById('t' + i); if (t && t.value) s.notify.times[i] = t.value; }
    S.save();
  }

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-go],[data-act]');
    if (!el) return;
    if (el.dataset.go) {
      const to = el.dataset.go;
      go(to, {});
      // まとめを開いた時は、画面いっぱいの広告を出してよい（1日1回まで）
      if (to === 'summary') setTimeout(() => Ads.maybeFullScreen(), 400);
      return;
    }
    const f = ACT[el.dataset.act];
    if (f) f(el);
  });

  // 検索欄：入力するたびに一覧だけ更新（キーボードが閉じないように）
  document.addEventListener('input', (e) => {
    if (e.target.dataset.input !== 'q') return;
    state.p.q = e.target.value;
    const q = state.p.q.trim();
    const cat = q ? '' : (state.p.cat || 'ごはん');
    const list = FOODS.filter((f) => (q ? f.name.includes(q) : f.cat === cat));
    document.getElementById('foodList').innerHTML = list.map((f) =>
      `<button class="food-btn" data-act="pickFood" data-id="${f.id}"><span>${esc(f.name)}</span><span>${f.kcal} kcal</span></button>`).join('') ||
      '<p class="muted">見つかりませんでした。下から自分で入力できます。</p>';
    document.querySelectorAll('.chips [data-act=cat]').forEach((b) => b.classList.toggle('sel', !q && b.dataset.v === cat));
  });

  $file.addEventListener('change', () => handlePhoto($file.files[0]));

  // スマホの「戻る」操作（Android）用
  window.addEventListener('popstate', () => { if (state.screen !== 'home' && S.d.setup) go('home'); });

  // ───────── 起動 ─────────
  (async function start() {
    await S.restore();
    applyFont();
    await Ads.init();
    Ads.showBanner();
    if (!S.d.setup) go('setup', { step: 1 }); else go('home');
    // 写真の判定データを先に読みこんでおく（最初の1枚を待たせないため）
    setTimeout(() => Recognizer.prepare().catch(() => {}), 1500);
  })();

  window.App = { go, state };
})();

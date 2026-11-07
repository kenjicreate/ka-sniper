// カロリーごはん帳 本体
(function () {
  const S = window.Store;
  const $view = document.getElementById('view');
  const $file = document.getElementById('photoInput');
  const state = { screen: 'home', p: {} };

  // ───────── 小道具 ─────────
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const t = I18N.t;
  const n0 = (v) => I18N.num(v);
  const n1 = (v) => (Math.round(v * 10) / 10).toFixed(1);
  const set = () => S.d.settings;
  const back = (to = 'home') => `<button class="back no-print" data-go="${to}">${t('common.back')}</button>`;

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
  const chips = (cur) => Object.keys(Chara.TYPES).map((k) =>
    `<button data-act="chara" data-v="${k}" class="${cur === k ? 'sel' : ''}">${Chara.svg(k)}<div>${t('chara.' + k)}</div></button>`).join('');
  const foodBtn = (f) => `<button class="food-btn" data-act="pickFood" data-id="${f.id}"><span>${esc(I18N.foodName(f))}</span><span>${f.kcal} kcal</span></button>`;
  function searchFoods(q, cat) {
    const k = q.toLowerCase();
    return FOODS.filter((f) => (q ? (f.name.includes(q) || (f.en || '').toLowerCase().includes(k)) : f.cat === cat));
  }

  // 最初の設定（質問は3つだけ。あとから変えられる）
  R.setup = () => {
    const st = state.p.step || 1;
    const s = set();
    let h = `<p class="steps">${st} / 3</p>`;
    if (st === 1) {
      h += `<h1>${t('setup.welcome')}</h1>
        <div class="row"><button class="btn-sub" data-act="font">${t('setup.bigger')}</button></div>
        <div class="row">${langButtons()}</div>
        <h2>${t('setup.pickChara')}</h2>
        <div class="chara-pick">${chips(Chara.fix(s.chara))}</div>
        <button data-act="next">${t('common.next')}</button>`;
    } else if (st === 2) {
      h += `<h1>${t('setup.body')}</h1>
        <p class="muted">${t('setup.bodyNote')}</p>
        <label for="hIn">${t('setup.height')}</label><input id="hIn" type="number" inputmode="decimal" value="${s.height}">
        <label for="wIn">${t('setup.weight')}</label><input id="wIn" type="number" inputmode="decimal" value="${latestWeight() || ''}" placeholder="${t('setup.weightPh')}">
        <button data-act="next">${t('common.next')}</button><button class="btn-ghost" data-act="prev">${t('common.prev')}</button>`;
    } else {
      const g = s.goalSource === 'auto' ? autoGoal() : s.goalKcal;
      h += `<h1>${t('setup.goal')}</h1>
        <p>${t('setup.which')}</p>
        <button class="${s.goalSource === 'auto' ? '' : 'btn-sub'}" data-act="src" data-v="auto">${t('setup.auto', { kcal: n0(autoGoal()) })}</button>
        <button class="${s.goalSource === 'self' ? '' : 'btn-sub'}" data-act="src" data-v="self">${t('setup.self')}</button>
        <button class="${s.goalSource === 'doctor' ? '' : 'btn-sub'}" data-act="src" data-v="doctor">${t('setup.doctor')}</button>
        ${s.goalSource === 'auto' ? '' : `<label for="gIn">${t('setup.goalLabel')}</label><input id="gIn" type="number" inputmode="numeric" value="${g}">`}
        ${s.goalSource === 'doctor' ? `<p class="doctor">${t('common.doctorFirstLong')}</p>` : ''}
        <button data-act="finish">${t('setup.start')}</button><button class="btn-ghost" data-act="prev">${t('common.prev')}</button>`;
    }
    return h;
  };
  function langButtons() {
    const cur = set().lang || 'auto';
    return [['auto', t('set.langAuto')], ['ja', '日本語'], ['en', 'English']].map(([k, l]) =>
      `<button data-act="lang" data-v="${k}" class="${cur === k ? '' : 'btn-sub'}">${l}</button>`).join('');
  }

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
      <div class="top"><span>${Day.label(Day.key())}</span>${st ? `<span class="streak">${t('home.streak', { n: st })}</span>` : ''}</div>
      <div class="stage ${state.p.react ? 'react' : ''}" data-act="talk" role="button" aria-label="${t('home.talkTo')}">
        <div class="bubble" id="bubble" aria-live="polite">${esc(talk)}</div>
        ${charaSVG(m)}
      </div>
      <div class="card center">
        ${left >= 0 ? `<div>${t('home.left')}</div><div class="big">${n0(left)}<span class="unit">kcal</span></div>`
                    : `<div>${t('home.over')}</div><div class="big" style="color:var(--warn)">${n0(-left)}<span class="unit">${t('home.overUnit')}</span></div>`}
        <div class="meter ${left < 0 ? 'over' : ''}" role="img" aria-label="${t('home.meter', { pct: Math.round(pct) })}"><div style="width:${pct}%"></div></div>
        <div class="muted">${t('home.goalEaten', { goal: n0(s.goalKcal), eaten: n0(eaten) })}</div>
        ${s.goalSource === 'doctor' ? `<p class="doctor">${t('common.doctorFirst')}</p>` : ''}
      </div>
      <button class="btn-photo" data-act="photo">${t('home.photo')}</button>
      <p class="center muted">${t('home.photoTip')}</p>
      <button class="btn-sub" data-go="manual">${t('home.manual')}</button>
      <button class="btn-sub" data-go="menu">${t('home.more')}</button>`;
  };

  R.menu = () => `${back()}<h1>${t('menu.title')}</h1>
    <button class="btn-sub" data-go="today">${t('menu.today')}</button>
    <button class="btn-sub" data-go="weight">${t('menu.weight')}</button>
    <button class="btn-sub" data-go="water">${t('menu.water')}</button>
    <button class="btn-sub" data-go="summary">${t('menu.summary')}</button>
    <button class="btn-sub" data-go="share">${t('menu.share')}</button>
    <button class="btn-sub" data-go="settings">${t('menu.settings')}</button>`;

  // 写真 → 判定
  R.photo = () => {
    const p = state.p;
    let h = `${back()}<h1>${t('photo.title')}</h1><img class="photo" src="${p.url}" alt="${t('photo.alt')}">`;
    if (p.loading) {
      h += `<div class="spinner" role="status" aria-label="${t('photo.checking')}"></div><p class="center">${t('photo.checkingLong')}</p>
        <p class="center muted">${t('photo.firstTime')}</p>`;
    } else if (p.results && p.results.length) {
      h += `<h2>${t('photo.guess')}</h2>${p.results.map((r) => foodBtn(r.food)).join('')}
        <button class="btn-sub" data-act="manualFromPhoto">${t('photo.other')}</button>`;
    } else {
      h += `<div class="notice">${t('photo.unknown')}</div>
        <button data-act="manualFromPhoto">${t('photo.pick')}</button>`;
    }
    h += `<p class="notice">${t('photo.estimate')}</p>`;
    return h;
  };

  // メニューを選ぶ・入力する
  R.manual = () => {
    const p = state.p;
    const q = (p.q || '').trim();
    const cat = p.cat || (q ? '' : 'ごはん');
    const list = searchFoods(q, cat);
    return `${back()}<h1>${t('manual.title')}</h1>
      <label for="q">${t('manual.search')}</label>
      <input id="q" type="search" placeholder="${t('manual.searchPh')}" value="${esc(q)}" data-input="q">
      <div class="chips">${FOOD_CATS.map((c) => `<button data-act="cat" data-v="${c}" class="${c === cat ? 'sel' : ''}">${I18N.cat(c)}</button>`).join('')}</div>
      <div id="foodList">${list.map(foodBtn).join('') || `<p class="muted">${t('manual.notFound')}</p>`}</div>
      <h2>${t('manual.notInList')}</h2>
      <button class="btn-sub" data-go="custom">${t('manual.custom')}</button>`;
  };

  R.custom = () => `${back('manual')}<h1>${t('custom.title')}</h1>
    <label for="cName">${t('custom.name')}</label><input id="cName" type="text" placeholder="${t('custom.namePh')}">
    <label for="cKcal">${t('custom.kcal')}</label><input id="cKcal" type="number" inputmode="numeric" placeholder="${t('custom.optional')}">
    <label for="cSalt">${t('custom.salt')}</label><input id="cSalt" type="number" inputmode="decimal" placeholder="${t('custom.optional')}">
    <button data-act="customNext">${t('common.next')}</button>`;

  // 量と食事の区分を選んで記録
  R.portion = () => {
    const p = state.p;
    const f = p.food;
    const por = PORTIONS.find((x) => x.id === (p.portion || 'normal'));
    const kcal = Math.round(f.kcal * por.rate);
    const salt = f.salt * por.rate;
    return `${back(p.via === 'photo' ? 'home' : 'manual')}<h1>${esc(I18N.foodName(f))}</h1>
      ${p.url ? `<img class="photo" src="${p.url}" alt="${t('photo.alt')}">` : ''}
      <h2>${t('portion.howMuch')}</h2>
      <div class="row">${PORTIONS.map((x) => `<button data-act="portion" data-v="${x.id}" class="${x.id === por.id ? '' : 'btn-sub'}">${t('portion.' + x.id)}</button>`).join('')}</div>
      <div class="card center"><div class="big">${n0(kcal)}<span class="unit">kcal</span></div><div class="muted">${t('portion.salt', { g: n1(salt) })}</div></div>
      <h2>${t('portion.when')}</h2>
      <div class="grid2">${SLOTS.map((s) => `<button data-act="slot" data-v="${s}" class="${s === p.slot ? '' : 'btn-sub'}">${I18N.slot(s)}</button>`).join('')}</div>
      ${p.via === 'photo' ? `<p class="notice">${t('portion.estimate')}</p>` : ''}
      <button class="btn-photo" data-act="save">${t('portion.save')}</button>`;
  };

  // 今日の記録・塩分
  R.today = () => {
    const date = state.p.date || Day.key();
    const list = mealsOf(date);
    const s = set();
    const kcal = sum(list, 'kcal'), salt = sum(list, 'salt');
    const water = S.d.water[date] || 0;
    const isToday = date === Day.key();
    const saltHtml = `<b style="color:${salt > s.saltGoal ? 'var(--warn)' : 'var(--ok)'}">${n1(salt)} g</b>`;
    return `${back('menu')}
      <div class="row no-print"><button class="btn-sub" data-act="day" data-v="-1">${t('today.prev')}</button>${isToday ? '<span></span>' : `<button class="btn-sub" data-act="day" data-v="1">${t('today.next')}</button>`}</div>
      <h1>${Day.label(date)}</h1>
      <div class="card">
        <p>${t('today.kcal', { kcal: n0(kcal), goal: n0(s.goalKcal) })}</p>
        <p>${t('today.salt', { salt: saltHtml, goal: n1(s.saltGoal) })}
          ${salt > s.saltGoal ? `<br>${t('today.saltHigh')}` : ''}</p>
        <p>${t('today.water', { ml: n0(water) })}</p>
      </div>
      ${SLOTS.map((slot) => {
        const ms = list.filter((m) => m.slot === slot);
        if (!ms.length) return '';
        return `<h2>${I18N.slot(slot)}</h2><ul class="list card">${ms.map((m) => {
          const nm = I18N.mealName(m);
          const por = m.portion && m.portion !== '普通' && m.portion !== 'normal' ? (I18N.lang() === 'ja' ? `（${I18N.portion(m.portion)}）` : ` (${I18N.portion(m.portion)})`) : '';
          return `<li><span>${esc(nm)}${por}<br><span class="muted">${t('today.mealSalt', { kcal: m.kcal, salt: n1(m.salt) })}</span></span>
           <button class="btn-danger btn-inline" data-act="delMeal" data-id="${m.id}" aria-label="${esc(t('today.deleteLabel', { name: nm }))}">${t('today.delete')}</button></li>`;
        }).join('')}</ul>`;
      }).join('') || `<p class="card muted">${t('common.none')}</p>`}
      <p class="muted">${t('common.estimateNote')}</p>`;
  };

  // 体重
  R.weight = () => {
    const s = set();
    const w = latestWeight();
    const b = bmi();
    const shape = !b ? '' : t(b < 18.5 ? 'weight.thin' : b < 25 ? 'weight.normal' : 'weight.plump');
    const ws = [...S.d.weights].sort((a, c) => (a.date < c.date ? -1 : 1)).slice(-30);
    return `${back('menu')}<h1>${t('weight.title')}</h1>
      <div class="card center">${w ? `<div>${t('weight.now')}</div><div class="big">${n1(w)}<span class="unit">kg</span></div><div class="muted">${t('weight.shape', { shape })}</div>` : `<p>${t('common.none')}</p>`}</div>
      ${b && b < 18.5 ? `<p class="notice">${t('weight.tooThin')}</p>` : ''}
      <label for="wIn">${t('weight.today')}</label>
      <div class="inline-input"><input id="wIn" type="number" inputmode="decimal" step="0.1" value="${w ? n1(w) : ''}"><button class="btn-inline" data-act="saveWeight">${t('weight.save')}</button></div>
      <h2>${t('weight.graph')}</h2>
      <div class="card graph">${ws.length >= 2 ? graph(ws) : `<p class="muted">${t('weight.needTwo')}</p>`}</div>
      ${s.goalSource === 'doctor' ? `<p class="doctor">${t('weight.doctor')}</p>` : ''}`;
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
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${t('weight.graphLabel')}">
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
    return `${back('menu')}<h1>${t('water.title')}</h1>
      <div class="card center"><div>${t('water.today')}</div><div class="big">${n0(ml)}<span class="unit">ml</span></div>
        <div class="cups" aria-hidden="true">${'🥛'.repeat(Math.min(cups, 15))}</div>
        <div class="muted">${t('water.goal', { ml: n0(s.waterGoal), cups: Math.round(s.waterGoal / 200) })}</div></div>
      <button class="btn-photo" data-act="water" data-v="200">${t('water.add')}</button>
      <button class="btn-sub" data-act="water" data-v="-200">${t('water.undo')}</button>
      <p class="muted">${t('water.note')}</p>`;
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
  const period = (n) => t(n === 7 ? 'sum.week' : 'sum.month');
  function summaryText(n) {
    const s = set(), d = summaryData(n);
    const src = t('src.' + s.goalSource);
    let x = `${t('sum.text.head', { period: period(n) })}\n${Day.label(d.days[0].date)} – ${Day.label(d.days[d.days.length - 1].date)}\n`;
    x += `${t('sum.text.goal', { kcal: n0(s.goalKcal), src })}\n${t('sum.text.days', { n: d.rec.length, total: n })}\n`;
    x += `${t('sum.text.avg', { kcal: n0(d.avgKcal), salt: n1(d.avgSalt), ml: n0(d.avgWater) })}\n`;
    if (d.kgFrom) x += `${t('sum.text.weight', { from: n1(d.kgFrom), to: n1(d.kgTo) })}\n`;
    x += t('common.estimateNote');
    return x;
  }
  R.summary = () => {
    const n = state.p.n || 7;
    const s = set();
    const d = summaryData(n);
    return `${back('menu')}
      <div class="row no-print"><button data-act="sumN" data-v="7" class="${n === 7 ? '' : 'btn-sub'}">${t('sum.week')}</button><button data-act="sumN" data-v="30" class="${n === 30 ? '' : 'btn-sub'}">${t('sum.month')}</button></div>
      <h1>${t('sum.title', { period: period(n) })}</h1>
      <p class="muted">${Day.label(d.days[0].date)} – ${Day.label(d.days[d.days.length - 1].date)}</p>
      <div class="card">
        <p>${t('sum.goal', { kcal: n0(s.goalKcal), src: t('src.' + s.goalSource) })}</p>
        <p>${t('sum.days', { n: d.rec.length, total: n })}</p>
        <p>${t('sum.ok', { n: d.ok })}</p>
        <p>${t('sum.avg', { kcal: n0(d.avgKcal) })}</p>
        <p>${t('sum.salt', { g: n1(d.avgSalt), goal: n1(s.saltGoal) })}</p>
        <p>${t('sum.water', { ml: n0(d.avgWater) })}</p>
        ${d.kgFrom ? `<p>${t('sum.weight', { from: n1(d.kgFrom), to: n1(d.kgTo) })}</p>` : ''}
      </div>
      <h2>${t('sum.daily')}</h2>
      <div class="card"><table><thead><tr><th>${t('sum.date')}</th><th>kcal</th><th>${t('sum.saltCol')}</th><th>${t('sum.weightCol')}</th></tr></thead><tbody>
        ${d.days.slice().reverse().map((x) => {
          const [, m, dd] = x.date.split('-').map(Number);
          return `<tr><td>${m}/${dd}</td><td>${x.n ? n0(x.kcal) : '−'}</td><td>${x.n ? n1(x.salt) + 'g' : '−'}</td><td>${x.kg ? n1(x.kg) : '−'}</td></tr>`;
        }).join('')}
      </tbody></table></div>
      <p class="muted">${t('common.estimateNote')}</p>
      <div class="no-print"><button data-act="print">${t('sum.print')}</button><button class="btn-sub" data-go="share">${t('menu.share')}</button></div>`;
  };

  // 共有（本人が許可した人だけ）
  R.share = () => {
    const list = set().share;
    const curRole = state.p.role || 'family';
    return `${back('menu')}<h1>${t('share.title')}</h1>
      <p>${t('share.intro')}</p>
      <h2>${t('share.people')}</h2>
      ${list.length ? `<ul class="list card">${list.map((p, i) => `<li><span>${esc(p.name)}<br><span class="muted">${esc(I18N.role(p.role))}</span></span>
        <span><button class="btn-inline" data-act="sendTo" data-i="${i}">${t('share.send')}</button></span></li>`).join('')}</ul>
        ${list.map((p, i) => `<button class="btn-danger" data-act="delShare" data-i="${i}">${esc(t('share.stop', { name: p.name }))}</button>`).join('')}`
        : `<p class="card muted">${t('share.nobody')}</p>`}
      <h2>${t('share.add')}</h2>
      <label for="shName">${t('share.name')}</label><input id="shName" type="text" placeholder="${t('share.namePh')}">
      <div class="chips" role="group" aria-label="${t('share.relation')}">${['family', 'caremanager', 'other'].map((r) => `<button data-act="shRole" data-v="${r}" class="${curRole === r ? 'sel' : ''}">${t('role.' + r)}</button>`).join('')}</div>
      <button class="btn-sub" data-act="addShare">${t('share.addBtn')}</button>`;
  };

  // 設定
  R.settings = () => {
    const s = set();
    const fs = [[1, t('set.fs1')], [1.2, t('set.fs2')], [1.4, t('set.fs3')]];
    const meals = [t('slot.breakfast'), t('slot.lunch'), t('slot.dinner')];
    return `${back('menu')}<h1>${t('set.title')}</h1>
      <h2>${t('set.font')}</h2>
      <div class="row">${fs.map(([v, l]) => `<button data-act="fs" data-v="${v}" class="${s.fontScale === v ? '' : 'btn-sub'}">${l}</button>`).join('')}</div>
      <h2>${t('set.lang')}</h2>
      <div class="row">${langButtons()}</div>
      <h2>${t('set.chara')}</h2>
      <div class="chara-pick">${chips(Chara.fix(s.chara))}</div>
      <h2>${t('set.height')}</h2>
      <div class="inline-input"><input id="hIn" type="number" inputmode="decimal" value="${s.height}"><span>cm</span></div>
      <h2>${t('set.goal')}</h2>
      <div class="chips">${['auto', 'self', 'doctor'].map((k) =>
        `<button data-act="src" data-v="${k}" class="${s.goalSource === k ? 'sel' : ''}">${t('src.' + k)}</button>`).join('')}</div>
      <div class="inline-input"><input id="gIn" type="number" inputmode="numeric" value="${s.goalKcal}" ${s.goalSource === 'auto' ? 'disabled' : ''}><span>kcal</span></div>
      ${s.goalSource === 'doctor' ? `<p class="doctor">${t('common.doctorFirstLong')}</p>` : ''}
      <h2>${t('set.salt')}</h2>
      <div class="inline-input"><input id="saltIn" type="number" inputmode="decimal" step="0.5" value="${s.saltGoal}"><span>g</span></div>
      <p class="muted">${t('set.saltNote')}</p>
      <h2>${t('set.water')}</h2>
      <div class="inline-input"><input id="waterIn" type="number" inputmode="numeric" step="100" value="${s.waterGoal}"><span>ml</span></div>
      <h2>${t('set.notify')}</h2>
      <div class="row"><button data-act="notify" data-v="1" class="${s.notify.on ? '' : 'btn-sub'}">${t('set.notifyOn')}</button><button data-act="notify" data-v="0" class="${s.notify.on ? 'btn-sub' : ''}">${t('set.notifyOff')}</button></div>
      ${meals.map((l, i) => `<label for="t${i}">${l}</label><input id="t${i}" type="time" value="${s.notify.times[i]}">`).join('')}
      <button data-act="saveSettings">${t('set.save')}</button>
      <h2>${t('set.plan')}</h2>
      <div class="card"><p>${t('set.planNow', { plan: t(s.plan === 'paid' ? 'set.paid' : 'set.free') })}</p>
        <p class="muted">${t('set.planNote')}</p></div>
      <h2>${t('set.data')}</h2>
      <button class="btn-danger" data-act="reset">${t('set.reset')}</button>`;
  };

  // ───────── 描画と操作 ─────────
  function render() {
    applyFont();
    const r = R[state.screen] || R.home;
    document.documentElement.lang = I18N.lang();
    $view.innerHTML = r();
    document.title = t('app.name');
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
      foodId: p.food.id !== 'custom' ? p.food.id : undefined,
      kcal: Math.round(p.food.kcal * por.rate),
      salt: Math.round(p.food.salt * por.rate * 10) / 10,
      portion: por.id,
      via: p.via,
    });
    S.save();
    if (p.url) URL.revokeObjectURL(p.url);
    // 記録が終わったらキャラが反応 → その後なら画面いっぱいの広告を出してよい
    const talk = Talk.afterMeal(talkContext(), { name: p.food.name, salt: p.food.salt * por.rate, portion: por.id, foodId: p.food.id, cat: p.food.cat });
    go('home', { react: true, talk });
    setTimeout(() => { if (state.screen === 'home') Ads.maybeFullScreen(); }, 2600);
  }

  async function scheduleNotify() {
    const LN = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.LocalNotifications;
    const s = set();
    if (!LN) { if (s.notify.on) alert(t('notify.webOnly')); return; }
    try {
      await LN.cancel({ notifications: [{ id: 1 }, { id: 2 }, { id: 3 }] });
      if (!s.notify.on) return;
      const perm = await LN.requestPermissions();
      if (perm.display !== 'granted') { alert(t('notify.allow')); return; }
      const names = [t('slot.breakfast'), t('slot.lunch'), t('slot.dinner')];
      await LN.schedule({ notifications: s.notify.times.map((t, i) => {
        const [hour, minute] = t.split(':').map(Number);
        return { id: i + 1, title: t('app.name'), body: t('notify.body', { meal: I18N.lang() === 'en' ? names[i].toLowerCase() : names[i] }), schedule: { on: { hour, minute }, allowWhileIdle: true } };
      }) });
    } catch (e) { console.warn(e); }
  }

  async function shareText(text) {
    const Sh = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.Share;
    try {
      if (Sh) { await Sh.share({ title: t('share.subject'), text }); return; }
      if (navigator.share) { await navigator.share({ title: t('share.subject'), text }); return; }
      await navigator.clipboard.writeText(text);
      alert(t('share.copied'));
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
      if (!name) { alert(t('custom.needName')); return; }
      const kcal = parseFloat(document.getElementById('cKcal').value) || 0;
      const salt = parseFloat(document.getElementById('cSalt').value) || 0;
      go('portion', { food: { id: 'custom', name, kcal, salt, cat: '' }, portion: 'normal', slot: slotByTime(), via: 'manual' });
    },
    portion: (el) => { state.p.portion = el.dataset.v; render(); },
    slot: (el) => { state.p.slot = el.dataset.v; render(); },
    save: saveMeal,
    delMeal: (el) => {
      if (!confirm(t('today.confirmDelete'))) return;
      S.d.meals = S.d.meals.filter((m) => m.id !== el.dataset.id); S.save(); render();
    },
    day: (el) => go('today', { date: Day.add(state.p.date || Day.key(), Number(el.dataset.v)) }),
    saveWeight: () => {
      const kg = readNum('wIn');
      if (!(kg > 20 && kg < 300)) { alert(t('weight.invalid')); return; }
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
      if (!name) { alert(t('share.needName')); return; }
      if (!confirm(t('share.confirm', { name }))) return;
      set().share.push({ name, role: state.p.role || 'family' }); S.save(); go('share');
    },
    delShare: (el) => { set().share.splice(Number(el.dataset.i), 1); S.save(); render(); },
    sendTo: (el) => shareText(t('share.to', { name: set().share[Number(el.dataset.i)].name }) + '\n' + summaryText(7)),
    fs: (el) => { set().fontScale = Number(el.dataset.v); S.save(); render(); },
    font: () => { const s = set(); s.fontScale = s.fontScale >= 1.4 ? 1 : Math.round((s.fontScale + 0.2) * 10) / 10; S.save(); render(); },
    chara: (el) => { set().chara = el.dataset.v; S.save(); render(); },
    // 言語の切り替え（auto＝スマホに合わせる）
    lang: (el) => { keepInputs(); set().lang = el.dataset.v; S.save(); state.p.talk = null; render(); Ads.refreshText && Ads.refreshText(); },
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
      alert(t('set.saved')); go('menu');
    },
    reset: () => {
      if (!confirm(t('set.confirmReset'))) return;
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
    const list = searchFoods(q, cat);
    document.getElementById('foodList').innerHTML = list.map(foodBtn).join('') || `<p class="muted">${t('manual.notFound')}</p>`;
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

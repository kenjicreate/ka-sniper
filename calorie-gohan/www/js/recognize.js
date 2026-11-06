// 写真から料理名を当てる仕組み
// 無料版：スマホの中だけで判定する（写真は外に送らない・ネットがなくても動く）
//   判定データ：Google の料理判定データ「AIY Food V1」（約2,000種類の料理を見分ける）
//   models/food/aiy_food_V1.tflite と labels.txt（料理名の一覧）
// 有料版：外部のAIサービスで判定（あとで追加。ここに入り口だけ用意）
(function () {
  const SIZE = 192;        // 判定データが受け取る写真の大きさ
  const MIN_SCORE = 0.03;  // これより自信がない候補は出さない
  let engine = null;
  let preparing = null;

  function loadScript(src) {
    return new Promise((ok, ng) => {
      if (document.querySelector(`script[src="${src}"]`)) return ok();
      const s = document.createElement('script');
      s.src = src; s.onload = ok; s.onerror = () => ng(new Error('load ' + src));
      document.head.appendChild(s);
    });
  }
  function withTimeout(p, ms) {
    return Promise.race([p, new Promise((_, ng) => setTimeout(() => ng(new Error('timeout')), ms))]);
  }

  // 判定データの料理名 → 料理表の id
  function buildMap(labels) {
    const byName = {};
    for (const f of window.FOODS) for (const n of f.aiy || []) byName[n] = f.id;
    return labels.map((n) => byName[n] || null);
  }

  async function load() {
    await loadScript('vendor/tf-core.min.js');
    await loadScript('vendor/tf-backend-cpu.min.js');
    await loadScript('vendor/tf-tflite.min.js');
    tflite.setWasmPath('vendor/');
    const [model, text] = await Promise.all([
      tflite.loadTFLiteModel('models/food/aiy_food_V1.tflite'),
      fetch('models/food/labels.txt').then((r) => r.text()),
    ]);
    const toFood = buildMap(text.split('\n').map((s) => s.trim()));
    return {
      async classify(img) {
        // 真ん中を正方形に切り取り、192×192 に縮める
        const c = document.createElement('canvas');
        c.width = c.height = SIZE;
        const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height, s = Math.min(w, h);
        c.getContext('2d').drawImage(img, (w - s) / 2, (h - s) / 2, s, s, 0, 0, SIZE, SIZE);
        const input = tf.tidy(() => tf.cast(tf.expandDims(tf.browser.fromPixels(c), 0), 'int32'));
        const out = model.predict(input);
        const scores = await out.data();
        input.dispose(); out.dispose();
        // 自信の高い順に、料理表にある料理だけを拾う（同じ料理は1回だけ）
        const order = Array.from(scores.keys()).sort((a, b) => scores[b] - scores[a]).slice(0, 40);
        const found = new Map();
        for (const i of order) {
          const id = toFood[i];
          const sc = scores[i] / 255;
          if (id && sc >= MIN_SCORE) found.set(id, (found.get(id) || 0) + sc);
        }
        return [...found].map(([id, score]) => ({ id, score })).sort((a, b) => b.score - a.score);
      },
    };
  }

  function prepare() {
    if (engine) return Promise.resolve(engine);
    if (!preparing) preparing = load().then((e) => (engine = e)).catch((e) => { preparing = null; throw e; });
    return preparing;
  }

  // 戻り値: [{ food, score }]（見つからなければ空）
  async function recognize(img) {
    const s = window.Store.d.settings;
    if (s.plan === 'paid') {
      // 有料版はここで外部AIを呼ぶ予定（月の上限回数つき）。いまは未実装なので無料版の判定を使う。
    }
    try {
      const e = await withTimeout(prepare(), 30000);
      const r = await withTimeout(e.classify(img), 15000);
      const byId = (id) => window.FOODS.find((f) => f.id === id);
      const list = r.map((x) => ({ food: byId(x.id), score: x.score })).filter((x) => x.food);
      // 1位の料理と見た目が似ている料理（うどんとそば、寿司とさしみ等）を2番目に入れる
      if (list.length) {
        const like = (list[0].food.like || []).map(byId).filter(Boolean).map((food) => ({ food, score: 0 }));
        list.splice(1, 0, ...like);
      }
      const seen = new Set();
      return list.filter((x) => !seen.has(x.food.id) && seen.add(x.food.id)).slice(0, 3);
    } catch (err) {
      console.warn('判定できませんでした', err);
      return [];
    }
  }

  window.Recognizer = { recognize, prepare };
})();

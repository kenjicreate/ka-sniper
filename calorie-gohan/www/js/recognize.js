// 写真から料理名を当てる仕組み
// 無料版：スマホの中で判定（写真は外に送らない）
//   1) models/food/ に日本の料理用の判定データを置けば、それを優先して使う（将来の差し替え用）
//   2) なければ、一般的な画像判定（MobileNet）で分かる料理だけ当てる
// 有料版：外部のAIサービスで判定（あとで追加。ここに入り口だけ用意）
(function () {
  const TF_URL = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js';
  const MOBILENET_URL = 'https://cdn.jsdelivr.net/npm/@tensorflow-models/mobilenet@2.1.1/dist/mobilenet.min.js';
  let engine = null; // { classify(img) => [{ id, score }] }

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

  // 英語のラベル → 料理表の id
  const labelMap = {};
  for (const f of window.FOODS) for (const l of f.ml || []) labelMap[l.toLowerCase()] = f.id;

  async function customEngine() {
    // models/food/model.json と labels.json（料理表の id の並び）があれば使う
    const res = await fetch('models/food/labels.json').catch(() => null);
    if (!res || !res.ok) return null;
    const labels = await res.json();
    const model = await tf.loadGraphModel('models/food/model.json');
    return {
      async classify(img) {
        const x = tf.tidy(() => tf.image.resizeBilinear(tf.browser.fromPixels(img), [224, 224]).toFloat().div(255).expandDims());
        const out = await model.predict(x).data();
        x.dispose();
        return Array.from(out).map((score, i) => ({ id: labels[i], score }))
          .sort((a, b) => b.score - a.score).slice(0, 5);
      },
    };
  }

  async function mobilenetEngine() {
    await loadScript(MOBILENET_URL);
    const model = await mobilenet.load({ version: 2, alpha: 1.0 });
    return {
      async classify(img) {
        const preds = await model.classify(img, 10);
        const out = [];
        for (const p of preds) {
          // "cheeseburger, ..." のような名前を分けて照合
          for (const name of p.className.split(',').map((s) => s.trim().toLowerCase())) {
            const id = labelMap[name];
            if (id && !out.find((o) => o.id === id)) out.push({ id, score: p.probability });
          }
        }
        return out;
      },
    };
  }

  async function prepare() {
    if (engine) return engine;
    await loadScript(TF_URL);
    engine = (await customEngine().catch(() => null)) || (await mobilenetEngine());
    return engine;
  }

  // 戻り値: [{ food, score }]（見つからなければ空）
  async function recognize(img) {
    const s = window.Store.d.settings;
    if (s.plan === 'paid') {
      // 有料版はここで外部AIを呼ぶ予定（月の上限回数つき）。いまは未実装なので無料版の判定を使う。
    }
    try {
      const e = await withTimeout(prepare(), 20000);
      const r = await withTimeout(e.classify(img), 10000);
      return r.map((x) => ({ food: window.FOODS.find((f) => f.id === x.id), score: x.score }))
        .filter((x) => x.food).slice(0, 3);
    } catch (err) {
      console.warn('判定できませんでした', err);
      return [];
    }
  }

  window.Recognizer = { recognize, prepare };
})();

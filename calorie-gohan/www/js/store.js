// 記録の保存（スマホの中だけに保存。外には送らない）
(function () {
  const KEY = 'gohancho-v1';
  const blank = () => ({
    setup: false,
    settings: {
      chara: 'female',
      height: 155,       // cm
      goalKcal: 1600,
      goalSource: 'auto', // auto=おまかせ / self=自分で決めた / doctor=医師から指示
      saltGoal: 7.0,      // g
      waterGoal: 1500,    // ml
      fontScale: 1,
      lang: 'auto',       // auto=スマホに合わせる / ja / en
      notify: { on: false, times: ['07:30', '12:00', '18:30'] },
      plan: 'free',
      share: [],          // [{ name, role }] 本人が許可した人
    },
    meals: [],   // { id, date, time, slot, name, kcal, salt, portion, via }
    weights: [], // { date, kg }
    water: {},   // { 'YYYY-MM-DD': ml }
    ads: { lastFull: '' },
  });

  let data;
  try { data = JSON.parse(localStorage.getItem(KEY)) || blank(); } catch (e) { data = blank(); }
  // 新しい項目が増えても古いデータで困らないように補う
  const b = blank();
  data.settings = Object.assign(b.settings, data.settings || {});
  for (const k of ['meals', 'weights', 'water', 'ads']) if (!data[k]) data[k] = b[k];

  const prefs = () => window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Preferences;

  function save() {
    const json = JSON.stringify(data);
    try { localStorage.setItem(KEY, json); } catch (e) { console.warn(e); }
    // アプリ版では消えにくい場所にも控えを取る
    const p = prefs();
    if (p) p.set({ key: KEY, value: json }).catch(() => {});
  }

  // アプリ版：控えから戻す（ブラウザの保存が消えていた場合）
  async function restore() {
    const p = prefs();
    if (!p || data.setup) return false;
    try {
      const r = await p.get({ key: KEY });
      if (r && r.value) { data = JSON.parse(r.value); return true; }
    } catch (e) {}
    return false;
  }

  function reset() { data = blank(); save(); }

  window.Store = { get d() { return data; }, save, restore, reset };
})();

// 日付の小道具
window.Day = {
  key(d = new Date()) {
    const z = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
  },
  add(key, n) {
    const [y, m, d] = key.split('-').map(Number);
    return Day.key(new Date(y, m - 1, d + n));
  },
  label(key) { return window.I18N ? I18N.dateLabel(key) : key; },
};

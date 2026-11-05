// 広告（無料版のみ）
// アプリ版では AdMob の部品（@capacitor-community/admob）があれば本物の広告を出す。
// ブラウザで見ているときは、広告の場所だけ表示する。
(function () {
  // いまは Google が用意している「テスト用」の広告番号。公開前に自分の番号へ差し替える。
  const IDS = {
    banner: 'ca-app-pub-3940256099942544/2934735716',
    interstitial: 'ca-app-pub-3940256099942544/4411468910',
  };
  const plugin = () => window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.AdMob;
  const isFree = () => window.Store.d.settings.plan !== 'paid';
  let ready = false;

  async function init() {
    const p = plugin();
    if (!p || !isFree()) return;
    try { await p.initialize({}); ready = true; } catch (e) { console.warn(e); }
  }

  // 画面の下の細い広告
  async function showBanner() {
    const el = document.getElementById('adBar');
    // 最初の設定の途中は出さない
    const on = isFree() && window.Store.d.setup;
    el.hidden = !on;
    document.body.classList.toggle('has-ad', on);
    if (!on) { hideBanner(); return; }
    const p = plugin();
    if (p && ready) {
      el.classList.add('native');
      try { await p.showBanner({ adId: IDS.banner, adSize: 'BANNER', position: 'BOTTOM_CENTER', margin: 0 }); } catch (e) {}
    }
  }
  async function hideBanner() {
    const p = plugin();
    if (p && ready) try { await p.hideBanner(); } catch (e) {}
  }

  // 画面いっぱいの広告：1日1回まで。
  // 呼んでよいのは「記録後にキャラが反応した後」と「まとめを開いた時」だけ。
  async function maybeFullScreen() {
    if (!isFree()) return false;
    const d = window.Store.d;
    const today = window.Day.key();
    if (d.ads.lastFull === today) return false;
    d.ads.lastFull = today;
    window.Store.save();
    const p = plugin();
    if (p && ready) {
      try {
        await p.prepareInterstitial({ adId: IDS.interstitial });
        await p.showInterstitial();
        return true;
      } catch (e) { return false; }
    }
    return showMock();
  }

  // ブラウザ用の見本
  function showMock() {
    return new Promise((ok) => {
      const o = document.createElement('div');
      o.className = 'ad-full';
      o.innerHTML = '<div class="ad-full-box"><p class="ad-tag">広告</p><p>ここに広告が出ます</p><button class="btn">とじる</button></div>';
      o.querySelector('button').onclick = () => { o.remove(); ok(true); };
      document.body.appendChild(o);
    });
  }

  window.Ads = { init, showBanner, hideBanner, maybeFullScreen };
})();

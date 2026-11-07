// 広告（無料版のみ）
// アプリ版では AdMob（@capacitor-community/admob）で本物の広告を出す。
// ブラウザで見ているときは、広告の場所だけ表示する。
(function () {
  // ▼ AdMob の広告ユニット番号（AdMob の管理画面で作ったもの）
  //   （Google のテスト用番号 ca-app-pub-3940256099942544/… にすると、本物の広告は出ない・収益なし）
  const IDS = {
    banner: 'ca-app-pub-9222119240854607/8910813079',       // 画面下の細い広告（バナー）「ホーム下のバナー」
    interstitial: 'ca-app-pub-9222119240854607/7716170969', // 画面いっぱいの広告（インタースティシャル）「記録後の全画面」
  };
  const TESTING = IDS.banner.startsWith('ca-app-pub-3940256099942544');

  // 画面いっぱいの広告を出してよい画面（入力の途中や写真を撮る前には出さない）
  const FULL_OK_SCREENS = ['home', 'summary'];

  const plugin = () => window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.AdMob;
  const isFree = () => window.Store.d.settings.plan !== 'paid';
  let ready = false;       // AdMob の準備ができた
  let fullReady = false;   // 画面いっぱいの広告を読みこみ済み
  let fullLoading = false;
  let bannerShown = false;

  async function init() {
    const p = plugin();
    if (!p || !isFree()) return;
    try {
      await p.initialize({ initializeForTesting: TESTING });
      ready = true;
      p.addListener('interstitialAdDismissed', () => { fullReady = false; preloadFull(); });
      p.addListener('interstitialAdFailedToShow', () => { fullReady = false; preloadFull(); });
      preloadFull();
    } catch (e) { console.warn(e); }
  }

  // 画面いっぱいの広告を先に読みこんでおく（出すときに待たせない・入力中に割りこまない）
  async function preloadFull() {
    const p = plugin();
    if (!p || !ready || fullReady || fullLoading || !isFree()) return;
    fullLoading = true;
    try { await p.prepareInterstitial({ adId: IDS.interstitial, isTesting: TESTING }); fullReady = true; }
    catch (e) { fullReady = false; }
    fullLoading = false;
  }

  // 画面の下の細い広告
  async function showBanner() {
    const el = document.getElementById('adBar');
    refreshText();
    // 最初の設定の途中は出さない
    const on = isFree() && window.Store.d.setup;
    el.hidden = !on;
    document.body.classList.toggle('has-ad', on);
    const p = plugin();
    if (!p || !ready) return;
    if (!on) { if (bannerShown) { try { await p.hideBanner(); } catch (e) {} } return; }
    el.classList.add('native');
    try {
      if (bannerShown) await p.resumeBanner();
      else await p.showBanner({ adId: IDS.banner, adSize: 'ADAPTIVE_BANNER', position: 'BOTTOM_CENTER', margin: 0, isTesting: TESTING });
      bannerShown = true;
    } catch (e) { console.warn(e); }
  }

  // 画面いっぱいの広告：1日1回まで。
  // 呼んでよいのは「記録後にキャラが反応した後」と「まとめを開いた時」だけ。
  async function maybeFullScreen() {
    if (!isFree()) return false;
    const d = window.Store.d;
    const today = window.Day.key();
    if (d.ads.lastFull === today) return false;
    const screen = window.App && window.App.state.screen;
    if (!FULL_OK_SCREENS.includes(screen)) return false;
    const p = plugin();
    if (p) {
      if (!ready || !fullReady) { preloadFull(); return false; } // 読みこめていなければ今日は出さない（次の機会に）
      d.ads.lastFull = today; window.Store.save();
      try { await p.showInterstitial(); return true; } catch (e) { return false; }
    }
    d.ads.lastFull = today; window.Store.save();
    return showMock();
  }

  // ブラウザ用の見本
  function showMock() {
    return new Promise((ok) => {
      const o = document.createElement('div');
      o.className = 'ad-full';
      o.innerHTML = `<div class="ad-full-box"><p class="ad-tag">${I18N.t('ad.label')}</p><p>${I18N.t('ad.mock')}</p><button class="btn">${I18N.t('ad.close')}</button></div>`;
      o.querySelector('button').onclick = () => { o.remove(); ok(true); };
      document.body.appendChild(o);
    });
  }

  // 広告の場所の「広告」の文字を今の言語に
  function refreshText() { const sp = document.querySelector('#adBar span'); if (sp) sp.textContent = I18N.t('ad.label'); }

  window.Ads = { init, showBanner, maybeFullScreen, refreshText, TESTING };
})();

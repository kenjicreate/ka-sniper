// キャラクター（絵は www/img/chara/ にある）
// 絵を差し替えるときは、同じ名前の画像を置きかえるだけでOK。
//   {種類}-normal.png    ふつう
//   {種類}-energetic.png ちょうど良い日（ニコニコ・元気いっぱい）
//   {種類}-gained.png    食べすぎた日（お腹パンパン）
//   {種類}-lost.png      体重が減った（引きしまった）
//   {種類}-sick.png      痩せすぎ（元気がない）
(function () {
  const TYPES = {
    male:   { label: '男の人' },
    female: { label: '女の人' },
    bear:   { label: 'くま' },
  };

  // 気分 → 絵
  const IMG_OF = { normal: 'normal', happy: 'energetic', full: 'gained', slim: 'lost', weak: 'sick', hungry: 'normal', peckish: 'normal' };

  // 前のバージョンで選べた「いぬ・ねこ」は、くまに置きかえる
  const fix = (type) => (TYPES[type] ? type : 'bear');

  // build: 体格（0.72=細い 〜 1.45=ふっくら） / mood: happy, normal, full, hungry, weak, slim
  // 関数名は前のままにしてある（中身は画像）
  function svg(type, opt = {}) {
    const t = fix(type);
    const mood = opt.mood || 'normal';
    const build = opt.build || 1;
    // 体重に合わせて横幅を少しだけ変える（絵がくずれない程度）
    const sx = Math.max(0.88, Math.min(1.15, 1 + (build - 1) * 0.4));
    let h = `<div class="chara mood-${mood}" role="img" aria-label="${window.I18N ? I18N.t('chara.label', { name: I18N.t('chara.' + t) }) : TYPES[t].label}">`;
    h += `<img src="img/chara/${t}-${IMG_OF[mood] || 'normal'}.png" alt="" style="transform:scaleX(${sx.toFixed(3)})" draggable="false">`;
    if (mood === 'hungry') h += `<span class="guu">${window.I18N ? I18N.t('chara.growl') : 'グ〜'}</span>`;
    h += '</div>';
    return h;
  }

  // 体重から体格を決める（BMI 22 を標準とする）
  function buildFromBMI(bmi) {
    if (!bmi) return 1;
    return Math.max(0.72, Math.min(1.45, 1 + (bmi - 22) * 0.06));
  }

  window.Chara = { TYPES, svg, buildFromBMI, fix };
})();

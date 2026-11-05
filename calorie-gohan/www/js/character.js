// キャラクター（丸と線のシンプルな絵）
// 後で絵を差し替えるときは、このファイルの Chara.svg を画像を返すように変えるだけでOK。
(function () {
  const TYPES = {
    male:   { label: '男の人', skin: '#FFE0C2', body: '#F28C38', hair: '#5A3E2B' },
    female: { label: '女の人', skin: '#FFE0C2', body: '#F47C9B', hair: '#7A4A2E' },
    dog:    { label: 'いぬ',   skin: '#E8B57E', body: '#E8B57E', hair: '#9C6B3F' },
    cat:    { label: 'ねこ',   skin: '#F7C58B', body: '#F7C58B', hair: '#E39A4B' },
  };

  // build: 体格（0.75=細い 〜 1.45=ふっくら） / mood: happy, normal, full, hungry, weak
  function svg(type, opt = {}) {
    const t = TYPES[type] || TYPES.female;
    const build = opt.build || 1;
    const mood = opt.mood || 'normal';
    const weak = mood === 'weak';
    const pale = (c) => (weak ? mix(c, '#CFCFCF', 0.45) : c);
    const skin = pale(t.skin), body = pale(t.body), hair = pale(t.hair);
    const line = '#4A3426';
    const animal = type === 'dog' || type === 'cat';

    const bw = 44 * build;                    // 体の横幅
    const belly = mood === 'full' ? 1.25 : 1; // 食べすぎるとお腹パンパン
    const tilt = weak ? 'rotate(-8 100 120)' : '';
    const hy = weak ? 84 : 78;                // 頭の位置（元気がないとうなだれる）

    let s = `<svg viewBox="0 0 200 230" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${t.label}のキャラクター" class="chara mood-${mood}">`;
    s += `<ellipse cx="100" cy="218" rx="${bw + 10}" ry="7" fill="#000" opacity=".08"/>`;
    s += `<g transform="${tilt}">`;

    // 足
    s += `<line x1="${100 - bw * 0.45}" y1="190" x2="${100 - bw * 0.5}" y2="212" stroke="${line}" stroke-width="6" stroke-linecap="round"/>`;
    s += `<line x1="${100 + bw * 0.45}" y1="190" x2="${100 + bw * 0.5}" y2="212" stroke="${line}" stroke-width="6" stroke-linecap="round"/>`;
    // 腕
    const armY = weak ? 168 : 150;
    s += `<line x1="${100 - bw * 0.9}" y1="140" x2="${100 - bw * 1.25}" y2="${armY}" stroke="${line}" stroke-width="6" stroke-linecap="round"/>`;
    s += `<line x1="${100 + bw * 0.9}" y1="140" x2="${100 + bw * 1.25}" y2="${armY}" stroke="${line}" stroke-width="6" stroke-linecap="round"/>`;
    // 体
    s += `<ellipse cx="100" cy="160" rx="${bw}" ry="38" fill="${body}" stroke="${line}" stroke-width="4"/>`;
    // お腹
    const brx = bw * 0.62 * belly, bry = 24 * belly;
    s += `<ellipse cx="100" cy="${166 + (belly - 1) * 8}" rx="${brx}" ry="${bry}" fill="${animal ? '#FFF3E0' : mix(body, '#FFFFFF', 0.45)}" stroke="${mood === 'full' ? line : 'none'}" stroke-width="2"/>`;
    if (!animal && type === 'female') {
      s += `<path d="M ${100 - bw * 0.6} 128 Q 100 140 ${100 + bw * 0.6} 128" stroke="${line}" stroke-width="3" fill="none"/>`;
    }

    // 頭
    if (type === 'cat') {
      s += `<path d="M 62 ${hy - 22} L 68 ${hy - 62} L 92 ${hy - 38} Z" fill="${hair}" stroke="${line}" stroke-width="4" stroke-linejoin="round"/>`;
      s += `<path d="M 138 ${hy - 22} L 132 ${hy - 62} L 108 ${hy - 38} Z" fill="${hair}" stroke="${line}" stroke-width="4" stroke-linejoin="round"/>`;
    }
    if (type === 'dog') {
      const ed = weak ? 18 : 8;
      s += `<ellipse cx="58" cy="${hy - 8 + ed}" rx="14" ry="28" fill="${hair}" stroke="${line}" stroke-width="4" transform="rotate(20 58 ${hy})"/>`;
      s += `<ellipse cx="142" cy="${hy - 8 + ed}" rx="14" ry="28" fill="${hair}" stroke="${line}" stroke-width="4" transform="rotate(-20 142 ${hy})"/>`;
    }
    if (type === 'female') {
      s += `<ellipse cx="62" cy="${hy + 12}" rx="14" ry="26" fill="${hair}" stroke="${line}" stroke-width="4"/>`;
      s += `<ellipse cx="138" cy="${hy + 12}" rx="14" ry="26" fill="${hair}" stroke="${line}" stroke-width="4"/>`;
    }
    s += `<circle cx="100" cy="${hy}" r="44" fill="${skin}" stroke="${line}" stroke-width="4"/>`;
    if (type === 'male') {
      s += `<path d="M 57 ${hy - 6} Q 60 ${hy - 50} 100 ${hy - 46} Q 142 ${hy - 50} 143 ${hy - 6} Q 128 ${hy - 26} 100 ${hy - 26} Q 72 ${hy - 26} 57 ${hy - 6} Z" fill="${hair}" stroke="${line}" stroke-width="4" stroke-linejoin="round"/>`;
    }
    if (type === 'female') {
      s += `<path d="M 57 ${hy} Q 56 ${hy - 50} 100 ${hy - 46} Q 144 ${hy - 50} 143 ${hy} Q 130 ${hy - 30} 100 ${hy - 32} Q 70 ${hy - 30} 57 ${hy} Z" fill="${hair}" stroke="${line}" stroke-width="4" stroke-linejoin="round"/>`;
      s += `<circle cx="132" cy="${hy - 34}" r="9" fill="#FF6F61" stroke="${line}" stroke-width="3"/>`;
    }

    // 顔
    s += face(mood, hy, line, animal);
    if (animal) {
      s += `<ellipse cx="100" cy="${hy + 10}" rx="7" ry="5" fill="${line}"/>`;
      if (type === 'cat') {
        for (const [x1, x2, dy] of [[70, 50, -4], [70, 50, 6], [130, 150, -4], [130, 150, 6]]) {
          s += `<line x1="${x1}" y1="${hy + 14}" x2="${x2}" y2="${hy + 14 + dy}" stroke="${line}" stroke-width="2.5" stroke-linecap="round"/>`;
        }
      }
    }
    s += `</g>`;

    // 気分に合わせた飾り
    if (mood === 'full') {
      s += `<path class="sweat" d="M 156 60 q 6 10 0 14 q -6 -4 0 -14 Z" fill="#7EC8F0"/>`;
      s += `<path class="sweat" d="M 40 78 q 5 8 0 11 q -5 -3 0 -11 Z" fill="#7EC8F0"/>`;
    }
    if (mood === 'hungry') {
      s += `<text x="${100 + bw + 6}" y="176" font-size="22" font-weight="800" fill="#C2410C" class="guu">グ〜</text>`;
    }
    if (mood === 'happy') {
      s += `<text x="160" y="44" font-size="22" fill="#F28C38" class="sparkle">♪</text>`;
    }
    if (weak) {
      s += `<path d="M 150 40 q 8 -8 16 0 q 8 8 16 0" stroke="#9AA4B2" stroke-width="3" fill="none"/>`;
    }
    s += `</svg>`;
    return s;
  }

  function face(mood, hy, line, animal) {
    const ey = hy - 4, lx = 82, rx = 118, my = hy + (animal ? 22 : 16);
    let f = '';
    const cheek = (op) => `<circle cx="68" cy="${hy + 12}" r="8" fill="#FF8A8A" opacity="${op}"/><circle cx="132" cy="${hy + 12}" r="8" fill="#FF8A8A" opacity="${op}"/>`;
    if (mood === 'happy') {
      f += `<path d="M ${lx - 8} ${ey + 3} Q ${lx} ${ey - 7} ${lx + 8} ${ey + 3}" stroke="${line}" stroke-width="4" fill="none" stroke-linecap="round"/>`;
      f += `<path d="M ${rx - 8} ${ey + 3} Q ${rx} ${ey - 7} ${rx + 8} ${ey + 3}" stroke="${line}" stroke-width="4" fill="none" stroke-linecap="round"/>`;
      f += `<path d="M 86 ${my} Q 100 ${my + 16} 114 ${my}" stroke="${line}" stroke-width="4" fill="#FF8A80" stroke-linecap="round"/>`;
      f += cheek(0.7);
    } else if (mood === 'full') {
      f += `<path d="M ${lx - 7} ${ey - 6} L ${lx + 5} ${ey} L ${lx - 7} ${ey + 6}" stroke="${line}" stroke-width="4" fill="none" stroke-linecap="round"/>`;
      f += `<path d="M ${rx + 7} ${ey - 6} L ${rx - 5} ${ey} L ${rx + 7} ${ey + 6}" stroke="${line}" stroke-width="4" fill="none" stroke-linecap="round"/>`;
      f += `<path d="M 86 ${my + 2} q 4.6 -6 9.3 0 q 4.6 6 9.3 0 q 4.6 -6 9.3 0" stroke="${line}" stroke-width="4" fill="none" stroke-linecap="round"/>`;
      f += cheek(0.9);
    } else if (mood === 'hungry') {
      f += `<circle cx="${lx}" cy="${ey}" r="5" fill="${line}"/><circle cx="${rx}" cy="${ey}" r="5" fill="${line}"/>`;
      f += `<ellipse cx="100" cy="${my + 2}" rx="6" ry="7" fill="${line}"/>`;
      f += cheek(0.4);
    } else if (mood === 'weak') {
      f += `<line x1="${lx - 8}" y1="${ey + 2}" x2="${lx + 8}" y2="${ey + 4}" stroke="${line}" stroke-width="4" stroke-linecap="round"/>`;
      f += `<line x1="${rx - 8}" y1="${ey + 4}" x2="${rx + 8}" y2="${ey + 2}" stroke="${line}" stroke-width="4" stroke-linecap="round"/>`;
      f += `<path d="M 88 ${my + 4} Q 100 ${my - 4} 112 ${my + 4}" stroke="${line}" stroke-width="4" fill="none" stroke-linecap="round"/>`;
    } else {
      f += `<circle cx="${lx}" cy="${ey}" r="5.5" fill="${line}"/><circle cx="${rx}" cy="${ey}" r="5.5" fill="${line}"/>`;
      f += `<path d="M 90 ${my} Q 100 ${my + 9} 110 ${my}" stroke="${line}" stroke-width="4" fill="none" stroke-linecap="round"/>`;
      f += cheek(0.5);
    }
    return f;
  }

  function mix(a, b, t) {
    const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const [x, y] = [p(a), p(b)];
    return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('');
  }

  // 体重から体格を決める（BMI 22 を標準とする）
  function buildFromBMI(bmi) {
    if (!bmi) return 1;
    return Math.max(0.72, Math.min(1.45, 1 + (bmi - 22) * 0.06));
  }

  window.Chara = { TYPES, svg, buildFromBMI };
})();

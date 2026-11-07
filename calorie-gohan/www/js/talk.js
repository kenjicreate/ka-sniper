// キャラクターのせりふ
// その時の状況（時間・食べた量・塩分・水分・連続記録・季節など）に合ったせりふを選ぶ。
// せりふを増やす・変えるときは、このファイルの文だけ直せばOK。
(function () {
  let last = '';
  const pick = (list) => {
    const c = list.filter((t) => t && t !== last);
    const t = (c.length ? c : list)[Math.floor(Math.random() * (c.length || list.length))];
    last = t;
    return t;
  };
  const n0 = (v) => Math.round(v).toLocaleString('ja-JP');

  // c: { mood, hour, month, weekday, eaten, goal, left, slots, streak, salt, saltGoal,
  //      water, waterGoal, daysSinceWeight, doctor, firstTime }
  function home(c) {
    // 1. 体の調子にかかわることを最優先
    if (c.mood === 'weak') {
      return pick(['ちょっと元気が出ないな…', '痩せすぎかも。しっかり食べてね', '無理なダイエットはやめようね', 'ごはんをちゃんと食べると元気が出るよ', 'お腹がすいて力が出ないよ〜']);
    }
    if (c.mood === 'full') {
      return pick(['お腹パンパン…', '食べすぎちゃったかも…', '苦しい〜。明日また調整しよう', '今日はもうごちそうさまにしようね', '食べすぎた日もあるよね。気にしすぎないで']);
    }
    if (c.firstTime) {
      return pick(['はじめまして！ごはんの写真を撮ってみてね', 'よろしくね！食べたら写真を撮ってみよう']);
    }

    const pool = [];
    const add = (w, lines) => { for (let i = 0; i < w; i++) pool.push(...lines); };

    // 2. お腹のすき具合
    if (c.mood === 'hungry') {
      add(3, ['お腹がグ〜って鳴ってるよ', 'そろそろ何か食べよう？', 'ちょっとお腹すいたな…', 'ごはん、まだかな〜']);
    } else if (c.mood === 'slim') {
      add(2, ['体重が減ったね！その調子', 'からだが軽くなったよ', 'がんばってるね！でも無理はしないでね']);
    } else if (c.eaten > 0) {
      add(2, ['いい感じ！', 'ちょうどいいペースだね', 'ニコニコだよ♪', 'この調子でいこうね']);
    }

    // 3. 時間帯
    const h = c.hour;
    if (h >= 4 && h < 10) {
      add(2, ['おはよう！今日もよろしくね', '朝ごはんは食べた？', '朝の一杯のお水、おすすめだよ', '今日もいい1日になりますように']);
    } else if (h < 12) {
      add(1, c.slots.has('朝ごはん') ? ['お昼は何にしようかな', 'ひと休みしてね'] : ['朝ごはん、まだみたい。何か食べた？', 'お昼は何にしようかな']);
    } else if (h < 15) {
      add(1, c.slots.has('昼ごはん') ? ['お昼ごはん、おいしかった？', '午後もがんばろうね'] : ['お昼ごはんの時間だね', 'お昼はもう食べた？']);
    } else if (h < 17) {
      add(1, ['おやつの時間かな？食べすぎ注意だよ', 'ひと休みしよう', '午後もおつかれさま']);
    } else if (h < 21) {
      add(1, c.slots.has('夜ごはん') ? ['今日もおつかれさま', 'ゆっくり休んでね'] : ['夜ごはんは何かな？', '今日もおつかれさま']);
    } else {
      add(1, ['夜おそくの食事は控えめにね', 'そろそろおやすみの時間だね', '今日もよくがんばったね', 'ぐっすり眠ってね']);
    }

    // 4. 残りのカロリー
    if (c.left > 0 && c.left < 400 && h < 19) add(2, [`残り ${n0(c.left)} kcal。次は軽めがいいかも`]);
    if (c.left >= 400 && h >= 17 && c.eaten > 0) add(1, [`あと ${n0(c.left)} kcal 食べられるよ`]);

    // 5. 塩分・水分
    if (c.salt > c.saltGoal) add(3, ['今日は塩分が多めだよ', '汁ものは残すと塩分が減るよ', 'しょっぱい物は少し控えめにね']);
    if (h >= 14 && c.water < c.waterGoal * 0.4) add(2, ['お水、飲んでる？こまめに飲もうね', 'のどがかわく前にお水を飲もうね']);
    if (c.water >= c.waterGoal) add(1, ['お水をしっかり飲めてえらい！']);

    // 6. 続けていること
    if (c.streak >= 2) add(c.streak % 7 === 0 ? 4 : 1, [c.streak % 7 === 0 ? `${c.streak}日連続！すごい、よく続いてるね` : `${c.streak}日連続で記録中！`]);
    if (c.daysSinceWeight === null || c.daysSinceWeight >= 7) add(1, ['そろそろ体重もはかってみる？']);
    if (c.doctor) add(1, ['先生の目標、一緒に守ろうね']);

    // 7. 季節・曜日
    const m = c.month;
    if (m === 12 || m <= 2) add(1, ['寒いね。温かいものがおいしい季節だね', '風邪に気をつけてね']);
    else if (m <= 5) add(1, ['春だね。お散歩日和かな？']);
    else if (m <= 8) add(1, ['暑いね。水分をしっかりとってね', '夏バテに気をつけてね']);
    else add(1, ['食欲の秋だね。食べすぎ注意！', '秋はおいしいものがいっぱいだね']);
    if (c.weekday === 0 || c.weekday === 6) add(1, ['週末だね。のんびりしよう']);

    add(1, ['今日もよろしくね', '何を食べるのかな？']);
    return pick(pool);
  }

  // 記録した直後のせりふ
  // meal: { name, kcal, salt, portion, foodId, cat }
  function afterMeal(c, meal) {
    if (c.mood === 'full') {
      return pick(['ごちそうさま…お腹パンパンだよ〜', 'ごちそうさま。今日はこれくらいにしようね']);
    }
    const first = pick(['ごちそうさま！', 'おいしかった？', '記録できたね！', 'いただきました！']);
    const id = meal.foodId;
    let note = '';
    if (['ramen', 'udon', 'soba'].includes(id)) note = 'スープを残すと塩分が減るよ';
    else if (meal.salt >= 4) note = '塩分が多めだから、お水も飲もうね';
    else if (['beer', 'wine', 'sake'].includes(id)) note = 'お酒はほどほどにね';
    else if (meal.cat === 'おやつ') note = 'おやつもたまにはいいよね♪';
    else if (['salad', 'ohitashi', 'nimono', 'misoshiru', 'tonjiru'].includes(id)) note = '野菜がとれてえらい！';
    else if (meal.portion === '大盛り') note = '大盛りだね！';
    else if (meal.portion === '小盛り') note = '小盛りにしたんだね';
    const left = c.left >= 0 ? `あと ${n0(c.left)} kcal だよ` : '今日はこれくらいにしようね';
    return [first, note, left].filter(Boolean).join(' ');
  }

  window.Talk = { home, afterMeal };
})();

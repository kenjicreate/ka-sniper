// キャラクターのせりふ（日本語・英語）
// その時の状況（時間・食べた量・塩分・水分・連続記録・季節など）に合ったせりふを選ぶ。
// せりふを増やす・変えるときは、下の LINES の文だけ直せばOK（日本語は ja、英語は en）。
// {n} {kcal} {h} は、その時の数字に置きかわる。
(function () {
  const LINES = {
    ja: {
      weak: ['ちょっと元気が出ないな…', '痩せすぎかも。しっかり食べてね', '無理なダイエットはやめようね', 'ごはんをちゃんと食べると元気が出るよ', 'お腹がすいて力が出ないよ〜'],
      full: ['お腹パンパン…', '食べすぎちゃったかも…', '苦しい〜。明日また調整しよう', '今日はもうごちそうさまにしようね', '食べすぎた日もあるよね。気にしすぎないで'],
      first: ['はじめまして！ごはんの写真を撮ってみてね', 'よろしくね！食べたら写真を撮ってみよう'],
      hungry: ['お腹がグ〜って鳴ってるよ', 'そろそろ何か食べよう？', 'ごはん、まだかな〜'],
      hungryHours: ['前のごはんから{h}時間たったよ'],
      hungryLowDay: ['今日はちょっと少なめだよ。しっかり食べよう'],
      peckish: ['ちょっとお腹すいてきたかも', 'そろそろ次のごはんかな？', 'お腹が少しすいてきたよ'],
      justAte: ['お腹いっぱい。しあわせ〜', 'おいしかったね♪', 'ちょうどいい感じだよ'],
      slim: ['体重が減ったね！その調子', 'からだが軽くなったよ', 'がんばってるね！でも無理はしないでね'],
      onTrack: ['いい感じ！', 'ちょうどいいペースだね', 'ニコニコだよ♪', 'この調子でいこうね'],
      morning: ['おはよう！今日もよろしくね', '朝ごはんは食べた？', '朝の一杯のお水、おすすめだよ', '今日もいい1日になりますように'],
      lateMorningAte: ['お昼は何にしようかな', 'ひと休みしてね'],
      lateMorningNot: ['朝ごはん、まだみたい。何か食べた？', 'お昼は何にしようかな'],
      noonAte: ['お昼ごはん、おいしかった？', '午後もがんばろうね'],
      noonNot: ['お昼ごはんの時間だね', 'お昼はもう食べた？'],
      afternoon: ['おやつの時間かな？食べすぎ注意だよ', 'ひと休みしよう', '午後もおつかれさま'],
      eveningAte: ['今日もおつかれさま', 'ゆっくり休んでね'],
      eveningNot: ['夜ごはんは何かな？', '今日もおつかれさま'],
      night: ['夜おそくの食事は控えめにね', 'そろそろおやすみの時間だね', '今日もよくがんばったね', 'ぐっすり眠ってね'],
      leftSmall: ['残り {kcal} kcal。次は軽めがいいかも'],
      leftBig: ['あと {kcal} kcal 食べられるよ'],
      salty: ['今日は塩分が多めだよ', '汁ものは残すと塩分が減るよ', 'しょっぱい物は少し控えめにね'],
      thirsty: ['お水、飲んでる？こまめに飲もうね', 'のどがかわく前にお水を飲もうね'],
      watered: ['お水をしっかり飲めてえらい！'],
      streakWeek: ['{n}日連続！すごい、よく続いてるね'],
      streak: ['{n}日連続で記録中！'],
      weighIn: ['そろそろ体重もはかってみる？'],
      doctor: ['先生の目標、一緒に守ろうね'],
      winter: ['寒いね。温かいものがおいしい季節だね', '風邪に気をつけてね'],
      spring: ['春だね。お散歩日和かな？'],
      summer: ['暑いね。水分をしっかりとってね', '夏バテに気をつけてね'],
      autumn: ['食欲の秋だね。食べすぎ注意！', '秋はおいしいものがいっぱいだね'],
      weekend: ['週末だね。のんびりしよう'],
      anytime: ['今日もよろしくね', '何を食べるのかな？'],
      // 記録した直後
      afterFull: ['ごちそうさま…お腹パンパンだよ〜', 'ごちそうさま。今日はこれくらいにしようね'],
      afterFirst: ['ごちそうさま！', 'おいしかった？', '記録できたね！', 'いただきました！'],
      noteSoup: 'スープを残すと塩分が減るよ',
      noteSalty: '塩分が多めだから、お水も飲もうね',
      noteAlcohol: 'お酒はほどほどにね',
      noteSweets: 'おやつもたまにはいいよね♪',
      noteVeg: '野菜がとれてえらい！',
      noteLarge: '大盛りだね！',
      noteSmall: '小盛りにしたんだね',
      afterLeft: 'あと {kcal} kcal だよ',
      afterOver: '今日はこれくらいにしようね',
    },
    en: {
      weak: ["I'm feeling a bit weak…", 'You might be too thin. Please eat well', "Let's not overdo the dieting", 'Eating properly gives you energy', "I'm so hungry I can't move…"],
      full: ["I'm stuffed…", 'Maybe I ate too much…', 'Oof! We can balance it out tomorrow', "Let's call it a day for food", "Everyone overeats sometimes. Don't worry too much"],
      first: ['Nice to meet you! Try taking a photo of your meal', "Hi there! Snap a photo after you eat"],
      hungry: ['My tummy is rumbling!', 'Time to eat something?', 'Is it mealtime yet?'],
      hungryHours: ["It's been {h} hours since your last meal"],
      hungryLowDay: ["You haven't eaten much today. Let's have a proper meal"],
      peckish: ["I'm getting a little hungry", 'Next meal soon?', 'My tummy is starting to rumble'],
      justAte: ['So full and happy!', 'That was tasty ♪', 'Feeling just right'],
      slim: ['Your weight went down! Keep it up', 'I feel lighter!', "Great work! But don't push too hard"],
      onTrack: ['Looking good!', "You're at a nice pace", 'All smiles ♪', "Let's keep this up"],
      morning: ["Good morning! Let's have a good day", 'Did you have breakfast?', 'A glass of water in the morning is a good idea', 'Hope today is a great day'],
      lateMorningAte: ["What's for lunch?", 'Take a little break'],
      lateMorningNot: ["Looks like no breakfast yet. Did you eat?", "What's for lunch?"],
      noonAte: ['Was lunch tasty?', "Let's do our best this afternoon"],
      noonNot: ["It's lunchtime", 'Have you had lunch?'],
      afternoon: ["Snack time? Don't overdo it", "Let's take a break", 'Good job this afternoon'],
      eveningAte: ['Well done today', 'Have a good rest'],
      eveningNot: ["What's for dinner?", 'Well done today'],
      night: ['Go easy on late-night eating', 'Almost bedtime', 'You did great today', 'Sleep well'],
      leftSmall: ['{kcal} kcal left. Something light next, maybe?'],
      leftBig: ['You can still have {kcal} kcal'],
      salty: ['A bit salty today', 'Leaving the soup helps cut salt', "Let's go easy on salty food"],
      thirsty: ['Drinking enough water? Little and often!', "Drink water before you're thirsty"],
      watered: ['Great job drinking your water!'],
      streakWeek: ['{n} days in a row! Amazing'],
      streak: ['{n}-day logging streak!'],
      weighIn: ['Time to check your weight?'],
      doctor: ["Let's stick to your doctor's goal together"],
      winter: ["It's cold. Warm food tastes great now", "Don't catch a cold"],
      spring: ["It's spring. Nice day for a walk?"],
      summer: ["It's hot. Drink plenty of water", "Don't let the heat wear you out"],
      autumn: ["Autumn appetite! Careful not to overeat", 'So much good food in autumn'],
      weekend: ["It's the weekend. Take it easy"],
      anytime: ["Let's have a good day", 'What will you eat today?'],
      afterFull: ["Thanks for the meal… I'm stuffed!", "Let's stop here for today"],
      afterFirst: ['Thanks for the meal!', 'Was it tasty?', 'Logged!', 'Yum!'],
      noteSoup: 'Leaving the soup cuts salt.',
      noteSalty: "That's salty, so drink some water too.",
      noteAlcohol: 'Go easy on the alcohol.',
      noteSweets: 'A treat now and then is fine ♪',
      noteVeg: 'Nice, you got your veggies!',
      noteLarge: 'A large portion!',
      noteSmall: 'You went for a small portion.',
      afterLeft: '{kcal} kcal left.',
      afterOver: "Let's stop here for today.",
    },
  };

  let last = '';
  const pick = (list) => {
    const c = list.filter((x) => x && x !== last);
    const x = (c.length ? c : list)[Math.floor(Math.random() * (c.length || list.length))];
    last = x;
    return x;
  };
  const L = () => LINES[window.I18N ? I18N.lang() : 'ja'] || LINES.ja;
  const fill = (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => (v[k] !== undefined ? v[k] : ''));
  const num = (v) => (window.I18N ? I18N.num(v) : Math.round(v));

  // c: { mood, hour, month, weekday, eaten, goal, left, slots, streak, salt, saltGoal,
  //      water, waterGoal, daysSinceWeight, doctor, firstTime, hoursSince }
  function home(c) {
    const T = L();
    // 1. 体の調子にかかわることを最優先
    if (c.mood === 'weak') return pick(T.weak);
    if (c.mood === 'full') return pick(T.full);
    if (c.firstTime) return pick(T.first);

    const pool = [];
    const add = (w, lines, v = {}) => { for (let i = 0; i < w; i++) pool.push(...lines.map((s) => fill(s, v))); };

    // 2. お腹のすき具合
    if (c.mood === 'hungry') {
      add(3, T.hungry);
      if (c.hoursSince !== null && c.hoursSince >= 4) add(3, T.hungryHours, { h: Math.floor(c.hoursSince) });
      if (c.hour >= 19 && c.eaten < c.goal * 0.6) add(3, T.hungryLowDay);
    } else if (c.mood === 'peckish') {
      add(3, T.peckish);
    } else if (c.mood === 'happy' && c.hoursSince !== null && c.hoursSince < 1.5) {
      add(3, T.justAte);
    } else if (c.mood === 'slim') {
      add(2, T.slim);
    } else if (c.eaten > 0) {
      add(2, T.onTrack);
    }

    // 3. 時間帯（c.slots には「朝ごはん」などの区分が入っている）
    const h = c.hour;
    if (h >= 4 && h < 10) add(2, T.morning);
    else if (h < 12) add(1, c.slots.has('朝ごはん') ? T.lateMorningAte : T.lateMorningNot);
    else if (h < 15) add(1, c.slots.has('昼ごはん') ? T.noonAte : T.noonNot);
    else if (h < 17) add(1, T.afternoon);
    else if (h < 21) add(1, c.slots.has('夜ごはん') ? T.eveningAte : T.eveningNot);
    else add(1, T.night);

    // 4. 残りのカロリー
    if (c.left > 0 && c.left < 400 && h < 19) add(2, T.leftSmall, { kcal: num(c.left) });
    if (c.left >= 400 && h >= 17 && c.eaten > 0) add(1, T.leftBig, { kcal: num(c.left) });

    // 5. 塩分・水分
    if (c.salt > c.saltGoal) add(3, T.salty);
    if (h >= 14 && c.water < c.waterGoal * 0.4) add(2, T.thirsty);
    if (c.water >= c.waterGoal) add(1, T.watered);

    // 6. 続けていること
    if (c.streak >= 2) {
      if (c.streak % 7 === 0) add(4, T.streakWeek, { n: c.streak });
      else add(1, T.streak, { n: c.streak });
    }
    if (c.daysSinceWeight === null || c.daysSinceWeight >= 7) add(1, T.weighIn);
    if (c.doctor) add(1, T.doctor);

    // 7. 季節・曜日
    const m = c.month;
    if (m === 12 || m <= 2) add(1, T.winter);
    else if (m <= 5) add(1, T.spring);
    else if (m <= 8) add(1, T.summer);
    else add(1, T.autumn);
    if (c.weekday === 0 || c.weekday === 6) add(1, T.weekend);

    add(1, T.anytime);
    return pick(pool);
  }

  // 記録した直後のせりふ
  // meal: { name, kcal, salt, portion（small/normal/large）, foodId, cat }
  function afterMeal(c, meal) {
    const T = L();
    if (c.mood === 'full') return pick(T.afterFull);
    const first = pick(T.afterFirst);
    const id = meal.foodId;
    let note = '';
    if (['ramen', 'udon', 'soba'].includes(id)) note = T.noteSoup;
    else if (meal.salt >= 4) note = T.noteSalty;
    else if (['beer', 'wine', 'sake'].includes(id)) note = T.noteAlcohol;
    else if (meal.cat === 'おやつ') note = T.noteSweets;
    else if (['salad', 'ohitashi', 'nimono', 'misoshiru', 'tonjiru'].includes(id)) note = T.noteVeg;
    else if (meal.portion === 'large' || meal.portion === '大盛り') note = T.noteLarge;
    else if (meal.portion === 'small' || meal.portion === '小盛り') note = T.noteSmall;
    const left = c.left >= 0 ? fill(T.afterLeft, { kcal: num(c.left) }) : T.afterOver;
    return [first, note, left].filter(Boolean).join(' ');
  }

  window.Talk = { home, afterMeal, LINES };
})();

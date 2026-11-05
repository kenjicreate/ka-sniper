// 料理ごとのカロリー目安表（「普通」1人前のおおよその値）
// kcal: カロリー / salt: 塩分（g） / cat: 分類 / ml: 画像判定のラベル（英語名）との対応
// ※ 数値は一般的な目安です。お店や作り方で大きく変わります。
window.FOODS = [
  // ごはん・どんぶり
  { id: 'rice', name: 'ごはん（茶わん1杯）', kcal: 250, salt: 0, cat: 'ごはん' },
  { id: 'onigiri', name: 'おにぎり（1個）', kcal: 180, salt: 1.0, cat: 'ごはん' },
  { id: 'curry', name: 'カレーライス', kcal: 750, salt: 3.0, cat: 'ごはん' },
  { id: 'gyudon', name: '牛丼', kcal: 700, salt: 3.0, cat: 'ごはん' },
  { id: 'oyakodon', name: '親子丼', kcal: 650, salt: 3.5, cat: 'ごはん' },
  { id: 'katsudon', name: 'カツ丼', kcal: 900, salt: 4.0, cat: 'ごはん' },
  { id: 'tendon', name: '天丼', kcal: 800, salt: 3.5, cat: 'ごはん' },
  { id: 'chahan', name: 'チャーハン', kcal: 650, salt: 3.0, cat: 'ごはん' },
  { id: 'omurice', name: 'オムライス', kcal: 750, salt: 3.0, cat: 'ごはん' },
  { id: 'sushi', name: 'にぎり寿司（1人前）', kcal: 550, salt: 3.5, cat: 'ごはん', ml: ['sushi'] },
  { id: 'chazuke', name: 'お茶漬け', kcal: 300, salt: 2.0, cat: 'ごはん' },
  { id: 'okayu', name: 'おかゆ', kcal: 150, salt: 0.5, cat: 'ごはん' },
  // めん
  { id: 'ramen', name: 'ラーメン', kcal: 550, salt: 6.0, cat: 'めん' },
  { id: 'udon', name: 'かけうどん', kcal: 350, salt: 5.0, cat: 'めん' },
  { id: 'soba', name: 'かけそば', kcal: 330, salt: 4.5, cat: 'めん' },
  { id: 'zarusoba', name: 'ざるそば', kcal: 300, salt: 2.5, cat: 'めん' },
  { id: 'yakisoba', name: '焼きそば', kcal: 550, salt: 3.5, cat: 'めん' },
  { id: 'spaghetti', name: 'スパゲッティ（ミートソース）', kcal: 650, salt: 3.0, cat: 'めん' },
  { id: 'carbonara', name: 'カルボナーラ', kcal: 800, salt: 3.0, cat: 'めん', ml: ['carbonara'] },
  { id: 'somen', name: 'そうめん', kcal: 350, salt: 3.0, cat: 'めん' },
  // パン
  { id: 'toast', name: 'トースト（バター付き）', kcal: 230, salt: 0.8, cat: 'パン', ml: ['French loaf'] },
  { id: 'sandwich', name: 'サンドイッチ', kcal: 400, salt: 1.8, cat: 'パン' },
  { id: 'bagel', name: 'ベーグル', kcal: 250, salt: 1.0, cat: 'パン', ml: ['bagel'] },
  { id: 'pastry', name: '菓子パン', kcal: 380, salt: 0.8, cat: 'パン', ml: ['pretzel'] },
  { id: 'burger', name: 'ハンバーガー', kcal: 500, salt: 2.5, cat: 'パン', ml: ['cheeseburger'] },
  { id: 'hotdog', name: 'ホットドッグ', kcal: 400, salt: 2.0, cat: 'パン', ml: ['hotdog'] },
  { id: 'pizza', name: 'ピザ（2切れ）', kcal: 500, salt: 2.5, cat: 'パン', ml: ['pizza'] },
  // おかず
  { id: 'karaage', name: '唐揚げ（5個）', kcal: 450, salt: 2.0, cat: 'おかず' },
  { id: 'tonkatsu', name: 'とんかつ', kcal: 500, salt: 1.5, cat: 'おかず' },
  { id: 'hamburg', name: 'ハンバーグ', kcal: 450, salt: 2.0, cat: 'おかず', ml: ['meat loaf'] },
  { id: 'yakizakana', name: '焼き魚（さけ）', kcal: 200, salt: 1.5, cat: 'おかず' },
  { id: 'sashimi', name: 'さしみ', kcal: 150, salt: 0.5, cat: 'おかず' },
  { id: 'nikujaga', name: '肉じゃが', kcal: 300, salt: 2.5, cat: 'おかず' },
  { id: 'shogayaki', name: 'しょうが焼き', kcal: 400, salt: 2.5, cat: 'おかず' },
  { id: 'gyoza', name: 'ぎょうざ（6個）', kcal: 350, salt: 2.0, cat: 'おかず' },
  { id: 'tempura', name: '天ぷら盛り合わせ', kcal: 450, salt: 1.0, cat: 'おかず' },
  { id: 'yakitori', name: '焼き鳥（3本）', kcal: 250, salt: 2.0, cat: 'おかず' },
  { id: 'stirfry', name: '野菜炒め', kcal: 250, salt: 2.5, cat: 'おかず', ml: ['wok', 'frying pan'] },
  { id: 'nabe', name: '鍋料理（1人前）', kcal: 400, salt: 4.0, cat: 'おかず', ml: ['hot pot'] },
  { id: 'tofu', name: '冷ややっこ', kcal: 100, salt: 0.8, cat: 'おかず' },
  { id: 'natto', name: '納豆（1パック）', kcal: 100, salt: 0.6, cat: 'おかず' },
  { id: 'tamagoyaki', name: '卵焼き', kcal: 150, salt: 1.0, cat: 'おかず' },
  { id: 'potsalad', name: 'ポテトサラダ', kcal: 200, salt: 1.0, cat: 'おかず', ml: ['mashed potato'] },
  { id: 'salad', name: 'サラダ', kcal: 80, salt: 0.5, cat: 'おかず', ml: ['broccoli', 'cucumber', 'head cabbage', 'bell pepper'] },
  { id: 'nimono', name: '煮物', kcal: 150, salt: 2.0, cat: 'おかず' },
  { id: 'ohitashi', name: 'おひたし', kcal: 30, salt: 0.6, cat: 'おかず' },
  { id: 'tsukemono', name: 'つけもの', kcal: 20, salt: 1.5, cat: 'おかず' },
  { id: 'gratin', name: 'グラタン', kcal: 550, salt: 2.0, cat: 'おかず', ml: ['potpie'] },
  // 汁もの
  { id: 'misoshiru', name: 'みそ汁', kcal: 50, salt: 1.5, cat: '汁もの', ml: ['soup bowl'] },
  { id: 'tonjiru', name: '豚汁', kcal: 150, salt: 2.0, cat: '汁もの' },
  { id: 'soup', name: 'スープ', kcal: 80, salt: 1.5, cat: '汁もの', ml: ['consomme'] },
  // くだもの・おやつ
  { id: 'banana', name: 'バナナ（1本）', kcal: 90, salt: 0, cat: 'おやつ', ml: ['banana'] },
  { id: 'apple', name: 'りんご（半分）', kcal: 80, salt: 0, cat: 'おやつ', ml: ['Granny Smith'] },
  { id: 'orange', name: 'みかん（1個）', kcal: 45, salt: 0, cat: 'おやつ', ml: ['orange', 'lemon'] },
  { id: 'strawberry', name: 'いちご（5粒）', kcal: 30, salt: 0, cat: 'おやつ', ml: ['strawberry'] },
  { id: 'icecream', name: 'アイスクリーム', kcal: 200, salt: 0.1, cat: 'おやつ', ml: ['ice cream'] },
  { id: 'cake', name: 'ショートケーキ', kcal: 350, salt: 0.2, cat: 'おやつ', ml: ['trifle'] },
  { id: 'chocolate', name: 'チョコレート（板1/2）', kcal: 280, salt: 0.1, cat: 'おやつ', ml: ['chocolate sauce'] },
  { id: 'senbei', name: 'おせんべい（2枚）', kcal: 100, salt: 0.6, cat: 'おやつ' },
  { id: 'daifuku', name: '大福', kcal: 230, salt: 0.1, cat: 'おやつ' },
  { id: 'yogurt', name: 'ヨーグルト', kcal: 80, salt: 0.1, cat: 'おやつ' },
  // 飲みもの
  { id: 'milk', name: '牛乳（コップ1杯）', kcal: 130, salt: 0.2, cat: '飲みもの' },
  { id: 'coffee', name: 'コーヒー（ミルク・砂糖入り）', kcal: 50, salt: 0, cat: '飲みもの', ml: ['espresso', 'coffee mug'] },
  { id: 'juice', name: 'ジュース（コップ1杯）', kcal: 90, salt: 0, cat: '飲みもの' },
  { id: 'beer', name: 'ビール（中ジョッキ）', kcal: 200, salt: 0, cat: '飲みもの', ml: ['beer glass'] },
  { id: 'wine', name: 'ワイン（グラス1杯）', kcal: 90, salt: 0, cat: '飲みもの', ml: ['red wine'] },
  { id: 'sake', name: '日本酒（1合）', kcal: 190, salt: 0, cat: '飲みもの' },
];

window.FOOD_CATS = ['ごはん', 'めん', 'パン', 'おかず', '汁もの', 'おやつ', '飲みもの'];

// 量の選択：小盛り・普通・大盛り
window.PORTIONS = [
  { id: 'small', label: '小盛り', rate: 0.7 },
  { id: 'normal', label: '普通', rate: 1.0 },
  { id: 'large', label: '大盛り', rate: 1.4 },
];

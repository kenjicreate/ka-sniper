# 写真の判定データ

- `aiy_food_V1.tflite` … Google「AIY Vision Classifier Food V1」（約2,000種類の料理を見分ける画像判定データ）
  - 提供：Google（TensorFlow Hub / Kaggle Models で公開）／ライセンス：Apache License 2.0
  - 入力：192×192 の写真、出力：料理ごとの確からしさ（2,024種類）
- `labels.txt` … 上の判定データの料理名の一覧（1行に1つ、判定結果の並び順と同じ）

料理名と、アプリの料理表（`js/foods.js`）との対応は、`js/foods.js` の各料理の `aiy` に書いてあります。
判定できても料理表にない料理は、候補に出しません（その時は料理を選んでもらいます）。

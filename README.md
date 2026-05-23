# Shooting_game_TV

## 受信側（viewer）の起動方法

1. `viewer.html` をローカルサーバー経由で開きます（例: `python3 -m http.server`）。
2. `src/viewer.js` の `firebaseConfig` を送信側（`src/main.js`）と同一に設定します。
3. 送信側で表示された `sessionId` を入力し、**接続**を押します。
4. ステータスが「受信映像を再生中です。」になれば接続完了です。

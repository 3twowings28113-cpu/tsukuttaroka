# 投稿、つくったろか。

「関西を、おもろくする夜。」（2026/10/6）の参加者が、スマホでLinkedIn投稿文を作るアプリ。
QRを読む → ネタを選ぶ → しゃべる（音声入力OK）→ 3パターン（エモい／ユーモア／学び）→ コピーしてLinkedInへ → 「投稿したで！」と報告。
報告された投稿は、パネラー用ページに音つきで届き、パネラーが読んで★（表彰の候補）を付けられる。

## 公開のしかた
このフォルダで `npm run setup` を実行するだけ（GenCode に「AGENTS.md を読んで、最初の公開をして」と頼めばOK）。
最後に表示される URL を使う。

- 参加者用（QRにするURL）：`https://tsukuttaroka.<サブドメイン>.workers.dev/`
- 会場スクリーン用QR：`…/qr`
- 運営ページ：`…/admin`（合言葉は .dev.vars の ADMIN_PASSCODE）
- パネラー用ページ：運営ページの「パネラー用リンク」からコピー（`…/judge?k=…`。鍵は合言葉から自動で作られる）
- リハーサル用（例文入り）：`…/?demo=1`

## よくある変更
| やりたいこと | 場所 |
|---|---|
| ハッシュタグを変える | public/config.js の hashtags |
| 質問（ネタカード）を足す | public/config.js の cards に1つ足す |
| 富士通ラーニングメディアのフォローボタンを出す | public/config.js の followUrl にLinkedInページのURL |
| 文章の書き方を変える | src/ai.js の SYSTEM_PROMPT |
| AIモデルを変える | wrangler.jsonc の GEMINI_MODEL |
| パネラーの名前を変える | public/config.js の judges |
| 報告シートの文言を変える | public/config.js の report |
| 「困ったら」の案内を変える | public/config.js の help |
変えたあとは `npm run deploy`。

## 中身
- public/：画面（index.html・app.js・app.css・config.js、運営ページ admin.html、会場QR qr.html、パネラー用 judge.html）
- src/：サーバー（worker.js）、AIへの指示文（ai.js）、Gemini呼び出し（gemini.js）、報告の小道具（report.js）
- scripts/：setup.mjs（公開まで全自動）、check-gemini.mjs（AIの動作確認）
- AGENTS.md：GenCode 用のルール／SPEC.md：仕様書

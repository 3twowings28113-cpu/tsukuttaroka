# 投稿、つくったろか。

イベントの参加者が、スマホでLinkedIn投稿文（とプロフィールの見出し・自己紹介）を作るアプリ。
QRを読む → テーマを選ぶ → しゃべる（音声入力OK）→ 3パターン（エモい／ユーモア／学び）→ コピーしてLinkedInへ。
LSCW（10/31）は専用ページ /lscw。参加企業のロゴを押すと、その会社の採用ページがひらく。
（10/6「関西を、おもろくする夜。」で使った「投稿したで！」の報告・パネラーの★・受付の停止は、2026-10-22 になくした。当日の記録は /archive で見られる）

## 公開のしかた
このフォルダで `npm run setup` を実行するだけ（GenCode に「AGENTS.md を読んで、最初の公開をして」と頼めばOK）。
最後に表示される URL を使う。

- LSCW（LinkedIn Student Career Week 2026 Autumn）専用ページ（QRにするURL）：`https://tsukuttaroka.<サブドメイン>.workers.dev/lscw`
- 普段使い：`https://tsukuttaroka.<サブドメイン>.workers.dev/`
- 会場スクリーン用QR：`…/qr?preset=lscw&url=…/lscw`（運営ページの「イベント」→「会場スクリーン用QR」からも開ける）
- 運営ページ：`…/admin`（合言葉なし。URLを知っている人はだれでも開ける）
- 過去の記録：`…/archive`（10/6「関西を、おもろくする夜。」など、終わったイベントの投稿報告・★・集まった投稿。運営ページの「データ・過去の記録」からも開ける）
- リハーサル用（例文入り）：`…/?demo=1`

## よくある変更
| やりたいこと | 場所 |
|---|---|
| ハッシュタグを変える | public/config.js の hashtags |
| 質問（ネタカード）を足す | public/config.js の cards に1つ足す |
| 富士通ラーニングメディアのフォローボタンを出す | public/config.js の followUrl にLinkedInページのURL |
| 文章の書き方を変える | src/ai.js の SYSTEM_PROMPT |
| AIモデルを変える | wrangler.jsonc の GEMINI_MODEL |
| LSCWのテーマ（どんな投稿にする？）を変える | public/config.js の lscw の sets（aiTheme はAIに渡すテーマ） |
| LSCWの参加企業のロゴ・採用ページを変える | public/config.js の lscw の companies（ロゴは public/logos/） |
| 「困ったら」の案内を変える | public/config.js の help |
| イベントのハッシュタグ・メンション・AIキー・タイムスケジュールを変える | 運営ページの「イベント」（デプロイ不要） |
| AIへの指示文をその場で直す | 運営ページの「AIへの指示文」（デプロイ不要・初期の文に戻せる） |
変えたあとは `npm run deploy`。

## 中身
- public/：画面（index.html・app.js・app.css・config.js、運営ページ admin.html、会場QR qr.html、過去の記録 archive.html、参加企業のロゴ logos/）
- src/：サーバー（worker.js）、AIへの指示文（ai.js）、Gemini呼び出し（gemini.js）、名前の小道具（report.js）
- scripts/：setup.mjs（公開まで全自動）、check-gemini.mjs（AIの動作確認）
- AGENTS.md：GenCode 用のルール／SPEC.md：仕様書

## GitHub から自動で公開する（1回だけ設定）
main ブランチに入ると、GitHub Actions（`.github/workflows/deploy.yml`）が Cloudflare に公開します。最初に1回だけ、次の設定が必要です。
1. Cloudflare のダッシュボード → 右上の人のマーク →「プロフィール」→「API トークン」→「トークンを作成」→ テンプレート「Cloudflare Workers を編集する（Edit Cloudflare Workers）」→ アカウントを選んで作成 → 出てきたトークンをコピー
2. GitHub のこのリポジトリ → Settings → Secrets and variables → Actions →「New repository secret」→ 名前 `CLOUDFLARE_API_TOKEN`、値に1のトークンを貼って保存
3. GitHub の Actions →「Cloudflareに公開」→「Run workflow」で、すぐ公開もできる

GEMINI_API_KEY は、Cloudflare に登録ずみのものがそのまま使われます（GitHub には入れません）。


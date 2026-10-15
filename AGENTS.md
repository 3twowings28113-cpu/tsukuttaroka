# このプロジェクトのルール（GenCode が毎回読む）

イベント参加者が、スマホでLinkedIn投稿文（とプロフィール文）を作るWebアプリ「投稿、つくったろか。」。いまは LinkedIn Student Career Week（2026/10/31）の学生向けブース版（`public/config.js` の DEFAULT_PRESET = "lscw"）。10/6「関西を、おもろくする夜。」の設定はプリセット fujitsu に残っている。
**アプリは完成済み。** あなたの仕事は「公開する」「動作確認する」「頼まれた小さな修正」だけ。

## 最初の公開（頼まれたら、これだけやる）
1. `node -v` で Node.js 20 以上か確認。無ければ `winget install -e --id OpenJS.NodeJS.LTS` を実行し、ユーザーに GenCode の再起動を頼んで止まる
2. `npm run setup` を実行する（部品の準備・Cloudflareログイン・データベース作成・公開・キー登録・動作確認まで全自動。2〜3分かかる。時間切れで止まったら、もう一度実行すれば済んだところは飛ばされる）
   - ブラウザが開いたら、ユーザーに「Allow（許可）」を押してもらう
3. 最後に出る「できあがり」の枠を、そのままユーザーに見せる
- 失敗したら、出力の最後の20行から原因を1つに絞って直し、もう一度 `npm run setup`。同じ所で2回失敗したら止めて、原因と次の案を短く報告する
- 「More than one account」と出たら、`npx wrangler whoami` のアカウント一覧をユーザーに見せて選んでもらい、wrangler.jsonc に `"account_id": "…"` を足す

## 修正版の反映（「修正版を反映して」と頼まれたら、これだけやる）
1. ダウンロードフォルダ（%USERPROFILE%\Downloads）にある、名前が「tsukuttaroka-」で始まる zip のうち、いちばん新しい1つだけを使う（最初の全部入りの tsukuttaroka.zip は使わない）
2. その zip を、このプロジェクトのフォルダに上書きで展開する（PowerShell の Expand-Archive -Force）。zip に wrangler.jsonc と .dev.vars は入っていない
3. wrangler.jsonc の database_id が 00000000-0000-0000-0000-000000000000 になっていないか確認する。なっていたら何もせず止めて報告する
4. `npm run deploy`
5. `curl.exe https://tsukuttaroka.3twowings28113.workers.dev/api/health` を実行し、「反映できた（version：…）」と version の値だけ報告する

## クレジット節約のルール（必ず守る）
- ファイルを全部読まない。必要なファイルの必要な部分だけ開く。仕様の確認が必要なときだけ SPEC.md を読む
- 頼まれていない変更をしない（リファクタリング、整形、コメント追加、パッケージの追加・更新をしない）
- 書き換えは部分編集で。ファイル全体を書き直さない
- ブラウザ操作やスクリーンショットはしない。確認はコマンド（`npm run check`、`curl.exe`）で行う
- 報告は短く：変えたファイル／やったこと／結果の3点だけ

## どこに何があるか
- 文言・ネタカード・ハッシュタグ・メンション先・フォローURL・色 → `public/config.js`（いちばん下の PRESETS がイベントごとのまとまり。DEFAULT_PRESET で切り替え、URLの ?preset= でも切り替わる）
- イベント名・ハッシュタグ・あいことば・イベント用のAIキー → 運営ページ（/admin）の「イベント」。参加者は ?e=イベントID のURL（QR）で開く
- AIへの指示文（文章の書き方） → `src/ai.js` の `SYSTEM_PROMPT`（投稿文）・`PROFILE_PROMPT`（プロフィール文）・`ISHIZAKA_STYLE`（石坂さん風）
- 画面の動き → `public/app.js`／見た目 → `public/app.css`
- パネラー用ページ → `public/judge.html`／運営ページ → `public/admin.html`／会場スクリーン → `public/qr.html`
- 「投稿したで！」の報告 → 画面は `public/app.js`、サーバーは `src/worker.js` と `src/report.js`
- サーバー → `src/worker.js`／Gemini の呼び出し → `src/gemini.js`
- 使うAIモデル → `wrangler.jsonc` の `vars`（GEMINI_MODEL・GEMINI_FALLBACK_MODEL）
- APIキーと運営ページの合言葉 → `.dev.vars`（公開時に Cloudflare の secret として登録される）

## 変えたら
- public/ か src/ を変えたら `npm run deploy` で反映し、`curl.exe <公開URL>/api/health` で `"ok":true` を確認
- config.js の label・question・caption にある「/」は、スマホで改行してよい位置の目印。消さない

## やってはいけないこと
- APIキーを public/ の中や画面のコードに書かない（ブラウザから見えてしまう）
- デザインのルールを崩さない：地の色は config.js の theme（LSCWは青 #B4D0F0、富士通は黄色 #FFDE59）、押せるものは LinkedIn の濃い青 #004182（LSCW・普段使い。富士通は #0A66C2）、文字と線は #121212、黒い太線の雲フキダシが見せ場。LinkedInのロゴは使わない。紫〜青のグラデーション、ガラス風、キラキラのAIアイコン、絵文字のアイコン、Inter フォントは使わない

## よく使うコマンド（Windows。`&&` でつながず、1つずつ実行）
- 公開まで全部：`npm run setup`
- 反映だけ：`npm run deploy`
- AIの確認：`npm run check`
- 手元で動かす：`npm run local`（http://localhost:8787）
- 本番のログを見る：`npm run logs`

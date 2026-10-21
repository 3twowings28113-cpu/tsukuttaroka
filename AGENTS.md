# このプロジェクトのルール（GenCode が毎回読む）

イベント参加者が、スマホでLinkedIn投稿文（とプロフィール文）を作るWebアプリ「投稿、つくったろか。」。
- LinkedIn Student Career Week 2026 Autumn（会場 10/31）の学生向けブース版は、専用ページ **/lscw**（`public/lscw.html`。プリセット lscw・イベントID lscw に固定。URLを知っている人だけが開く）
- トップ（/）は普段使い（`public/config.js` の DEFAULT_PRESET = "everyday"。各自のAIキーで作る）
- 10/6「関西を、おもろくする夜。」の設定はプリセット fujitsu に残っている（/?preset=fujitsu）
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
- 文言・ネタカード・ハッシュタグ・メンション先・フォローURL・色・イベントページの案内とタイムスケジュールの初期値 → `public/config.js`（いちばん下の PRESETS がイベントごとのまとまり。DEFAULT_PRESET で切り替え、URLの ?preset= でも切り替わる。LSCWは eventPage）
- イベント名・ハッシュタグ・メンション・フォロー・イベント用のAIキー・AIへの追加の指示・タイムスケジュール・色 → 運営ページ（/admin）の「イベント」。参加者は専用ページ（/lscw）か ?e=イベントID のURL（QR）で開く。URLを開いた人はだれでも、イベントのキー（なければサーバーのキー）で作れる（あいことばは無い）
- AIへの指示文の書きかえ（投稿文・プロフィール文・石坂さん風）→ 運営ページの「AIへの指示文」（D1 の settings に保存。初期の文は `src/ai.js`）
- 利用状況（使った人・作った回数・日ごと・イベントごと）→ 運営ページの「利用状況」
- AIへの指示文（文章の書き方） → `src/ai.js` の `SYSTEM_PROMPT`（投稿文）・`HEADLINE_PROMPT`（見出し）・`ABOUT_PROMPT`（自己紹介）・`ISHIZAKA_STYLE`（石坂さん風）
- 見出し・自己紹介の条件と質問 → `public/config.js` の `profile`（conds＝条件、cards＝質問、headline／about＝それぞれの質問の並び・入れ方・ちょい直し）
- 画面の動き → `public/app.js`／見た目 → `public/app.css`／LSCW専用ページ → `public/lscw.html`（中身は app.js と同じ。window.APP_PAGE でプリセットとイベントを固定）
- 運営ページ → `public/admin.html`（合言葉なし。URLを知っている人はだれでも開ける）／会場スクリーン → `public/qr.html`
- LSCWのテーマ（どんな投稿にする？）→ `public/config.js` の lscw の `sets`／参加企業のロゴと採用ページ → lscw の `companies`（ロゴの画像は `public/logos/`）
- 終わったイベントの記録（10/6 の富士通の回など）→ 過去の記録ページ（/archive・`public/archive.html`）。運営ページは「いまの期間」だけを出す。区切りは運営ページの「データ・過去の記録」→「ここまでを過去のイベントにする」
- 「投稿したで！」の報告・パネラーの★・受付の停止は 2026-10-22 になくした（10/6 の記録は /archive で見るだけ）
- サーバー → `src/worker.js`／Gemini の呼び出し → `src/gemini.js`
- 使うAIモデル → `wrangler.jsonc` の `vars`（GEMINI_MODEL・GEMINI_FALLBACK_MODEL）
- APIキー → `.dev.vars`（公開時に Cloudflare の secret として登録される）。無料のキーは1日の回数に上限があるので、会場で使うキーは AI Studio で「課金を設定」しておく

## 変えたら
- public/ か src/ を変えたら `npm run deploy` で反映し、`curl.exe <公開URL>/api/health` で `"ok":true` を確認
- config.js の label・question・caption にある「/」は、スマホで改行してよい位置の目印。消さない

## やってはいけないこと
- APIキーを public/ の中や画面のコードに書かない（ブラウザから見えてしまう）
- デザインのルールを崩さない：地の色は config.js の theme（LSCW・普段使いは LinkedIn の青 #0A66C2 で、地の上の文字は白。富士通は黄色 #FFDE59 で文字は黒）、押せるものは LinkedIn の濃い青 #004182（富士通は #0A66C2）、カード・雲は白で文字と線は #121212、黒い太線の雲フキダシが見せ場。LinkedInのロゴは使わない。紫〜青のグラデーション、ガラス風、キラキラのAIアイコン、絵文字のアイコン、Inter フォントは使わない

## よく使うコマンド（Windows。`&&` でつながず、1つずつ実行）
- 公開まで全部：`npm run setup`
- 反映だけ：`npm run deploy`（GitHub の main に入れたら自動で公開する仕組みもある：`.github/workflows/deploy.yml`。リポジトリの secret に CLOUDFLARE_API_TOKEN が必要）
- AIの確認：`npm run check`
- 手元で動かす：`npm run local`（http://localhost:8787）
- 本番のログを見る：`npm run logs`

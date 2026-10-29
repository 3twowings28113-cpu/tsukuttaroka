/*
 * 投稿、つくったろか。── 設定ファイル
 * ネタカード・ハッシュタグ・画面の文言は、ぜんぶここで変えられます。
 * （AIへの指示文は src/ai.js、使うAIモデルは wrangler.jsonc の vars）
 * ここに書いてあるのは「普段使い」の設定。イベントごとの質問セット・色・文言は、いちばん下のプリセット（PRESETS）で上書きする。
 * どのプリセットを使うかは、いちばん下の DEFAULT_PRESET（URLの ?preset=… でも切り替えられる）。
 */
window.APP_CONFIG = {
  appName: "投稿、つくったろか。",

  // 画面の色（書いていない色は app.css の初期値）。LinkedInの青（#0A66C2）と黒が基調。ロゴは使わない
  theme: {
    ground: "#0A66C2", // 画面の地（LinkedInの青）
    onGround: "#FFFFFF", // 地の上の文字（地が濃いので白）
    onGroundSoft: "#E3EEFA", // 地の上の補足文字
    onInk: "#FFFFFF", // 黒い丸の中の文字
    sheet: "#EAF2FB", // 下から出るシートの地（読みやすいように明るく）
    groundText: "#26313D", // 白い囲みの中の補足文字
    note: "#F1F7FE", // 補足の囲み
    accent: "#004182", // 押せるもの・選択中（LinkedInの濃い青）
    accentPress: "#00315F",
    focus: "#121212", // キーボードで選んだときの枠
    mark: "#FF7373", // 小さな強調（進み具合・必須）
    check: "#004182", // 投稿前チェックの印
  },
  // 上の小さな文字。eventName を空にすると1行だけになる
  eventSub: "毎日のLinkedIn投稿に",
  eventName: "",

  // どのパターンを選んでも、本文の最後に必ず付くハッシュタグ
  hashtags: ["#LinkedIn", "#振り返り", "#日々の学び"],

  // メンション先（ 使うときだけ設定。name を空にすると、メンションは出ない）
  // inText：true なら、投稿文の最後（ハッシュタグの上）に「@◯◯」を文字で入れる
  // 2つ以上のときは mentions: [{ name, typeHint }, …] に並べる（運営ページのイベントでも設定できる）
  mention: { name: "", typeHint: "", inText: false },

  // 主催のLinkedInページURL。空のままならフォローボタンは出ない
  // followRequired：false にすると、フォローは「おすすめ」になり、始める前に必須にしない
  followUrl: "",

  signupUrl: "https://www.linkedin.com/signup",
  // 投稿画面を開くURL。prefillText が true なら本文も渡す（対応していない環境では無視されるだけ）
  linkedinComposeUrl: "https://www.linkedin.com/feed/?shareActive=true",
  prefillText: true,

  requiredCardId: "learn",

  // ネタカード（増やすときは、この配列に足すだけ）
  // id は英数字で重複させない。chips はタップで選べる候補（なくてもOK）
  // label・question・caption の「/」は、スマホで改行してよい位置（画面には出ない。AIや運営ページには / を消して渡る）
  cards: [
    {
      id: "learn",
      label: "学び・/気づき",
      caption: "心に残ったこと",
      question: "「あ、これ学びやわ」って/思ったことはなんや？",
      placeholder: "例：挨拶を先にするだけで、その後の話がめちゃめちゃしやすくなった",
      chips: ["仕事のことで", "人の話から", "失敗から", "本・記事から", "ふとした瞬間に"],
      required: true,
    },
    {
      id: "result",
      label: "実績・/うまくいったこと",
      caption: "数字が出ると強い",
      question: "このあいだ、/うまくいったことは？/（数字があると、もっとええ）",
      placeholder: "例：月曜の件、問い合わせが先月の2倍になった",
      chips: ["はじめてできた", "前より早くなった", "人からほめられた", "数字が出た"],
    },
    {
      id: "failure",
      label: "失敗・/つまずき",
      caption: "失敗の話は/人の役に立つ",
      question: "失敗や/つまずきで、/思い当たることは？/どう乗り越えた？",
      placeholder: "例：準備しかけてた資料を消した。二度書いたぶん、整理が深くなった",
      chips: ["言いにくいことを言えず", "準備不足で", "思い込みで", "時間に負けて"],
    },
    {
      id: "thanks",
      label: "感謝・/お礼のひとこと",
      caption: "感謝を入れると/伝わる",
      question: "誰に、/どんなお礼を/伝えたい？",
      placeholder: "例：〇〇さん、あのときの助言で進められました",
      note: "名前は、出してOKな人だけにしてな",
    },
    {
      id: "next",
      label: "これから/やってみたいこと",
      caption: "次の一歩で締める",
      question: "これから、/なにに挑戦してみる？",
      placeholder: "例：週1で、学んだことを発信してみる",
      chips: ["週1で発信する", "あの人に会いに行く", "新しい企画をつくる", "勉強会に行く", "プロフィールを整える"],
    },
    {
      id: "everyday",
      label: "日常の/小話",
      caption: "あるある・小ネタ",
      question: "このへんの日常で、/なんかあった？",
      placeholder: "例：駅で知らん人に道を聞いたら、なんと取引先の人やった",
      chips: ["乗り物で", "ごはんで", "家族・休日で", "近所で"],
    },
    {
      id: "seminar",
      label: "勉強会・イベント/のこと",
      caption: "参加報告に",
      question: "参加した/勉強会・イベントで、/心に残ったことは？",
      placeholder: "例：講演より、休憩時間の雑談の方が学びが深かった",
      chips: ["セミナーで", "交流会で", "オンラインで", "会社のイベントで"],
    },
    {
      id: "work",
      label: "自分の/仕事・活動",
      caption: "何してる人？",
      question: "ふだんは/何してる人？/いまの挑戦は？",
      placeholder: "例：大阪で、飲食店の経理を代行しています",
    },
    {
      id: "recommend",
      label: "おすすめ・/紹介したいもの",
      caption: "本・人・もの",
      question: "いま、/おすすめしたいものは？/なんでええねん？",
      placeholder: "例：『サラバ!』。迷ってる人に、背中を押してくれる",
    },
    {
      id: "question",
      label: "読者に/聞いてみる",
      caption: "コメントが来やすい",
      question: "読者に、/なんて聞きたい？",
      placeholder: "例：みなさん、帰りのモード切替はどうしてます？",
      chips: ["みなさんのやり方は？", "おすすめはあります？", "どう思います？"],
    },
    {
      id: "mood",
      label: "いまの気分",
      caption: "ひとことで",
      question: "いまの気分を/ひとことで/言うと？",
      placeholder: "例：帰り道にもう次の一歩を考えてる",
      chips: ["ワクワク", "切り替え", "ほっこり", "燃えてきた", "ちょっと疲れた"],
    },
    {
      id: "person",
      label: "出会い・/つながった人",
      caption: "人との出会いの話",
      question: "会った人や、/新しくつながった人で、/印象に残った人は？",
      placeholder: "例：全然違う業種の人と話して、目線が一つ上になった",
      note: "名前は、出してOKな人だけにしてな",
    },
    {
      id: "habit",
      label: "続けてること・/新しい習慣",
      caption: "小さい継続の話",
      question: "続けてること、/またはじめた習慣はある？",
      placeholder: "例：朝、通勤中に10分だけ読書をはじめた。1か月続いてる",
      chips: ["朝の習慣", "読書", "運動", "日記・メモ", "発信"],
    },
    {
      id: "place",
      label: "場所・移動の話",
      caption: "街・職場・旅先",
      question: "思い出に残ってる場所や、/移動の話で書きたいことは？",
      placeholder: "例：久しぶりに吹田まで。駅前が変わってて驚いた",
    },
    {
      id: "free",
      label: "自由に書く",
      caption: "なんでもどうぞ",
      question: "ほかに書きたいこと、/なんでもどうぞ",
      placeholder: "例：次は講演側に回ってみたい",
    },
  ],

  // プロフィールを作る（LinkedInの「見出し（Headline）」と「自己紹介（About）」を、それぞれ別に作る）。enabled: false で入口を出さない
  // 先に「条件」（立場・目指す方向・言語・雰囲気・長さなど）を決めてから、条件に合わせた質問に答える
  // cards の id は「pf_」で始める（投稿文の cards と重ねない）。見出しと自己紹介で同じ id の答えは引き継がれる
  // question・placeholder・chips の Work つきは、立場が「社会人」のときに使う
  profile: {
    enabled: true,
    openUrl: "https://www.linkedin.com/in/me/",
    conds: {
      role: { label: "あなたの立場", options: ["大学生", "大学院生", "専門・短大生", "高校生", "既卒・第二新卒", "社会人"], default: "" },
      year: { label: "学年・年次（任意）", chips: ["1年", "2年", "3年", "4年", "修士1年", "修士2年"], chipsWork: ["1年目", "2〜3年目", "5年目以上"], placeholder: "例：3年" },
      dirs: { label: "目指す方向（3つまで・任意）", max: 3, options: ["まだ探し中", "IT・エンジニア", "コンサル", "外資系", "商社", "メーカー", "金融", "広告・マーケ", "人材・教育", "公務員・NPO", "起業・スタートアップ", "研究・専門職"], placeholder: "ほかにあれば（例：ゲーム業界）" },
      focus: { label: "いちばん伝えたいこと", options: ["学んでいること", "できること・スキル", "経験・実績", "目指す姿・夢", "人柄・価値観"], default: "" },
      lang: { label: "言語", options: ["日本語", "英語", "日本語＋英語"], default: "日本語", notes: { 日本語: "日本語だけ", 英語: "海外の人にも読んでもらいたい人に", "日本語＋英語": "日本語のあとに英語も入れる" } },
      tone: { label: "雰囲気", options: ["誠実・きちんと", "親しみやすく", "熱意強め"], default: "誠実・きちんと" },
      hLen: { label: "長さ", options: ["短め", "ふつう", "長め"], default: "ふつう", notes: { 短め: "60字くらいまで。パッと読める", ふつう: "60〜120字", 長め: "120〜220字（上限いっぱい）" } },
      aLen: { label: "長さ", options: ["短め", "ふつう", "しっかり"], default: "ふつう", notes: { 短め: "200〜350字", ふつう: "400〜700字", しっかり: "800〜1200字" } },
      aForm: { label: "書き方の形", options: ["文章（ストーリー）", "見出し＋箇条書き", "シンプル"], default: "文章（ストーリー）", notes: { "文章（ストーリー）": "いま → 経験 → 強み → これから、の流れで読ませる", "見出し＋箇条書き": "【強み】などの小見出しで、ひと目で分かる", シンプル: "3〜5文の短い自己紹介" } },
      aClose: { label: "最後の一言", options: ["つながり歓迎", "メッセージ歓迎", "なし"], default: "つながり歓迎" },
      keywords: { label: "入れたいキーワード（任意）", placeholder: "例：Python、データ分析、TOEIC 850" },
    },
    // 目指す方向を選ぶと、質問の候補（chips）に足されることば
    dirChips: {
      "IT・エンジニア": ["プログラミング", "アプリ開発", "AI・データ"],
      コンサル: ["課題を整理する力", "リサーチ", "論理的に考える"],
      外資系: ["英語", "留学経験", "グローバル"],
      商社: ["語学", "海外とのやりとり", "交渉"],
      メーカー: ["ものづくり", "研究開発", "品質・改善"],
      金融: ["数字に強い", "分析", "簿記・FP"],
      "広告・マーケ": ["SNS運用", "企画", "デザイン"],
      "人材・教育": ["人の成長を支える", "コーチング", "教える経験"],
      "公務員・NPO": ["地域", "社会課題", "政策"],
      "起業・スタートアップ": ["0から作る", "事業づくり", "行動力"],
      "研究・専門職": ["研究テーマ", "学会発表", "専門知識"],
    },
    cards: [
      {
        id: "pf_now",
        label: "いまの所属",
        question: "いまの所属は？/（学校・学部・学年など）",
        questionWork: "いまの会社・仕事は？/（会社名を出したくなければ/業界だけでOK）",
        placeholder: "例：〇〇大学 経済学部 3年",
        placeholderWork: "例：IT企業で法人営業（3年目）",
        note: "書いたことだけ使うで。出したくないことは書かんでOK",
        required: true,
      },
      {
        id: "pf_skill",
        label: "学んでいること・/できること",
        question: "学んでいることや、/できること・得意なことは？",
        questionWork: "仕事で使っているスキルや、/得意なことは？",
        placeholder: "例：ゼミでマーケティングを学び、SNSの数字を分析できる",
        placeholderWork: "例：顧客の課題を聞き出して、提案書にまとめるのが得意",
        chips: ["プログラミング", "データ分析", "デザイン", "語学（英語など）", "人前で話す", "企画・イベント運営"],
        dirChips: true,
      },
      {
        id: "pf_exp",
        label: "経験・実績",
        question: "胸を張れる経験や実績は？/（数字があると強い）",
        questionWork: "仕事の実績や、/やりきった経験は？/（数字があると強い）",
        placeholder: "例：学園祭の広報で、SNSのフォロワーを1年で2倍にした",
        placeholderWork: "例：新しい顧客を半年で20社増やした",
        chips: ["長期インターン", "部活・サークルの役職", "留学", "アルバイトでの工夫", "コンテスト・受賞", "資格"],
        chipsWork: ["新しい仕事の立ち上げ", "チームのまとめ役", "社内表彰", "業務の改善"],
      },
      {
        id: "pf_strength",
        label: "強み・/大切にしていること",
        question: "まわりからよく言われる強みや、/大切にしていることは？",
        placeholder: "例：人の話を最後まで聞くところ。相手の本音を引き出すのが得意",
        chips: ["話を聞くのが得意", "段取りが得意", "粘り強い", "人をつなぐのが好き", "新しいことに飛び込める"],
      },
      {
        id: "pf_learned",
        label: "経験から/学んだこと",
        question: "その経験から/学んだことは？",
        placeholder: "例：数字で振り返ると、次にやることが見えるようになる",
      },
      {
        id: "pf_future",
        label: "これから/目指すこと",
        question: "これから挑戦したいことや、/目指す姿は？",
        placeholder: "例：データで人の行動を変えるマーケターになりたい",
        chips: ["インターンに挑戦", "海外で働く", "起業したい", "専門性を深める", "まだ探している途中"],
        dirChips: true,
      },
      {
        id: "pf_connect",
        label: "つながりたい人",
        question: "LinkedInで、/どんな人とつながりたい？",
        placeholder: "例：マーケティングの仕事をしている方、同じ業界を目指す学生",
        chips: ["同じ目標の学生", "社会人の先輩", "興味のある業界の人", "採用担当の方", "海外の人"],
      },
    ],
    // いちばん伝えたいこと → その質問を2問目に出して、必須にする
    focusCard: { 学んでいること: "pf_skill", "できること・スキル": "pf_skill", "経験・実績": "pf_exp", "目指す姿・夢": "pf_future", "人柄・価値観": "pf_strength" },
    headline: {
      label: "見出し（Headline）",
      cards: ["pf_now", "pf_skill", "pf_exp", "pf_future"],
      lead: "名前のすぐ下に出る一行。/検索やつながり申請のとき、/最初に読まれるところ。",
      steps: ["使いたい案の/「コピー」を押す", "下の「LinkedInをひらく」→/自分のプロフィール", "名前の下の鉛筆マーク（編集）→/「見出し」に貼り付けて保存"],
      refineActions: [
        { id: "shorter", label: "もっと短く" },
        { id: "concrete", label: "もっと具体的に" },
        { id: "english", label: "英語で" },
        { id: "bilingual", label: "日本語＋英語で" },
        { id: "another", label: "別の5案" },
      ],
    },
    about: {
      label: "自己紹介（About）",
      cards: ["pf_now", "pf_exp", "pf_strength", "pf_learned", "pf_future", "pf_connect"],
      lead: "プロフィールの「概要（About）」。/どんな人か、何をしてきたか、/これから何をしたいかを伝えるところ。",
      steps: ["下の「自己紹介をコピー」を押す", "「LinkedInをひらく」→/自分のプロフィール", "「概要（About）」の鉛筆マーク→/貼り付けて保存。/概要が無いときは/「プロフィールセクションを追加」→「概要」"],
      refineActions: [
        { id: "shorter", label: "もっと短く" },
        { id: "concrete", label: "もっと具体的に" },
        { id: "friendly", label: "もっと親しみやすく" },
        { id: "english", label: "英語版も付ける" },
        { id: "another", label: "別の書き方" },
      ],
    },
  },

  // 何問にするか。who は「どんな人に向いているか」。選んだ問数が、選べるネタの上限になる
  sizes: [
    { n: 1, name: "ひとことだけ", who: "とにかく早く投稿したい人に", minutes: "約1分" },
    { n: 3, name: "サクッと", who: "時間がない人・迷ってる人に", minutes: "約3分", recommended: true },
    { n: 5, name: "じっくり", who: "しっかり残したい人・発信に慣れてる人に", minutes: "約5分" },
  ],
  defaultSize: 3,

  // 問数ごとのおすすめセット（cards は上の cards の id、聞く順番もこの順）
  // theme が同じセットは、問数を変えたときに引き継がれる
  sets: [
    { id: "one", size: 1, theme: "basic", label: "学びだけ", who: "いちばん大事なところだけ、ぎゅっと書く", cards: ["learn"], recommended: true },
    { id: "basic3", size: 3, theme: "basic", label: "定番の3つ", who: "迷ったらこれ。読みやすい形にまとまる", cards: ["learn", "result", "next"], recommended: true },
    { id: "story3", size: 3, theme: "story", label: "日常ネタ", who: "くすっと読まれる、親しみやすい投稿にしたい人に", cards: ["everyday", "learn", "mood"] },
    { id: "result3", size: 3, theme: "result", label: "実績を書く", who: "仕事の成果を、ちゃんと残したい人に", cards: ["result", "thanks", "next"] },
    { id: "basic5", size: 5, theme: "basic", label: "定番じっくり", who: "学びも失敗も、まるごと伝わる", cards: ["learn", "result", "failure", "thanks", "next"], recommended: true },
    { id: "seminar5", size: 5, theme: "seminar", label: "イベント報告", who: "参加した勉強会・イベントを、レポートしたい人に", cards: ["seminar", "learn", "thanks", "work", "next"] },
    { id: "self5", size: 5, theme: "self", label: "自己紹介も", who: "はじめて読む人に、自分のことも知ってほしい人に", cards: ["work", "learn", "recommend", "question", "next"] },
  ],

  // 3つのトーン（id は src/ai.js と合わせる）
  tones: [
    { id: "emo", label: "エモい", note: "気持ちが動いた瞬間から" },
    { id: "humor", label: "ユーモア", note: "くすっと笑わせるところから" },
    { id: "straight", label: "学び", note: "学びを言い切るところから" },
  ],

  // 最後に聞くネタ（締めに向いているもの）
  lastCards: ["next", "question", "free"],

  // じぶん色の選択肢（default が初期値。role は未選択から始まる）
  style: {
    role: { label: "立場（任意）", options: ["学生", "会社員", "経営者・フリーランス", "その他"], default: "" },
    formality: { label: "文体", options: ["おまかせ", "です・ます", "だ・である"], default: "おまかせ" },
    kansai: { label: "関西弁", options: ["なし", "ちょい足し", "こってり"], default: "なし" },
    length: { label: "長さ", options: ["短め", "ふつう", "しっかり"], default: "ふつう" },
    emoji: { label: "絵文字", options: ["なし", "ちょっと", "多め"], default: "ちょっと" },
    // 投稿文の終わりのほうに「この文章は、@山下 翼 が作ったアプリ『投稿、つくったろか。』で作りました」的な一文を入れる
    sign: { label: "投稿の中に/「@山下 翼 のアプリで/作りました」を入れる？", options: ["なし", "入れる"], default: "なし" },
    // 締めのほうに「LinkedInを使うとワクワクする／新しい自分の可能性が見つかる」という前向きな一文を、自然な形で入れる
    cheer: { label: "LinkedInの/前向きな一文を入れる？", options: ["なし", "入れる"], default: "なし" },
  },
  // 選んだ項目の下に出る補足（src/ai.js の決まりと合わせる）
  styleNotes: {
    kansai: { なし: "標準語", ちょい足し: "軽く関西弁をまぜる", こってり: "関西弁。読みやすさは保つ" },
    length: { 短め: "本文120〜200字", ふつう: "本文200〜350字", しっかり: "本文350〜500字" },
    emoji: { なし: "使わない", ちょっと: "1〜2個", 多め: "3〜5個" },
    sign: { なし: "入れへん。/ふつうの投稿文のまま", 入れる: "投稿文の終わりに、/「@山下 翼 のアプリで作りました」的な/1行がつく" },
    cheer: { なし: "入れへん", 入れる: "「LinkedInで発信すると、/新しい自分の可能性が見つかりそうで/ワクワクする」みたいな一文が、/自然な形で入る" },
  },

  // 投稿ガイドで「みんなの投稿を見よう」と案内するハッシュタグ
  feedTag: "#振り返り",

  // 書き方（作り直すときに選ぶ）。id は src/ai.js の MODES と合わせる
  modes: [
    { id: "", tone: "emo", label: "エモい", sub: "気持ちが動いた瞬間から書く" },
    { id: "", tone: "humor", label: "ユーモア", sub: "くすっと笑わせる、軽いノリで" },
    { id: "", tone: "straight", label: "学び", sub: "学びを言い切って、/これからの行動で締める" },
    { id: "first", label: "はじめての投稿", sub: "LinkedInにはじめて投稿する人に。/あいさつと自己紹介つき" },
    { id: "ishizaka", label: "石坂誠風", sub: "「」のセリフで始めて、/（心の声）と絵文字多めで熱く" },
    { id: "custom", label: "じぶんの書き方", sub: "書き方の指示を/自由に入れる" },
  ],
  introLabel: "ひとこと自己紹介（任意）",
  introPlaceholder: "例：大阪で営業をしています",
  introNote: "書いたことだけ使うで。/空でもOK。",

  // 「こうしてほしい」の例（タップすると入力欄に入る）
  askExamples: ["もっとカジュアルに", "敬語をやわらかく", "最後の質問をなくして", "絵文字を減らして", "会社名を入れて："],

  refineActions: [
    { id: "shorter", label: "もっと短く" },
    { id: "hotter", label: "もっと熱く" },
    { id: "concrete", label: "もっと具体的に" },
    { id: "another", label: "別の言い回し" },
    { id: "ishizaka", label: "石坂さん風" },
  ],

  // 投稿前に確認すること
  checklist: [
    "個人情報や機密情報を書いていない",
    "写真に写る人の掲載許可をとった",
    "相手の発言や内容を勝手に書いていない",
    "文章とハッシュタグを確認した",
  ],

  // 参加者の画面に出す「便利な機能」。false で出さない（イベントは運営ページの「出す機能」で切りかえられる）
  // notes＝ネタ帳／calendar＝カレンダーから作る／voice＝じぶんの書き方をおぼえさせる
  features: { notes: true, calendar: true, voice: true },

  // 過去の記録（/archive）の表彰リストで、★を付けた人を並べる順（10/6 の富士通の回だけ。報告・審査の機能は 2026-10-22 になくした）
  judges: [],

  // 「困ったら」で出す案内（画面ごと）。staff はどの画面でもいちばん上に出る
  help: {
    staff: "わからへんときは、/下のヒントをみてな",
    staffSub: "順番どおりで進めたら、必ずできるで。",
    tips: {
      pick: ["最初に、お名前を入れてください", "「文章を作るAIを紐づける」は、最初の1回だけ。手順どおりなら5分ぐらい", "ネタは何も選ばんでOK。「このネタで始める」ですすめます", "質問に答えると、LinkedInの投稿文ができます"],
      answer: ["マイクを押して話すと、文字になります", "うまく入らないときは、キーボードのマイクでも話せます", "ひとことでOK。必須でない質問は「とばす」で次へ"],
      style: ["そのままでOK。下の「つくってもらう」を押してください", "じぶん色は、あとで変えられるから、さらっとでOK"],
      loading: ["10秒ほど待ってください"],
      result: ["好きな案を選んで「この案でいく」を押してください", "「こうしてほしい」に書くと、そのとおりに直します", "文章は「自分で直す」で直せます"],
      done: ["LinkedInアプリの入力欄を長押しして「貼り付け」", "写真を1枚つけると、見てもらいやすいで"],
    },
  },

  consentLabel: "回答と投稿文を/保存する",
  consentNote: "作った人の振り返りに使うで。名前やアカウントは集めません。",
  consentDefault: true,

  aizuchi: ["ええやん！", "それ、ほんまに大事やん", "めっちゃ伝わるわ", "わかる〜！", "ナイスや！", "それ書こ！"],
  loadingLines: ["ええ感じにまとめてるで…", "塩かげん、調整中…", "言葉をえらんでるとこ…", "もうちょいや！"],
};

/*
 * ---------- イベントごとのまとまり（プリセット） ----------
 * 質問セット・色・文言をイベントごとにまとめたもの。上の設定（普段使い）に上書きされる。
 * いま使うのは DEFAULT_PRESET。URLに ?preset=fujitsu のように付けると、そのページだけ切り替わる。
 * イベント専用ページ（例：/lscw ＝ public/lscw.html）は、ページの中で window.APP_PAGE を決めていて、そのプリセットに固定される。
 * イベント名・ハッシュタグ・メンション・あいことば・AIキー・タイムスケジュールは、運営ページ（/admin）の「イベント」で変えられる。
 */
(() => {
  const DEFAULT_PRESET = "everyday";
  const B = window.APP_CONFIG;
  const PRESETS = {
    // 普段使い（上の設定そのまま）
    everyday: { label: "普段使い" },

    // LinkedIn Student Career Week 2026 Autumn（オンライン10/26〜30、会場10/31）の学生向けブース。専用ページは /lscw
    lscw: {
      label: "LSCW 2026 Autumn（10/31 学生向けブース）",
      pagePath: "/lscw", // このプリセット専用のページ（運営ページのQRは、このページのURLになる）
      // 地は LSCW の公式サイトに合わせた、ミント → 青のグラデーション（明るいので、地の上の文字は黒）。押せるものは LinkedIn の濃い青のまま
      theme: {
        ...B.theme,
        ground: "#8EF0D6", // 上の帯・下のボタンの帯など、べた塗りのところ
        groundTop: "#C2FBE6", // いちばん上の「困ったら」の帯（グラデーションの上のほうの色）
        groundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 900' preserveAspectRatio='none'%3E%3Cpath d='M-40 330 C 60 170 170 150 230 300 S 360 470 440 250 L 440 330 C 360 560 250 420 200 370 S 40 260 -40 430 Z' fill='%23ffffff' fill-opacity='0.55'/%3E%3C/svg%3E") top / 100% 100% no-repeat, linear-gradient(150deg, #D4FDEC 0%, #A4F8DD 26%, #6DEFD0 50%, #55DDD6 70%, #4CB4EE 90%, #4A9BEF 100%)`,
        onGround: "#121212",
        onGroundSoft: "#1F3A44",
        sheet: "#EAFBF5",
        note: "#F0FCF8",
        focus: "#004182",
      },
      eventSub: "LinkedIn Student Career Week 2026 Autumn",
      eventName: "",
      // 運営ページのイベントで上書きできる（イベントのハッシュタグが空のときは、これが付く）
      // 主催がイベントの告知で使っているタグ（#LSCW2026・#LinkedInStudentCareerWeek）に合わせた
      hashtags: ["#LSCW2026", "#LinkedInStudentCareerWeek", "#LinkedIn"],
      feedTag: "#LSCW2026",
      // 投稿の終わりのほうに「LinkedInを使うとワクワクする／新しい自分の可能性が見つかる」という一文を、すべての投稿に入れる
      cheerAlways: true,
      // プロフィールの条件の初期値は「大学生」（学生向けブース）
      profile: { ...B.profile, conds: { ...B.profile.conds, role: { ...B.profile.conds.role, default: "大学生" } } },
      // イベント専用ページ（/lscw）の上に出す案内と、タイムスケジュール。運営ページのイベントで上書きできる
      // schedule の day が同じものは1つの日にまとまる。時間はまだ公式に細かく出ていないところがあるので「予定」
      eventPage: {
        title: "LinkedIn Student Career Week 2026 Autumn",
        when: "会場 10/31(土) 9:30〜18:00（予定・入退室自由）｜オンライン 10/26(月)〜10/30(金)",
        place: "WeWork 日比谷FORT TOWER（東京都港区西新橋1-1-1）",
        mapUrl: "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent("日比谷フォートタワー 東京都港区西新橋1-1-1"),
        siteUrl: "https://lscw.scoutalia.com/",
        siteLabel: "公式サイト（最新のタイムテーブル）",
        note: "時間は予定です。変わることがあるので、最新は公式サイトで確かめてな。",
        schedule: [
          { day: "10/31(土) 会場（日比谷）", time: "9:30", title: "開場（予定）", note: "18:00まで入退室自由" },
          { day: "10/31(土) 会場（日比谷）", time: "終日", title: "企業ブース", note: "企業の人と話せる・相談できる・インターンに応募できる" },
          { day: "10/31(土) 会場（日比谷）", time: "終日", title: "特別セミナー", note: "パネルトーク・ワークショップ・業界別の講演など。時間は公式サイトで" },
          { day: "10/31(土) 会場（日比谷）", time: "終日", title: "このブース：投稿、つくったろか。", note: "しゃべるだけで、LinkedInの投稿文とプロフィール文ができる" },
          { day: "10/31(土) 会場（日比谷）", time: "18:00", title: "終了（予定）" },
          { day: "10/26(月)〜10/30(金) オンライン", time: "8:00〜9:30", title: "モーニングセッション", note: "企業の登壇（1社45分）" },
          { day: "10/26(月)〜10/30(金) オンライン", time: "12:00〜13:30", title: "ランチセッション", note: "企業の登壇（1社45分）" },
          { day: "10/26(月)〜10/30(金) オンライン", time: "18:00〜", title: "イブニングセッション", note: "企業の登壇" },
        ],
      },
      style: {
        ...B.style,
        role: { ...B.style.role, default: "学生" },
        cheer: { ...B.style.cheer, default: "入れる" },
      },
      cards: [
        {
          id: "intro",
          label: "自己紹介",
          caption: "大学・学年・/興味のあること",
          question: "はじめての投稿やね。/あなたのことを/かんたんに教えて",
          placeholder: "例：〇〇大学 経済学部の3年生。マーケティングに興味がある",
          chips: ["大学・学部・学年", "興味のある業界", "力を入れてること", "LinkedInを始めたばかり"],
        },
        {
          id: "why",
          label: "参加した/きっかけ",
          caption: "なんで来た？",
          question: "LSCWに/参加したきっかけは？",
          placeholder: "例：外資系企業の人の話を、直接聞いてみたかった",
          chips: ["企業の人と話したかった", "セミナーが気になった", "友だちに誘われて", "LinkedInを始めたくて", "就活の情報集め"],
        },
        {
          id: "learn",
          label: "今日の/学び・気づき",
          caption: "心に残ったこと",
          question: "今日、/「これは学びやわ」って/思ったことは？",
          placeholder: "例：先輩の話で、肩書きより「何をしてきたか」が大事やと気づいた",
          chips: ["セッションで", "ブースで", "人と話して", "LinkedInを使ってみて", "ふとした瞬間に"],
          required: true,
        },
        {
          id: "session",
          label: "心に残った/話",
          caption: "セッション・人の話",
          question: "心に残った/セッションや、/人の話は？",
          placeholder: "例：「まず発信してみる」が、チャンスの入口になるという話",
          note: "人の名前は、出してOKな人だけにしてな",
        },
        {
          id: "company",
          label: "気になった/企業・ブース",
          caption: "話を聞いて/刺さったこと",
          question: "話を聞いて/気になった企業や/ブースは？",
          placeholder: "例：若手社員さんの「失敗してもいいから手を挙げる」という話が刺さった",
          chips: ["ブースで話して", "セミナーで聞いて", "パネルトークで", "オンラインで"],
          note: "企業や人の名前は、出してOKなものだけにしてな",
        },
        {
          id: "dream",
          label: "私の夢・/やりたいこと",
          caption: "LSCWで/話題のテーマ",
          question: "あなたの夢や、/将来やってみたい/ことは？",
          placeholder: "例：地元の会社の魅力を、世界に届けられる人になりたい",
          chips: ["こんな働き方がしたい", "社会をこう変えたい", "海外で挑戦したい", "まだ探してる途中"],
        },
        {
          id: "career",
          label: "就活・キャリアで/考えてること",
          caption: "いまの悩みも/そのままでOK",
          question: "いま、/就活やキャリアで/考えてることは？",
          placeholder: "例：やりたいことがまだ1つに決まらない。だからこそ色んな人に会いたい",
          chips: ["業界を調べてる", "インターンを探してる", "やりたいことを探してる", "まだ何も決めてない"],
        },
        {
          id: "focus",
          label: "力を入れて/いること",
          caption: "ゼミ・部活・バイトなど",
          question: "学生生活で、/力を入れてることは？",
          placeholder: "例：ゼミで、地域の商店街のデータを分析している",
          chips: ["ゼミ・研究", "部活・サークル", "アルバイト", "インターン", "学外の活動"],
        },
        {
          id: "person",
          label: "話した人・/つながった人",
          caption: "出会いの話",
          question: "今日話した人や、/つながった人で、/印象に残った人は？",
          placeholder: "例：同じ業界を目指す他大学の学生と話せて、刺激になった",
          note: "名前は、出してOKな人だけにしてな",
        },
        {
          id: "thanks",
          label: "お礼を/伝えたい人",
          caption: "感謝を入れると/伝わる",
          question: "お礼を伝えたい人や/企業は？",
          placeholder: "例：ブースで就活の悩みを聞いてくれた社員さん、ありがとうございました",
          note: "名前は、出してOKな人だけにしてな",
        },
        {
          id: "next",
          label: "これから/挑戦したいこと",
          caption: "次の一歩で締める",
          question: "これから、/なにに挑戦してみる？",
          placeholder: "例：プロフィールを整えて、週1で学んだことを発信する",
          chips: ["プロフィールを整える", "週1で発信する", "気になる人とつながる", "インターンに応募する", "LinkedIn Learningで学ぶ"],
        },
        {
          id: "mood",
          label: "いまの気分",
          caption: "ひとことで",
          question: "いまの気分を/ひとことで/言うと？",
          placeholder: "例：帰り道にもう次の一歩を考えてる",
          chips: ["ワクワク", "刺激だらけ", "燃えてきた", "ちょっと緊張した", "ほっとした"],
        },
        {
          id: "free",
          label: "自由に書く",
          caption: "なんでもどうぞ",
          question: "ほかに書きたいこと、/なんでもどうぞ",
          placeholder: "例：次は自分が話す側になってみたい",
        },
      ],
      // イベントの会場では、カレンダー（予定はもう決まっている）と書き方のおぼえさせは出さない
      features: { notes: true, calendar: false, voice: false },
      // どんな投稿にする？（会場で使いやすい順）。aiTheme はAIに渡すテーマ。質問はセットに書いた順で聞く（keepSetOrder）
      keepSetOrder: true,
      sets: [
        { id: "one", size: 1, theme: "basic", label: "参加した感想", aiTheme: "LSCWに参加した感想", who: "いちばん大事な学びだけ、ぎゅっと書く", cards: ["learn"], recommended: true },
        { id: "basic3", size: 3, theme: "basic", label: "参加した感想", aiTheme: "LSCWに参加した感想", who: "迷ったらこれ。来たきっかけ→学び→次の一歩で、今日の感想がまとまる", cards: ["why", "learn", "next"], recommended: true },
        { id: "first3", size: 3, theme: "first", label: "はじめての投稿", aiTheme: "LinkedInではじめての投稿。かんたんな自己紹介と、LSCWに参加して学んだこと", who: "LinkedInにはじめて投稿する人に。自己紹介と今日のことを、ちょうどよく", cards: ["intro", "learn", "next"] },
        { id: "company3", size: 3, theme: "company", label: "企業ブースで話したこと", aiTheme: "LSCWの企業ブースで、企業の人と話したこと", who: "ブースで話した企業のことを、お礼も込めて残したい人に", cards: ["company", "learn", "thanks"] },
        { id: "session3", size: 3, theme: "session", label: "セミナー・パネルの学び", aiTheme: "LSCWのセミナー・パネルトークで学んだこと", who: "登壇者の話で心に残ったことを、学びとして残したい人に", cards: ["session", "learn", "next"] },
        { id: "people3", size: 3, theme: "people", label: "出会い・つながり", aiTheme: "LSCWでの出会いと、新しいつながり", who: "話した人・つながった人のことを書きたい人に", cards: ["person", "learn", "thanks"] },
        { id: "dream3", size: 3, theme: "dream", label: "私の夢を書く", who: "LSCWで話題の「私の夢」。将来やりたいことと、今日の学びをつなげる", cards: ["dream", "learn", "next"] },
        { id: "career3", size: 3, theme: "career", label: "就活・キャリアのいま", who: "いま考えてることも、正直に残したい人に", cards: ["career", "learn", "next"] },
        { id: "basic5", size: 5, theme: "basic", label: "参加した感想をじっくり", aiTheme: "LSCWに参加した感想", who: "今日の流れが、まるごと伝わる", cards: ["why", "learn", "session", "company", "next"], recommended: true },
        { id: "first5", size: 5, theme: "first", label: "はじめての投稿をじっくり", aiTheme: "LinkedInではじめての投稿。自己紹介と、LSCWに参加したきっかけ・学び・これから", who: "はじめて読む人に、自分のことと今日のことをしっかり伝えたい人に", cards: ["intro", "why", "learn", "focus", "next"] },
        { id: "company5", size: 5, theme: "company", label: "企業ブースをじっくり", aiTheme: "LSCWの企業ブースで、企業の人と話したこと", who: "話した企業・人のことを、感謝と一緒にしっかり残したい人に", cards: ["why", "company", "learn", "thanks", "next"] },
        { id: "session5", size: 5, theme: "session", label: "セミナーの学びをじっくり", aiTheme: "LSCWのセミナー・パネルトークで学んだこと", who: "話の中身と、自分の考えまでしっかり書きたい人に", cards: ["session", "learn", "career", "mood", "next"] },
        { id: "people5", size: 5, theme: "people", label: "出会いをじっくり", aiTheme: "LSCWでの出会いと、新しいつながり", who: "出会った人・企業と、そこからの学びをしっかり残したい人に", cards: ["why", "person", "company", "learn", "next"] },
        { id: "dream5", size: 5, theme: "dream", label: "私の夢をじっくり", who: "夢と、いま力を入れていることと、今日の学びをつなげたい人に", cards: ["dream", "focus", "learn", "career", "next"] },
        { id: "career5", size: 5, theme: "career", label: "就活・キャリアじっくり", who: "考えてることと、今日の学びをつなげたい人に", cards: ["career", "learn", "session", "focus", "next"] },
      ],
      // 最初の画面の上に出す「今日は、どんなことを書く？」（押したら、そのセットで質問へ直行。書き方は最後に選ぶだけの最速コース）
      quickScenes: [
        { set: "basic3", label: "迷ったらこれ", sub: "参加した感想（おすすめ）" },
        { set: "company3", label: "企業ブースで話した", sub: "お礼も込めて残したい" },
        { set: "session3", label: "セミナー・パネルを聞いた", sub: "心に残った学びを" },
        { set: "people3", label: "出会い・つながり", sub: "話した人・つながった人" },
        { set: "first3", label: "はじめて投稿する", sub: "自己紹介つきで" },
        { set: "one", label: "1問だけ・最速", sub: "学びひとつだけ、約1分" },
      ],
      // 参加企業（最初の画面の「どんな投稿にする？」に並べる）。ロゴを押すと採用ページがひらく
      // ロゴは public/logos/（公式サイトの協賛一覧から切り出し）。LinkedIn のロゴは使わない（デザインのルール）
      // url は 2026/10 に検索で確かめたもの。採用ページが見つからなかった会社は LSCW の公式サイトへ
      companies: {
        title: "今日の参加企業",
        note: "ロゴを押すと、その会社の採用ページがひらくで。/気になった会社のことを書くなら、/上の「企業ブースで話したこと」へ。",
        list: [
          { name: "パナソニック", logo: "panasonic", url: "https://recruit.jpn.panasonic.com/newgrads/" },
          { name: "ジョンソン・エンド・ジョンソン", logo: "jnj", url: "https://www.jnj.co.jp/careers/newgrads" },
          { name: "アストラゼネカ", logo: "astrazeneca", url: "https://www.astrazeneca.co.jp/recruit/new_graduates_recruitment.html" },
          { name: "アデコ", logo: "adecco", url: "https://www.adeccogroup.jp/recruit/recruit/freshers/info" },
          { name: "アデコグループ（Adecco・Akkodis・LHH）", logo: "adecco-group", url: "https://www.adeccogroup.jp/recruit" },
          { name: "アルファサイツ", logo: "alphasights", url: "https://www.alphasights.com/careers/students-and-interns/" },
          { name: "JACインターナショナル", logo: "jac-international", url: "https://corp.jac-recruitment.jp/recruit/entry/international.html" },
          { name: "JACリクルートメント", logo: "jac-recruitment", url: "https://corp.jac-recruitment.jp/recruit/entry/new-graduate/internship/" },
          { name: "サンスター", logo: "sunstar", url: "https://jp.sunstar.com/recruit/" },
          { name: "土屋鞄製造所", logo: "tsuchiya-kaban", url: "https://tsuchiya-kaban.jp/pages/recruit" },
          { name: "YKK AP", logo: "ykkap", url: "https://www.ykkap.co.jp/company/jp/recruit/index.html" },
          { name: "NEC", logo: "nec", url: "https://jpn.nec.com/recruit/newgraduate/index.html" },
          { name: "トレジャーAI", logo: "treasure-ai", url: "https://jobs.treasure.ai/" },
          { name: "JICA海外協力隊", logo: "jica", url: "https://www.jica.go.jp/volunteer/application/" },
          { name: "アンカー・ジャパン", logo: "anker", url: "https://corp.ankerjapan.com/careers" },
          { name: "ソニー・インタラクティブエンタテインメント", logo: "sie", url: "https://www.sie.com/jp/saiyo/newgrad.html" },
          { name: "フィリップ モリス ジャパン", logo: "pmj", url: "https://www.pmi.com/markets/japan/ja/careers" },
          { name: "ヌーベルメディア（NOUVELLE MÉDIAS）", logo: "nouvelle-medias", url: "" },
          { name: "シンプレクス", logo: "simplex", url: "https://recruit.simplex.holdings/" },
          { name: "Diggle", logo: "diggle", url: "https://corp.diggle.jp/recruit/newgrads" },
          { name: "楽天グループ", logo: "rakuten", url: "https://corp.rakuten.co.jp/careers/graduates/" },
          { name: "ブルード（BLUED）", logo: "blued", url: "https://blued.jp/recruit" },
          { name: "キンドリルジャパン", logo: "kyndryl", url: "https://www.kyndryl.com/us/en/careers/early-careers" },
          { name: "ティムタム（Arnott's）", logo: "timtam", url: "" },
          { name: "デル・テクノロジーズ", logo: "dell", url: "https://jobs.dell.com/ja" },
          { name: "ベネッセ i-キャリア", logo: "benesse-icareer", url: "https://note.com/bic252/m/mfec8245cdf5c" },
          { name: "Beyond Technologies", logo: "beyond", url: "https://hrmos.co/pages/beyond-t" },
          { name: "ダイレクトソーシング", logo: "direct-sourcing", url: "https://recruit.directsourcing-lab.com/" },
        ],
      },
      lastCards: ["next", "free"],
      help: {
        ...B.help,
        staff: "近くのスタッフに、/この画面を見せてください",
        staffSub: "いっしょにやります。",
        tips: {
          ...B.help.tips,
          pick: ["最初に、お名前を入れてください", "作るもの（投稿文・見出し・自己紹介）を選んでください。見出しと自己紹介は、先に条件を決めると質問がかんたんになります", "ネタは何も選ばんでOK。下のボタンで始められます", "LinkedInにはじめて投稿する人は、「どんな投稿にする？」で「はじめての投稿」を選んでな", "写真は、最後の質問の「写真もそえる？」で入れてな（10枚まで）", "参加企業のロゴを押すと、その会社の採用ページがひらきます", "イベントの時間は「タイムスケジュールを見る」で見られます"],
          done: ["LinkedInアプリの入力欄を長押しして「貼り付け」", "選んだ写真は、LinkedInの投稿画面で添付してな", "ほかのセッションの時間は「タイムスケジュールを見る」で"],
        },
      },
    },

    // 2026/10/6「関西を、おもろくする夜。」（FLM主催 LinkedIn大交流会）。当日の設定をそのまま残したもの
    fujitsu: {
      label: "関西を、おもろくする夜。（2026/10/6 富士通ラーニングメディア）",
      theme: { ground: "#FFDE59", onGround: "#121212", onGroundSoft: "#3B372E", onInk: "#FFDE59", sheet: "#FFDE59", groundText: "#3B372E", note: "#FBFFD3", subText: "#6A6456", accent: "#0A66C2", accentPress: "#004182", focus: "#0A66C2", mark: "#FF7373", check: "#FF5A6F" },
      profile: { ...B.profile, enabled: false },
      cheerAlways: false,
      eventName: "関西を、おもろくする夜。",
      eventSub: "FLM主催 LinkedIn大交流会",
      hashtags: ["#富士通ラーニングメディア", "#LinkedIn", "#関西をおもろくする会", "#関西"],
      mention: { name: "富士通ラーニングメディア", typeHint: "@富士通", inText: true },
      followUrl: "https://www.linkedin.com/company/%EF%BC%88%E6%A0%AA%EF%BC%89%E5%AF%8C%E5%A3%AB%E9%80%9A%E3%83%A9%E3%83%BC%E3%83%8B%E3%83%B3%E3%82%B0%E3%83%A1%E3%83%87%E3%82%A3%E3%82%A2/",
      cards: [
        {
          id: "learn",
          label: "印象に/残ったこと",
          caption: "今日いちばん心に残ったこと",
          question: "今日いちばん/印象に残ったこと、/なんやった？",
          placeholder: "例：失敗の話を笑って話せる人ほど、強いと思った",
          chips: ["パネルの話で", "プロフトークで", "人生観トークで", "魅力を伝え合って", "雑談の中で"],
          required: true,
        },
        {
          id: "miryoku",
          label: "もらった/自分の魅力",
          caption: "人から見た、自分らしさ",
          question: "相手から言われた/あなたの魅力は？/どう感じた？",
          placeholder: "例：「話を広げるのがうまい」と言われて、意外やけどうれしかった",
          chips: ["意外やった", "うれしかった", "自信になった", "ちょっと照れた"],
          note: "言われた言葉を、そのまま書いてOK",
        },
        {
          id: "thanks",
          label: "話した人への/ひとこと",
          caption: "感謝を入れると/伝わる",
          question: "今日話した人に、/ひとこと/伝えるなら？",
          placeholder: "例：〇〇さん、プロフ帳の話めっちゃ刺さりました",
          note: "名前は、出してOKな人だけにしてな",
        },
        {
          id: "next",
          label: "これから/挑戦したいこと",
          caption: "次の一歩で締める",
          question: "これから、/なにに挑戦してみる？",
          placeholder: "例：失敗した話も、LinkedInで書いてみる",
          chips: ["週1で投稿する", "今日つながった人と話す", "プロフィールを整える", "失敗談も発信する"],
        },
        {
          id: "panel",
          label: "パネルで/刺さった話",
          caption: "登壇者のひとこと",
          question: "パネルで/刺さった話は？",
          placeholder: "例：反応が生まれる投稿は、うまさより本音、という話",
          chips: ["松本さん", "石坂さん", "Machiさん", "投稿のコツ", "逆境・失敗の乗り越え方", "関西のつながり・挑戦", "まず一歩やってみる"],
        },
        {
          id: "workshop",
          label: "ワークショップ",
          caption: "平成プロフ帳・人生観トーク",
          question: "ワークショップ、/どうやった？",
          placeholder: "例：初対面なのに、好きなことの話で一気に距離が縮まった",
          chips: ["平成プロフ帳", "プロフトーク", "人生観トーク", "魅力を伝え合う", "関西の共通項さがし"],
        },
        {
          id: "common",
          label: "見つけた/関西の共通項",
          caption: "あるある大歓迎",
          question: "どんな共通項が/見つかった？",
          placeholder: "例：隣の人も阪神ファンで、しかも同じ尼崎出身やった",
        },
        {
          id: "kansai",
          label: "関西の/すきなところ",
          caption: "推しポイント",
          question: "関西の/「ここが好き！」は？",
          placeholder: "例：知らん人とでも、すぐツッコミ合えるところ",
        },
        {
          id: "scene",
          label: "心に残った/場面",
          caption: "その場の空気",
          question: "心に残った/場面は？",
          placeholder: "例：23階の夜景を見ながら話した時間",
        },
        {
          id: "mood",
          label: "いまの気分",
          caption: "ひとことで",
          question: "いまの気分を/ひとことで/言うと？",
          placeholder: "例：帰り道にもう次の一歩を考えてる",
          chips: ["ワクワク", "刺激だらけ", "ほっこり", "燃えてきた", "ちょっと緊張した"],
        },
        {
          id: "work",
          label: "自分の/仕事・挑戦",
          caption: "何してる人？",
          question: "ふだんは/何してる人？/いまの挑戦は？",
          placeholder: "例：関西で、学生と企業をつなぐ活動をしています",
        },
        {
          id: "free",
          label: "自由に書く",
          caption: "なんでもどうぞ",
          question: "ほかに書きたいこと、/なんでもどうぞ",
          placeholder: "例：次は自分もパネルに立てるくらい発信したい",
        },
      ],
      sizes: [
        { n: 1, name: "ひとことだけ", who: "とにかく早く投稿したい人に", minutes: "約1分" },
        { n: 3, name: "サクッと", who: "はじめてLinkedInに投稿する人・時間がない人に", minutes: "約3分", recommended: true },
        { n: 5, name: "じっくり", who: "学びをしっかり残したい人・発信に慣れてる人に", minutes: "約5分" },
      ],
      sets: [
        { id: "one", size: 1, theme: "basic", label: "印象に残ったことだけ", who: "いちばん大事なところだけ、ぎゅっと書く", cards: ["learn"], recommended: true },
        { id: "basic3", size: 3, theme: "basic", label: "今日の3つ", who: "迷ったらこれ。会場で話した流れのまま書ける", cards: ["learn", "miryoku", "next"], recommended: true },
        { id: "nori3", size: 3, theme: "nori", label: "関西ノリ", who: "くすっと笑える投稿にしたい人に", cards: ["learn", "common", "kansai"] },
        { id: "panel3", size: 3, theme: "panel", label: "パネル中心", who: "登壇者の話を、自分の言葉で残したい人に", cards: ["learn", "panel", "next"] },
        { id: "basic5", size: 5, theme: "basic", label: "定番じっくり", who: "今日の流れが、まるごと伝わる", cards: ["learn", "panel", "miryoku", "thanks", "next"], recommended: true },
        { id: "nori5", size: 5, theme: "nori", label: "関西ノリ", who: "関西ネタで、読む人も楽しくしたい人に", cards: ["learn", "common", "kansai", "scene", "mood"] },
        { id: "self5", size: 5, theme: "self", label: "自己紹介も", who: "今日つながった人に、自分のことも知ってほしい人に", cards: ["learn", "work", "panel", "thanks", "next"] },
      ],
      tones: [
        { id: "emo", label: "エモい", note: "気持ちが動いた瞬間から" },
        { id: "humor", label: "ユーモア", note: "関西ノリのツッコミから" },
        { id: "straight", label: "学び", note: "学びを言い切るところから" },
      ],
      lastCards: ["next", "free"],
      style: {
        role: { label: "立場（任意）", options: ["学生", "会社員", "経営者・フリーランス", "その他"], default: "" },
        formality: { label: "文体", options: ["です・ます", "だ・である"], default: "です・ます" },
        kansai: { label: "関西弁", options: ["なし", "ちょい足し", "こってり"], default: "ちょい足し" },
        length: { label: "長さ", options: ["短め", "ふつう", "しっかり"], default: "ふつう" },
        emoji: { label: "絵文字", options: ["なし", "ちょっと", "多め"], default: "ちょっと" },
      },
      styleNotes: {
        kansai: { なし: "3つとも標準語", ちょい足し: "ユーモア案だけ関西弁", こってり: "3つとも関西弁" },
        length: { 短め: "本文120〜200字", ふつう: "本文200〜350字", しっかり: "本文350〜500字" },
        emoji: { なし: "使わない", ちょっと: "1〜2個", 多め: "3〜5個" },
      },
      feedTag: "#関西をおもろくする会",
      modes: [
        { id: "", tone: "emo", label: "エモい", sub: "気持ちが動いた瞬間から書く", recommended: true },
        { id: "", tone: "humor", label: "ユーモア", sub: "関西ノリのツッコミで、くすっと" },
        { id: "", tone: "straight", label: "学び", sub: "学びを言い切って、/これからの行動で締める" },
        { id: "first", label: "はじめての投稿", sub: "LinkedInにはじめて投稿する人に。/あいさつと自己紹介つき" },
        { id: "ishizaka", label: "石坂さん風", sub: "「」のセリフで始めて、/（心の声）と絵文字多めで熱く" },
      ],
      refineActions: [
        { id: "shorter", label: "もっと短く" },
        { id: "hotter", label: "もっと熱く" },
        { id: "concrete", label: "もっと具体的に" },
        { id: "another", label: "別の言い回し" },
        { id: "ishizaka", label: "石坂さん風" },
      ],
      judges: ["薬袋さん", "高山 将一さん", "井上 奈央さん", "Machi Wadaさん", "松本 淳さん", "山下 翼さん", "石坂 誠さん"],
      help: {
        staff: "近くのスタッフに、/この画面を見せてください",
        staffSub: "いっしょにやります。",
        tips: {
          pick: ["最初に、お名前を入れてください", "「LinkedInページをひらく」で富士通ラーニングメディアをフォローして、「フォローした」にチェック", "迷ったら「おまかせで始める」を押すだけでOK", "質問に答えると、LinkedInの投稿文ができます"],
          answer: ["マイクを押して話すと、文字になります", "うまく入らないときは、キーボードのマイクでも話せます", "ひとことでOK。必須でない質問は「とばす」で次へ"],
          style: ["そのままでOK。下の「つくってもらう」を押してください", "はじめて投稿する人は「書き方」で「はじめての投稿」を選んでください"],
          loading: ["10秒ほど待ってください"],
          result: ["好きな案を選んで「この案でいく」を押してください", "「こうしてほしい」に書くと、そのとおりに直します", "文章は「自分で直す」で直せます"],
          done: ["投稿の前に、富士通ラーニングメディアをフォローしてください", "LinkedInアプリの入力欄を長押しして「貼り付け」"],
        },
      },
      consentLabel: "イベント運営にも/回答と投稿文を/共有する",
      consentNote: "振り返りに使います。名前やアカウントは集めません。",
      loadingLines: ["ええ感じにまとめてるで…", "関西弁の塩かげん、調整中…", "言葉をえらんでるとこ…", "もうちょいや！"],
    },
  };

  // イベント専用ページ（window.APP_PAGE があるページ）は、そのプリセットに固定。ほかは ?preset= → DEFAULT_PRESET
  const PAGE = window.APP_PAGE && PRESETS[window.APP_PAGE.preset] ? window.APP_PAGE : null;
  let id = PAGE ? PAGE.preset : DEFAULT_PRESET;
  try {
    const q = new URLSearchParams(location.search).get("preset");
    if (!PAGE && q && PRESETS[q]) id = q;
  } catch {}
  if (!PRESETS[id]) id = "everyday";
  // 運営ページ用：イベントの概要の下書き（質問セットの案内・タイムスケジュール・参加企業から作る）
  const overviewDraft = (P) => {
    const ep = P.eventPage;
    if (!ep) return "";
    const lines = [];
    if (ep.title) lines.push(`イベント名：${ep.title}`);
    if (ep.when) lines.push(`日時：${ep.when}`);
    if (ep.place) lines.push(`会場：${ep.place}`);
    if (P.eventSub && P.eventSub !== ep.title) lines.push(`説明：${P.eventSub}`);
    const sch = Array.isArray(ep.schedule) ? ep.schedule : [];
    if (sch.length) {
      lines.push("", "タイムスケジュール：");
      let day = "";
      for (const it of sch) {
        if (it.day && it.day !== day) lines.push(`■ ${(day = it.day)}`);
        lines.push(`・${[it.time, it.title, it.note].filter(Boolean).join("　")}`);
      }
    }
    const co = P.companies && Array.isArray(P.companies.list) ? P.companies.list : [];
    if (co.length) lines.push("", `参加企業：${co.map((c) => c.name).join("、")}`);
    return lines.join("\n").slice(0, 3000);
  };
  window.APP_PRESETS = Object.keys(PRESETS).map((k) => ({ id: k, label: PRESETS[k].label || k, default: k === DEFAULT_PRESET, pagePath: PRESETS[k].pagePath || "", judges: PRESETS[k].judges || B.judges || [], features: { ...B.features, ...(PRESETS[k].features || {}) }, overviewDraft: overviewDraft(PRESETS[k]) }));
  Object.assign(B, PRESETS[id], { presetId: id });
})();

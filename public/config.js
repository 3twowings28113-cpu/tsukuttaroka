/*
 * 投稿、つくったろか。── 設定ファイル
 * ネタカード・ハッシュタグ・画面の文言は、ぜんぶここで変えられます。
 * （AIへの指示文は src/ai.js、使うAIモデルは wrangler.jsonc の vars）
 * イベント仕様に戻すときは、このファイルをイベント版と入れ替えるだけ。
 */
window.APP_CONFIG = {
  appName: "投稿、つくったろか。",

  // 画面の色（書いていない色は app.css の初期値）。LinkedInの青と黒が基調。ロゴは使わない
  theme: {
    ground: "#D6E6F7", // 画面の地
    groundText: "#26313D", // 地の上の補足文字
    note: "#F1F7FE", // 補足の囲み
    accent: "#0A66C2", // 押せるもの・選択中
    accentPress: "#004182",
    mark: "#FF7373", // 小さな強調（進み具合・必須）
    check: "#0A66C2", // 投稿前チェックの印
  },
  // 上の小さな文字。eventName を空にすると1行だけになる
  eventSub: "毎日のLinkedIn投稿に",
  eventName: "",

  // どのパターンを選んでも、本文の最後に必ず付くハッシュタグ
  hashtags: ["#LinkedIn", "#振り返り", "#日々の学び"],

  // メンション先（ 使うときだけ設定。name を空にすると、メンションは出ない）
  // inText：true なら、投稿文の最後（ハッシュタグの上）に「@◯◯」を文字で入れる
  mention: { name: "", typeHint: "", inText: false },

  // 主催のLinkedInページURL。空のままならフォローボタンは出ない
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

  // プロフィール文を作る（LinkedInの見出し3案＋自己紹介）。学生向け。enabled: false で入口を出さない
  // cards の id は「p_」で始める（上の cards と重ねない）。required: true は答えないと進めない
  profile: {
    enabled: true,
    openUrl: "https://www.linkedin.com/",
    cards: [
      {
        id: "p_now",
        label: "いまの所属",
        question: "いまの所属は？/（大学・学部・学年など）",
        placeholder: "例：〇〇大学 経済学部の2年生",
        note: "書いたことだけ使うで。出したくないことは書かんでOK",
      },
      {
        id: "p_focus",
        label: "力を入れて/いること",
        question: "いま、/力を入れてることは？",
        placeholder: "例：ゼミでマーケティングを学びながら、学園祭の広報を担当している",
        chips: ["ゼミ・研究", "部活・サークル", "アルバイト", "インターン", "学外の活動"],
        required: true,
      },
      {
        id: "p_strength",
        label: "強み・/よく言われること",
        question: "まわりから/よく言われることや、/得意なことは？",
        placeholder: "例：人の話を最後まで聞くところ、とよく言われる",
        chips: ["話を聞くのが得意", "段取りが得意", "人前で話せる", "コツコツ続けられる", "アイデアを出せる"],
      },
      {
        id: "p_future",
        label: "これから/挑戦したいこと",
        question: "これから挑戦したいことや、/興味のある仕事・業界は？",
        placeholder: "例：人と人をつなぐ仕事に興味がある。まずはインターンに挑戦したい",
      },
      {
        id: "p_connect",
        label: "つながりたい人",
        question: "LinkedInで、/どんな人と/つながりたい？",
        placeholder: "例：同じ業界を目指す学生や、社会人の先輩",
        chips: ["同じ目標の学生", "社会人の先輩", "興味のある業界の人", "海外に関心のある人"],
      },
    ],
    // 自己紹介のちょい直し（id は src/ai.js の PROFILE_ACTIONS と合わせる）
    refineActions: [
      { id: "shorter", label: "もっと短く" },
      { id: "concrete", label: "もっと具体的に" },
      { id: "another", label: "別の言い回し" },
    ],
    // 結果の画面の「LinkedInに入れるには」
    steps: [
      "使いたい見出しの/「コピー」を押す",
      "下の「LinkedInをひらく」→/自分の写真のアイコン→/「プロフィールを表示」",
      "名前の横の鉛筆マークから/「見出し」に貼り付けて保存",
      "この画面にもどって/「自己紹介をコピー」→/「概要（About）」の/鉛筆マークから貼り付けて保存",
    ],
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
  },
  // 選んだ項目の下に出る補足（src/ai.js の決まりと合わせる）
  styleNotes: {
    kansai: { なし: "標準語", ちょい足し: "軽く関西弁をまぜる", こってり: "関西弁。読みやすさは保つ" },
    length: { 短め: "本文120〜200字", ふつう: "本文200〜350字", しっかり: "本文350〜500字" },
    emoji: { なし: "使わない", ちょっと: "1〜2個", 多め: "3〜5個" },
    sign: { なし: "入れへん。/ふつうの投稿文のまま", 入れる: "投稿文の終わりに、/「@山下 翼 のアプリで作りました」的な/1行がつく" },
  },

  // 投稿ガイドで「みんなの投稿を見よう」と案内するハッシュタグ
  feedTag: "#振り返り",

  // 書き方（作り直すときに選ぶ）。id は src/ai.js の MODES と合わせる
  modes: [
    { id: "", tone: "emo", label: "エモい", sub: "気持ちが動いた瞬間から書く" },
    { id: "", tone: "humor", label: "ユーモア", sub: "くすっと笑わせる、軽いノリで" },
    { id: "", tone: "straight", label: "学び", sub: "学びを言い切って、/これからの行動で締める" },
    { id: "first", label: "はじめての投稿", sub: "LinkedInにはじめて投稿する人に。/あいさつと自己紹介つき" },
    { id: "ishizaka", label: "石坂誠風", sub: "見出し【】と「〇」の箇条書きで、/熱く言い切る" },
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
    { id: "ishizaka", label: "見出しスタイル" },
  ],

  // 投稿前に確認すること
  checklist: [
    "個人情報や機密情報を書いていない",
    "写真に写る人の掲載許可をとった",
    "相手の発言や内容を勝手に書いていない",
    "文章とハッシュタグを確認した",
  ],

  // パネラー用ページ（/judge）の「どなたですか？」に出す名前（普段使いでは使わない）
  judges: ["ゲストさん"],

  // 「投稿したで！」の報告（イベントで使うときだけ設定。普段は null でOFF）
  report: null,

  // 「困ったら」で出す案内（画面ごと）。staff はどの画面でもいちばん上に出る
  help: {
    staff: "わからへんときは、/下のヒントをみてな",
    staffSub: "順番どおりで進めたら、必ずできるで。",
    tips: {
      pick: ["最初に、お名前を入れてください（報告などに使うで）", "「じぶんのAIのキーを入れる」は、最初の1回だけ。手順どおりなら5分ぐらい", "ネタは何も選ばんでOK。「このネタで始める」ですすめます", "質問に答えると、LinkedInの投稿文ができます"],
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
  loadingLines: ["ええ感じにまとめてるで…", "塩かげん、調整中…", "3つ並べてるとこ…", "もうちょいや！"],
};

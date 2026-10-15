/*
 * 投稿、つくったろか。── 設定ファイル
 * ネタカード・ハッシュタグ・画面の文言は、ぜんぶここで変えられます。
 * （AIへの指示文は src/ai.js、使うAIモデルは wrangler.jsonc の vars）
 * ここに書いてあるのは「普段使い」の設定。イベントごとの質問セット・色・文言は、いちばん下のプリセット（PRESETS）で上書きする。
 * どのプリセットを使うかは、いちばん下の DEFAULT_PRESET（URLの ?preset=… でも切り替えられる）。
 */
window.APP_CONFIG = {
  appName: "投稿、つくったろか。",

  // 画面の色（書いていない色は app.css の初期値）。LinkedInの青と黒が基調。ロゴは使わない
  theme: {
    ground: "#B4D0F0", // 画面の地
    groundText: "#26313D", // 地の上の補足文字
    note: "#F1F7FE", // 補足の囲み
    accent: "#004182", // 押せるもの・選択中（LinkedInの濃い青）
    accentPress: "#00315F",
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

/*
 * ---------- イベントごとのまとまり（プリセット） ----------
 * 質問セット・色・文言をイベントごとにまとめたもの。上の設定（普段使い）に上書きされる。
 * いま使うのは DEFAULT_PRESET。URLに ?preset=fujitsu のように付けると、そのページだけ切り替わる。
 * イベント名・ハッシュタグ・あいことば（主催のAIキーを使う合言葉）は、運営ページ（/admin）の「イベント」で作る。
 */
(() => {
  const DEFAULT_PRESET = "lscw";
  const B = window.APP_CONFIG;
  const PRESETS = {
    // 普段使い（上の設定そのまま）
    everyday: { label: "普段使い" },

    // LinkedIn Student Career Week（2026/10/31）の学生向けブース
    lscw: {
      label: "LSCW（2026/10/31 学生向けブース）",
      eventSub: "LinkedIn Student Career Week",
      eventName: "",
      // 運営ページのイベントで上書きできる（イベントのハッシュタグが空のときは、これが付く）
      hashtags: ["#LinkedIn"],
      feedTag: "#LinkedIn",
      // 投稿の終わりのほうに「LinkedInを使うとワクワクする／新しい自分の可能性が見つかる」という一文を、すべての投稿に入れる
      cheerAlways: true,
      style: {
        ...B.style,
        role: { ...B.style.role, default: "学生" },
        cheer: { ...B.style.cheer, default: "入れる" },
      },
      cards: [
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
      sets: [
        { id: "one", size: 1, theme: "basic", label: "学び・気づきだけ", who: "いちばん大事なところだけ、ぎゅっと書く", cards: ["learn"], recommended: true },
        { id: "basic3", size: 3, theme: "basic", label: "今日の3つ", who: "迷ったらこれ。今日の流れのまま書ける", cards: ["learn", "session", "next"], recommended: true },
        { id: "career3", size: 3, theme: "career", label: "就活・キャリア", who: "いま考えてることも、正直に残したい人に", cards: ["learn", "career", "next"] },
        { id: "self3", size: 3, theme: "self", label: "自己紹介も", who: "はじめて投稿する人に。自分のことも知ってほしい人に", cards: ["focus", "learn", "next"] },
        { id: "basic5", size: 5, theme: "basic", label: "今日をじっくり", who: "今日の流れが、まるごと伝わる", cards: ["learn", "session", "person", "career", "next"], recommended: true },
        { id: "career5", size: 5, theme: "career", label: "就活・キャリアじっくり", who: "考えてることと、今日の学びをつなげたい人に", cards: ["career", "learn", "session", "focus", "next"] },
        { id: "self5", size: 5, theme: "self", label: "自己紹介もじっくり", who: "はじめて読む人に、自分のことをしっかり伝えたい人に", cards: ["focus", "learn", "person", "career", "next"] },
      ],
      lastCards: ["next", "free"],
      help: {
        ...B.help,
        staff: "近くのスタッフに、/この画面を見せてください",
        staffSub: "いっしょにやります。",
        tips: {
          ...B.help.tips,
          pick: ["最初に、お名前を入れてください", "「投稿文を作る」か「プロフィール文を作る」を選んでください", "ネタは何も選ばんでOK。下の青いボタンで始められます", "質問に答えると、LinkedInの文章ができます"],
        },
      },
    },

    // 2026/10/6「関西を、おもろくする夜。」（FLM主催 LinkedIn大交流会）。当日の設定をそのまま残したもの
    fujitsu: {
      label: "関西を、おもろくする夜。（2026/10/6 富士通ラーニングメディア）",
      theme: { ground: "#FFDE59", groundText: "#3B372E", note: "#FBFFD3", subText: "#6A6456", accent: "#0A66C2", accentPress: "#004182", mark: "#FF7373", check: "#FF5A6F" },
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
      report: {
        screenDefault: true, // 会場スクリーンに名前を出す（初期値）
        screenLabel: "会場スクリーンに/名前を出す",
        screenNote: "「◯◯さんが投稿したで！」と出るで。本文は出えへん。",
        linkHelp: "LinkedInの自分の投稿の/「…」か「共有」から、/リンクをコピーできるで。/なくてもOK。",
        note: "報告した投稿は、パネラーと運営が読むで。",
      },
      help: {
        staff: "近くのスタッフに、/この画面を見せてください",
        staffSub: "いっしょにやります。",
        tips: {
          pick: ["最初に、お名前を入れてください", "「LinkedInページをひらく」で富士通ラーニングメディアをフォローして、「フォローした」にチェック", "迷ったら「おまかせで始める」を押すだけでOK", "質問に答えると、LinkedInの投稿文ができます"],
          answer: ["マイクを押して話すと、文字になります", "うまく入らないときは、キーボードのマイクでも話せます", "ひとことでOK。必須でない質問は「とばす」で次へ"],
          style: ["そのままでOK。下の「つくってもらう」を押してください", "はじめて投稿する人は「書き方」で「はじめての投稿」を選んでください"],
          loading: ["10秒ほど待ってください"],
          result: ["好きな案を選んで「この案でいく」を押してください", "「こうしてほしい」に書くと、そのとおりに直します", "文章は「自分で直す」で直せます"],
          done: ["投稿の前に、富士通ラーニングメディアをフォローしてください", "LinkedInアプリの入力欄を長押しして「貼り付け」", "投稿したら、この画面の「報告する」を押してください。審査員に届きます"],
        },
      },
      consentLabel: "イベント運営にも/回答と投稿文を/共有する",
      consentNote: "振り返りに使います。名前やアカウントは集めません。",
      loadingLines: ["ええ感じにまとめてるで…", "関西弁の塩かげん、調整中…", "3つ並べてるとこ…", "もうちょいや！"],
    },
  };

  let id = DEFAULT_PRESET;
  try {
    const q = new URLSearchParams(location.search).get("preset");
    if (q && PRESETS[q]) id = q;
  } catch {}
  if (!PRESETS[id]) id = "everyday";
  window.APP_PRESETS = Object.keys(PRESETS).map((k) => ({ id: k, label: PRESETS[k].label || k, default: k === DEFAULT_PRESET }));
  Object.assign(B, PRESETS[id], { presetId: id });
})();

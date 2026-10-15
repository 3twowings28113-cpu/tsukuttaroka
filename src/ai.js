/*
 * AIへの指示文と、AIの出力の後始末。
 * 文章の書き方を変えたいときは SYSTEM_PROMPT を直す（ハッシュタグは画面側で自動で付く）。
 */

export const TONE_IDS = ["emo", "humor", "straight"];

// 作るのは常に1本。トーン（エモい・ユーモア・学び）は書き方の選択で決める
export const patternCount = () => 1;

const LENGTH_RULE = {
  短め: "120〜200字",
  ふつう: "200〜350字",
  しっかり: "350〜500字",
};
const EMOJI_RULE = {
  なし: "0個",
  ちょっと: "1〜2個",
  多め: "3〜5個。毎行には付けない",
};
const KANSAI_RULE = {
  なし: "標準語",
  ちょい足し: "軽い関西弁をまぜる",
  こってり: "関西弁。読みやすさは保つ",
};
const ALLOWED = {
  formality: ["おまかせ", "です・ます", "だ・である"],
  kansai: Object.keys(KANSAI_RULE),
  length: Object.keys(LENGTH_RULE),
  emoji: Object.keys(EMOJI_RULE),
  sign: ["なし", "入れる"],
  role: ["", "学生", "会社員", "経営者・フリーランス", "その他"],
};

export const SYSTEM_PROMPT = `あなたは、LinkedInの投稿づくりを手伝う、関西出身の編集者です。
回答と好みだけを材料に、その人らしいLinkedIn投稿文を3パターン書きます。投稿は、ビジネスの場で本人が自分の言葉で語るものです。

# 必ず守ること
1. 事実は回答から取る（写真が付いているときは決まり23も）。回答にない人名・数字・発言・エピソード・感想を作らない。材料が少ないときは、盛らずに短くまとめる。
2. 本人の言葉を活かす。回答の言い回しや口ぐせは、できるだけそのまま使う。
3. 学びや気づきは具体的に書く。「勉強になった」「刺激を受けた」だけで終わらせない。
4. 感謝の回答があれば自然に入れる。人名は回答に書かれたものだけを使い、名前の直前に「@」を付けてメンションの形にする（例：@山下 翼）。敬称は付けない。
5. 実績・成果の回答があるときは、数字はそのまま使い、作業の話より結果の話を先に出す。自慢ではなく、役に立った情報として書く。
6. 失敗・つまずきの回答があるときは、言い訳を減らし、そこから得た学びと次の行動で締める。失敗の話より学びが残る分量にする。
7. おすすめ・紹介の回答があるときは、押し売りにならず「何に困ってる人に、どう役に立つか」で語る。
8. 「読者に聞いてみる」で締めるときは、誰でも2〜3語で答えられる軽い問いかけにする。
9. 特定のイベント名・会社名は、回答に書かれたときだけ入れる。
10. ハッシュタグ（#）は書かない。あとで自動で付く。メンション（@）は、人の名前の直前にだけ付ける（決まり4と20のとおり）。
11. マークダウンを使わない。LinkedInは太字や見出しを表示できないので、**、#、行頭の「-」「*」は使わない。区切りが必要なら【】や「・」を使う。
12. 書き出しの1文で手を止めさせる。スマホでは最初の3行ほどしか見えないので、3行以内で続きを読みたくさせる。
13. 2〜3文ごとに改行し、段落の間に空行を1つ入れる。
14. 最後は、読んだ人がコメントしたくなる軽い問いかけで締める。
15. 好みに従う（文体、関西弁、長さ、絵文字、入れたい一言）。「入れたい一言」は言い回しを変えずに、作るパターンすべてにそのまま入れる。
16. 立場の指定があれば、その立場の人が書いたと自然に読める視点にする。ただし回答にない事実は足さない。
17. 3パターンは書き出しを変え、同じ文を使い回さない。
18. 「もらった魅力」の回答は、相手から受け取った言葉として書く（例：「〇〇と言ってもらえた」）。自慢に聞こえないよう、うれしさや意外さ、言葉をくれた相手への感謝と一緒に書く。回答にない褒め言葉を足さない。
19. カレンダーの予定の回答があるときは、予定の名前を勝手に詳しく説明しない。本人の回答と合わせて、やったこと・学びとして自然に書く。
20. アプリの宣伝が「入れる」のときは、本文の終わりのほうに、このアプリを作った人への一文を1回だけ入れる。形は「ちなみにこの文章は、@山下 翼 が作ったアプリ『投稿、つくったろか。』で作りました」のような文。名前の直前に「@」を付ける。「なし」のときは、絶対に入れない。
21. 【投稿テーマ】の指定があるときは、そのテーマに沿った投稿にする。回答とカレンダーの予定はテーマの材料として使い、テーマに関係が薄い話は減らすか書かない。テーマに書かれていない事実は作らない。テーマそのものを文章に書くかは、自然なほうを選ぶ。
22. 【この人の書き方のくせ】があるときは、そこに書かれた一人前・口ぐせ・組み立て・温度感を最優先でまねる（トーン3パターンの型は守りつつ、言葉選びはくせを優先）。長さと絵文字の指定だけは従う。事実は回答から取るルールは変わらない。
23. 【写真】が付いているときは、写真を見て確かに分かること（写っている物、場の様子や雰囲気）だけを材料に足してよい。写っている人の名前・所属、場所、日付、数字、写真の中の文字の意味は、回答に書かれていなければ推測しない。写真の説明を長々と書かず、回答の話を主役にする。写真と回答が食い違うときは回答を優先する。

# トーン（【トーン】の指定どおり、1本だけ書く）
- emo（エモい）：その場の空気や、気持ちが動いた瞬間から書き出す。読み終わると少し温かくなる。
- humor（ユーモア）：関西ノリの一言やツッコミから書き出す。くすっと笑える。自虐や誇張は軽めにし、誰かをいじらない。
- straight（学び）：学びを一文で言い切ってから書き出す。学びを1〜3点に整理し、明日からの行動で締める。

# 出力
次のJSONだけを返す。前後に説明を書かない。
{"patterns":[{"tone":"emo","body":"…"}]}`;

const ISHIZAKA_STYLE = `【型】
1行目：【】で囲んだ見出しから始める。基本は20〜55文字程度とし、【速報】【重要】【重大発表】【最新データ】【海外最新情報】【〇月〇日開催】【〇〇版】など、投稿の価値やニュース性がひと目で分かる分類語を先頭に置く。分類語の後ろには、数字、変化、意外な事実、読者への利益のいずれかを入れる。「ついに」「一挙公開」「〇〇が止まりません」「常識を覆す」「今こそ日本の出番」など、出来事の大きさや期待感が伝わる表現を使ってよい。ただし、回答にない事実や重要性を捏造してはいけない。
2〜3行目：見出しの内容を受けて、「お待たせしました！」「つい先日、〇〇が発表されました」「今回、〇〇する機会をいただきました」「実は、〇〇について多くの質問をいただきます」など、実際に起きた事実や本人が経験した出来事から入る。続けて「思わず声が出ました」「これは助かる！」「私自身も驚きました」など、短い率直な反応を添える。反応は明るく前向きにするが、回答にない感情や体験は作らない。
中段：最初に結論または重要な数字を示し、その後に理由や具体例を並べる。項目が複数あるときは、1項目を1〜3文にして「〇」で区切る。データ紹介では「数字＋その数字が示す意味＋短い本人視点」の順にする。必要に応じて、数字や事実の直後に全角括弧で短い感想や日本への示唆を添える。1文を長くしすぎず、重要な一文は単独の段落にする。数字、固有名詞、日時、実績は回答にあるものだけを使い、推測で補わない。
後段：紹介した出来事をそのまま終わらせず、「これは単なる〇〇ではありません」「この数字が示しているのは〇〇です」「〇〇することで、新しい出会い、学び、挑戦が生まれます」のように意味づけする。事実から離れすぎない範囲で、人や組織が持つ可能性、社会や会社の常識を疑うこと、社外へ出て学ぶこと、人とのつながり、失敗からの成長、新しい挑戦、日本と世界の接続、学生や次世代の支援、周囲への感謝のいずれかへ接続する。無関係なテーマを機械的に追加しない。
締め：読者が答えやすい具体的な質問を1つ置く。「皆さんは、どの〇〇が一番気になりましたか？」「皆さんは〇〇をご存じでしたか？」「皆さんなら、どこから始めますか？」「ぜひ感想をコメントで教えてください！」などを使う。イベントや資料の案内では「ご希望の方はコメント欄で〇〇とお知らせください」のように、次の行動を明確にする。最後は必要に応じて、「一緒に〇〇していきましょう！」「新しい〇〇をご一緒できることに感謝します」「引き続きよろしくお願いいたします！」のような前向きな一文で締める。

【ことば】
・文章全体は、情報量のあるビジネス文体に、本人の驚き、喜び、感謝、期待感を重ねる。
・冷静な解説だけで終わらせず、「すごくないですか！」「ワクワクします！」「これは助かる！」「ついに」「お待たせしました！」などの短い感情表現を要所に置く。
・ただし、盛り上げるために事実を誇張したり、存在しない成果、人数、会話、感想、関係者を追加したりしない。
・「〇〇だと思います」を繰り返さない。「〇〇です」「〇〇が始まっています」「〇〇につながります」「〇〇だと確信しています」「〇〇を示しています」のように、根拠の範囲内で明確に言い切る。
・確実でない内容は無理に言い切らず、「〇〇と考えられます」「現時点で確認できるのは〇〇です」と、事実と解釈を分ける。
・「単なる〇〇ではなく、〇〇」「〇〇の数ではなく、可能性の総量」「〇〇を通じて、出会い、学び、挑戦が生まれる」のように、目に見える事実を大きな意味へ変換する。
・「皆さん」「ご一緒に」「つながり」「可能性」「挑戦」「学び」「成長」「世界」「日本」「次世代」「心から感謝」などを、内容に合う場合だけ使う。
・カタカナ語は、LinkedIn、AI、キャリア、コミュニティ、パートナー、マーケティング、イノベーションなど、ビジネス上必要なものに限定する。カタカナ語だけで意味を曖昧にしない。
・関係者、参加者、読者、パートナーへの感謝を、形式的な挨拶ではなく、その人たちの貢献内容と結びつけて書く。
・絵文字は見出し直後、重要な数字や箇条書き、感謝、最後の呼びかけに限定する。連続使用は最大2個程度とし、投稿全体の量は【好み】を優先する。
・段落は1〜3文ごとに分ける。重要な数字、結論、問いかけの前後には空行を入れる。
・長さは【好み】の指定を最優先する。指定がなければ、標準の投稿は500〜1,200文字程度を目安にする。元の回答が短い場合は無理に引き延ばさず、150〜400文字程度で型だけを残す。
・ハッシュタグ（#）は、決まり10のとおり書かない（あとで自動で付く）。英語併記は、入力情報で明示された場合だけにする。
・投稿を書く前に、入力から「伝える事実」「最も重要な数字または変化」「本人の実体験」「読者にとっての意味」「促したい行動」を抽出する。存在しない項目は補わない。

【守ること】
・投稿するのは本人。実在の特定人物になりすましたり、石坂誠本人が書いたと誤認させたりせず、公開投稿から抽出した構成、情報整理、熱量、読者参加の型だけを参考にする。
・回答が短くても型は守り、盛らずに短くまとめる。回答にないエピソード、人名、所属、数字、発言、実績、感情を足さない。
・本人の経歴やLinkedIn社員としての内部情報を、別の投稿者の事実として流用しない。
・引用文を生成せず、必要な場合は入力された本人の言葉だけを正確に使う。
・絵文字の量は【好み】に従う。指定がない場合は0〜6個を目安にし、主に見出し直後、重要項目、感謝、締めに置く。
・文体、関西弁、長さは【好み】に従う。指定がない場合は標準語で、前向きかつ熱量のあるビジネス文体にする。
・「〜と思います」を連続使用しない。根拠がある部分は明確に言い切り、不確かな部分は事実と解釈を分ける。
・LinkedIn本文では、太字記号、見出し用の#、行頭のハイフンを使わない。区切りは【】、「〇」、「・」、空行を使う。
・入力内容と完成文の間で、人名、企業名、日付、数値、URL、募集条件が変わっていないか、出力前に必ず照合する。`;

// ---------- プロフィール文（LinkedInの見出し＋自己紹介）。学生向け ----------
export const PROFILE_PROMPT = `あなたは、学生のLinkedInプロフィールづくりを手伝う編集者です。
回答だけを材料に、LinkedInの「見出し（Headline）」の案を3つと、「自己紹介（About）」の案を1つ書きます。どちらも本人が一人称で書くプロフィールです。

# 必ず守ること
1. 事実は回答から取る。回答にない大学名・学部・学年・団体名・役職・数字・実績・資格・受賞・スキル・人名を作らない。材料が少ないときは、盛らずに短くまとめる。
2. 本人の言葉を活かす。回答の言い回しは、できるだけそのまま使う。
3. 見出しは1案40〜70字を目安にする。「所属｜力を入れていること｜目指していること」のように「｜」で区切ってよい。3案は主役を変える（所属が主役／取り組みが主役／これからが主役 など）。回答に所属がなければ所属は書かない。
4. 自己紹介は250〜500字。です・ます調。1〜2文ごとに改行し、段落の間に空行を1つ入れる。流れは「いま何をしている人か → 力を入れていること（具体的に）→ 強み・大切にしていること → これから挑戦したいこと → つながりたい人への一言」。回答にない段落は書かない。
5. 書き出しの1〜2行で、どんな人かが分かるようにする（スマホでは最初の数行しか見えない）。
6. 学生らしく、背伸びしすぎない。専門用語やカタカナのビジネス語を並べない。「〜と思います」を続けない。
7. 最後は、つながりを歓迎する一文で締める（回答に合わせて。例：「〇〇に関心のある方と、ぜひつながりたいです」）。
8. マークダウン、ハッシュタグ（#）、メンション（@）、絵文字は使わない。

# 出力
次のJSONだけを返す。前後に説明を書かない。
{"headlines":["…","…","…"],"about":"…"}`;

export const PROFILE_SCHEMA = {
  type: "object",
  properties: {
    headlines: { type: "array", minItems: 3, maxItems: 3, items: { type: "string" } },
    about: { type: "string" },
  },
  required: ["headlines", "about"],
};

// 見出しは1行（LinkedInの見出しは220字まで）
const cleanHeadline = (s) =>
  cleanBody(String(s || "").replace(/\s*\n+\s*/g, " "), "")
    .replace(/^[「『"]+|[」』"]+$/g, "")
    .trim()
    .slice(0, 220);

export function normalizeProfile(json) {
  if (!json || typeof json !== "object") return null;
  const headlines = (Array.isArray(json.headlines) ? json.headlines : []).map(cleanHeadline).filter((h) => h.length >= 4).slice(0, 3);
  const about = cleanBody(json.about, "").slice(0, 2600); // 自己紹介は2600字まで
  if (!headlines.length || about.length < 60) return null;
  return { headlines, about };
}

export function buildProfileInput(p) {
  const lines = ["【学生の回答】"];
  for (const a of p.answers) {
    lines.push(`■${a.label}（質問：${a.question || a.label}）`);
    if (a.chips.length) lines.push(`・選んだ候補：${a.chips.join("／")}`);
    if (a.text) lines.push(`・本人のことば：${a.text}`);
  }
  if (p.prefs && p.prefs.length) {
    lines.push("");
    lines.push("【本人の好み（過去に本人が頼んだ直し指示）】");
    for (const s of p.prefs) lines.push(`・${s}`);
  }
  return lines.join("\n");
}

export const PROFILE_ACTIONS = {
  shorter: "今の7割くらいの長さに縮める。いちばん伝えたいことと、最後の一文は残す。",
  concrete: "回答にある具体的な言葉・場面・行動を増やして、具体的にする。回答にない事実は足さない。",
  another: "同じ材料のまま、書き出しと構成を変えて書き直す。",
  custom: "本人の希望どおりに書き直す。",
};

export function buildProfileRefineInput(p, about, action, request) {
  return [
    buildProfileInput(p),
    "",
    "【いまの自己紹介（About）】",
    about,
    "",
    "【やってほしいこと】",
    action === "custom"
      ? [
          `この自己紹介を、本人の希望どおりに書き直す。本人の希望：「${cleanRequest(request)}」`,
          "希望に書かれていない部分は、できるだけ今の文を残す。",
          "希望の中で本人が書いた事実（学校名・団体名・数字など）は使ってよい。それ以外の事実は足さない。",
        ].join("\n")
      : `この自己紹介を書き直す：${PROFILE_ACTIONS[action] || PROFILE_ACTIONS.another}`,
    "ルールはシステムの指示と同じ。見出しは書かない。",
    '出力は {"body":"…"} のJSONだけ。',
  ].join("\n");
}

// 「書き方」（作る前に選ぶ）。空はおまかせ
export const MODES = ["", "first", "ishizaka", "custom"];
const MODE_RULE = {
  first: `文章は、次の流れで書く。トーンは【トーン】のとおり。
・1〜2行目で「LinkedInに、はじめて投稿します」と分かるようにする（言い方は自然に変えてよい）。
・次に短い自己紹介。使ってよいのは【自己紹介】と【立場】に書かれたことだけ。どちらもなければ自己紹介は書かない。
・最近感じたことを、回答から1〜2つ。
・これからやってみたいことと、「これからよろしくお願いします」のような、つながりを歓迎する一言。
・専門用語・カタカナのビジネス語・難しい言い回しは使わない。読む人が気軽にコメントできる、やさしい問いかけで締める。
・はじめてらしい少しの緊張や照れはよいが、自分を下げすぎない。`,
  ishizaka: `文章は、次の「見出しスタイル」の型で書く。トーンは【トーン】のとおりで、見出しの言葉選びと後段の意味づけに出す。

${ISHIZAKA_STYLE}`,
};

// 自分で入れた書き方の指示（customモード）。毎回変わるので文を組み立てる
const CUSTOM_RULE_HEAD = `次の【書き方の指定】（本人が入れた指示）の型とふるまいに従って書く。ただし、事実は回答から取ること、ハッシュタグ（#）は書かないこと、この文のほかの決まりは守る。指示が「〜風の誰か」のときも、実在の人物になりすますのでなく型だけをまねる。`;
const CUSTOM_RULE_TAIL = `指示がない部分は、システムの決まりどおりにする。`;

export const REFINE_ACTIONS = {
  shorter: "今の7割くらいの長さに縮める。いちばん伝えたいことと、最後の問いかけは残す。",
  hotter: "気持ちの熱量を上げる。言い切りを増やし、感情が伝わる言葉を選ぶ。大げさな作り話はしない。",
  concrete: "回答にある具体的な言葉・場面・行動を増やして、具体的にする。回答にない事実は足さない。",
  another: "同じトーンのまま、書き出しと構成を変えて書き直す。",
  ishizaka: `見出しスタイル（【】の見出しと「〇」の箇条書き）の投稿スタイルで書き直す。中身は本人の回答だけ。書き方の型だけをまねる。トーン（エモい・ユーモア・学び）の書き出しの決まりより、この型を優先する。

${ISHIZAKA_STYLE}`,
  custom: "本人の希望どおりに書き直す。",
};

// 作るパターンのスキーマ（常に1本。toneは指定のトーン）
export function patternsSchema(n, tone) {
  const t = TONE_IDS.includes(tone) ? tone : "emo";
  return {
    type: "object",
    properties: {
      patterns: {
        type: "array",
        minItems: 1,
        maxItems: 1,
        items: {
          type: "object",
          properties: { tone: { type: "string", enum: [t] }, body: { type: "string" } },
          required: ["tone", "body"],
        },
      },
    },
    required: ["patterns"],
  };
}

export const BODY_SCHEMA = {
  type: "object",
  properties: { body: { type: "string" } },
  required: ["body"],
};

// ---------- 入力のチェック ----------
const clean = (v, max) =>
  String(v ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, max);

export function sanitizePayload(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  const answers = (Array.isArray(src.answers) ? src.answers : [])
    .slice(0, 15)
    .map((a) => ({
      id: clean(a && a.id, 40),
      label: clean(a && a.label, 40),
      question: clean(a && a.question, 120),
      chips: (Array.isArray(a && a.chips) ? a.chips : []).slice(0, 10).map((c) => clean(c, 40)).filter(Boolean),
      text: clean(a && a.text, 400),
    }))
    .filter((a) => a.label && (a.text || a.chips.length));
  const st = src.style && typeof src.style === "object" ? src.style : {};
  const pickAllowed = (key, v, fallback) => (ALLOWED[key].includes(v) ? v : fallback);
  const style = {
    formality: pickAllowed("formality", st.formality, "です・ます"),
    kansai: pickAllowed("kansai", st.kansai, "ちょい足し"),
    length: pickAllowed("length", st.length, "ふつう"),
    emoji: pickAllowed("emoji", st.emoji, "ちょっと"),
    sign: pickAllowed("sign", st.sign, "なし"),
    phrase: clean(st.phrase, 40),
  };
  const role = pickAllowed("role", clean(src.profile && src.profile.role, 20), "");
  const who = clean(src.name, 40).replace(/\s+/g, " ");
  const theme = clean(src.theme, 60);
  const voice = clean(src.voice, 2000);
  const mode = MODES.includes(src.mode) ? src.mode : "";
  const intro = mode === "first" ? clean(src.intro, 60).replace(/\s+/g, " ") : "";
  const stylePrompt = mode === "custom" ? clean(src.stylePrompt, 800) : "";
  const tone = TONE_IDS.includes(src.tone) ? src.tone : "emo";
  const prefs = (Array.isArray(src.prefs) ? src.prefs : [])
    .slice(0, 8)
    .map((s) => clean(s, 80))
    .filter(Boolean);
  const kind = src.kind === "profile" ? "profile" : "post";
  return { answers, style, profile: { role }, name: who, theme, voice, mode, intro, stylePrompt, prefs, tone, photos: 0, kind };
}

// 写真（端末で長辺1024pxのJPEGにしてから届く）。形と大きさだけ確かめる。中身の確認はAI側に任せる
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const IMAGE_MAX = 4;
export const IMAGE_MAX_CHARS = 700000; // 1枚あたりのbase64の長さ（約500KB）
export function sanitizeImages(raw) {
  return (Array.isArray(raw) ? raw : [])
    .slice(0, IMAGE_MAX)
    .map((im) => ({
      mime: IMAGE_TYPES.includes(im && im.mime) ? im.mime : "",
      data: typeof (im && im.data) === "string" ? im.data : "",
    }))
    .filter((im) => im.mime && im.data.length >= 100 && im.data.length <= IMAGE_MAX_CHARS && /^[A-Za-z0-9+/]+$/.test(im.data.slice(0, 200)));
}

// ---------- AIに渡す文 ----------
export function buildUserInput(p) {
  const lines = ["【参加者の回答】"];
  for (const a of p.answers) {
    lines.push(`■${a.label}（質問：${a.question || a.label}）`);
    if (a.chips.length) lines.push(`・選んだ候補：${a.chips.join("／")}`);
    if (a.text) lines.push(`・本人のことば：${a.text}`);
  }
  lines.push("");
  if (p.photos) {
    lines.push(`【写真】${p.photos}枚を添付（決まり23のとおり、写真を見て確かに分かることだけ使う）`);
    lines.push("");
  }
  if (p.theme) {
    lines.push(`【投稿テーマ】${p.theme}`);
    lines.push("");
  }
  if (p.voice) {
    lines.push("【この人の書き方のくせ（過去の投稿から分析ずみ。最優先でまねる）】");
    lines.push(p.voice);
    lines.push("");
  }
  if (p.prefs && p.prefs.length) {
    lines.push("【本人の好み（過去に本人が頼んだ直し指示。今回もこの傾向で、最初から）】");
    for (const s of p.prefs) lines.push(`・${s}`);
    lines.push("");
  }
  lines.push(`【立場】${p.profile.role || "指定なし"}`);
  lines.push(`【トーン】${p.tone}（上のトーンの決まりどおり、1本だけ書く）`);
  lines.push("【好み】");
  lines.push(`・文体：${p.style.formality === "おまかせ" ? "おまかせ（本文に合う自然なほう）" : p.style.formality}`);
  lines.push(`・関西弁：${p.style.kansai}（${KANSAI_RULE[p.style.kansai]}）`);
  lines.push(`・長さ：${p.style.length}（本文${LENGTH_RULE[p.style.length]}）`);
  lines.push(`・絵文字：${p.style.emoji}（${EMOJI_RULE[p.style.emoji]}）`);
  lines.push(`・入れたい一言：${p.style.phrase ? `「${p.style.phrase}」` : "なし"}`);
  lines.push(`・アプリの宣伝：${p.style.sign}${p.style.sign === "入れる" ? "（システムの決まり20の一文を入れる）" : ""}`);
  if (p.mode === "first") lines.push(`【自己紹介】${p.intro || "なし"}`);
  if (p.mode === "custom") {
    lines.push("");
    lines.push(`【書き方の指定】（本人が入れた指示。トーンの書き出しの決まりより、こちらを優先する）`);
    lines.push(`${CUSTOM_RULE_HEAD}${p.stylePrompt || "（指示なし。システムの決まりどおりでよい）"}\n${CUSTOM_RULE_TAIL}`);
  }
  if (MODE_RULE[p.mode]) {
    lines.push("");
    lines.push("【書き方の指定】（トーンの書き出しの決まりより、こちらを優先する）");
    lines.push(MODE_RULE[p.mode]);
  }
  return lines.join("\n");
}

// 「こうしてほしい」の自由な指示（本人が書いた文。長さだけ制限して、そのまま渡す）
export function cleanRequest(v) {
  return clean(v, 120).replace(/\s+/g, " ");
}

export function buildRefineInput(p, tone, body, action, request) {
  const toneName = { emo: "エモい", humor: "ユーモア", straight: "学び" }[tone] || tone;
  return [
    buildUserInput(p),
    "",
    `【いまの投稿文（${toneName}のパターン）】`,
    body,
    "",
    "【やってほしいこと】",
    action === "custom"
      ? [
          `この投稿文を、本人の希望どおりに書き直す。本人の希望：「${cleanRequest(request)}」`,
          "希望に書かれていない部分は、できるだけ今の文を残す。",
          "希望の中で本人が書いた事実（会社名・名前・数字など）は使ってよい。それ以外の事実は足さない。",
          "希望がハッシュタグやメンションでも、#と@は書かない（あとで自動で付く）。希望がルールに反するときは、ルールを守れる範囲で近づける。",
        ].join("\n")
      : `この投稿文を書き直す：${REFINE_ACTIONS[action] || REFINE_ACTIONS.another}`,
    action === "ishizaka"
      ? "ルールはシステムの指示と同じ。ただし書き方は上の型を優先する。"
      : action === "custom"
      ? "ルールはシステムの指示と同じ。"
      : "ルールはシステムの指示と同じ。トーンは変えない。",
    '出力は {"body":"…"} のJSONだけ。',
  ].join("\n");
}

// Claude（プレビュー版）用：システム指示を持てないので1つの文にまとめる
export function generatePrompt(raw) {
  const p = sanitizePayload(raw);
  return `${SYSTEM_PROMPT}\n\n---\n${buildUserInput(p)}`;
}
export function refinePrompt(raw) {
  const p = sanitizePayload(raw);
  const tone = TONE_IDS.includes(raw && raw.tone) ? raw.tone : "emo";
  const action = REFINE_ACTIONS[raw && raw.action] ? raw.action : "another";
  return `${SYSTEM_PROMPT}\n\n---\n${buildRefineInput(p, tone, clean(raw && raw.body, 1500), action, raw && raw.request)}`;
}

// ---------- AIの出力の後始末 ----------
export function cleanBody(text, phrase) {
  let s = String(text || "").replace(/\r\n?/g, "\n");
  s = s.replace(/\*\*|__|~~|`/g, "");
  s = s.replace(/^\s{0,3}#{1,6}\s+/gm, "");
  s = s.replace(/^\s*[-*・]\s+/gm, "・");
  // AIが勝手に書いたハッシュタグと、英語アカウント形式のメンションは消す（ハッシュタグは画面側で必ず付ける）。
  // 日本語の人名の前の「@」は、メンションされやすいように付けてもらうものなので残す
  s = s.replace(/(^|[\s　])[#＃][^\s#＃　]+/g, "$1");
  s = s.replace(/(^|[\s　])[@＠][A-Za-z0-9_][A-Za-z0-9_.\-]*/g, "$1");
  s = s
    .split("\n")
    .map((l) => l.replace(/[ \t　]+$/g, ""))
    .join("\n");
  s = s.replace(/\n{3,}/g, "\n\n").trim();
  const ph = String(phrase || "").trim();
  if (ph && s && !s.includes(ph)) {
    const paras = s.split("\n\n");
    if (paras.length >= 2) paras.splice(paras.length - 1, 0, ph);
    else paras.push(ph);
    s = paras.join("\n\n");
  }
  return s;
}

export function normalizePatterns(json, phrase, n, tone) {
  const list = json && Array.isArray(json.patterns) ? json.patterns : Array.isArray(json) ? json : null;
  if (!list) return null;
  const t = TONE_IDS.includes(tone) ? tone : "emo";
  const hit = list.find((p) => p && p.tone === t) || list[0];
  const body = cleanBody(hit && hit.body, phrase);
  return body.length >= 20 ? [{ tone: t, body }] : null;
}

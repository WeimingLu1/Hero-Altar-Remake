export type ParsedNpcDialogue = {
  state: string;
  action: string;
  speech: string;
};

export type AmbientDialogueBeatKind =
  | "opening"
  | "answer"
  | "respond"
  | "detail"
  | "stance"
  | "question";

export type AmbientDialogueBeat = {
  kind: AmbientDialogueBeatKind;
  allowQuestion: boolean;
  instruction: string;
};

/**
 * Give each ambient turn a distinct conversational job. Questions are only a
 * periodic option; a real question always forces the next speaker to answer
 * with a statement, preventing the model from turning every line into a
 * question-shaped prompt.
 */
export function ambientDialogueBeat(
  turnIndex: number,
  previousLine = "",
  opening = false,
): AmbientDialogueBeat {
  const previousWasQuestion = /[？?][”"’』】）)]*\s*$/.test(previousLine.trim());
  if (opening) return {
    kind: "opening",
    allowQuestion: false,
    instruction: "用一句具体陈述自然开题，可以说眼前见闻、判断、抱怨或打算；句末用句号或感叹号，不要提问。",
  };
  if (previousWasQuestion) return {
    kind: "answer",
    allowQuestion: false,
    instruction: "上一句是问题，先给出明确回答，再补一条相关信息；不要反问，句末用句号或感叹号。",
  };
  const beat = ((turnIndex % 4) + 4) % 4;
  if (beat === 1) return {
    kind: "detail",
    allowQuestion: false,
    instruction: "承接上一句，补充一个具体见闻、细节或经历；不要提问，句末用句号或感叹号。",
  };
  if (beat === 2) return {
    kind: "stance",
    allowQuestion: false,
    instruction: "对当前话题表达明确态度、判断、赞同或反驳，并说明一点缘由；不要提问。",
  };
  if (beat === 3) return {
    kind: "question",
    allowQuestion: true,
    instruction: "只有话题确实需要对方补充时，才提出一个自然且具体的问题；最多一个问号，也可以改用陈述继续。",
  };
  return {
    kind: "respond",
    allowQuestion: false,
    instruction: "先对上一句作出真实反应，再给出自己的信息或判断；不要用问题把回应推回对方。",
  };
}

/**
 * Keep useful declarative clauses when a small local model ignores the current
 * beat and appends another question. A question beat may contain one question;
 * statement beats contain none. Returning null lets the runtime cancel an
 * unusable line instead of displaying forced or semantically altered prose.
 */
export function applyAmbientDialogueBeat(
  text: string,
  beat: AmbientDialogueBeat,
): string | null {
  const clauses = text
    .match(/[^。！？!?；]+[。！？!?；]?/g)
    ?.map((clause) => clause.trim())
    .filter(Boolean) || [];
  let questions = 0;
  const kept = clauses.filter((clause) => {
    if (!/[？?]/.test(clause)) return true;
    questions += 1;
    return beat.allowQuestion && questions === 1;
  });
  const result = kept.join("").trim();
  return result || null;
}

export function parseNpcDialogue(raw: string): ParsedNpcDialogue {
  const pick = (label: string, next?: string) => {
    const tail = next ? `(?=\\n\\s*(?:${next})[：:]|$)` : "$";
    return raw.match(new RegExp(`(?:^|\\n)${label}[：:]\\s*([\\s\\S]*?)${tail}`))?.[1]?.trim() || "";
  };
  return {
    state: pick("状态", "动作|语言"),
    action: pick("动作", "语言"),
    speech: pick("语言") || (!/[状态动作语言][：:]/.test(raw) ? raw.trim() : ""),
  };
}

/**
 * Active-talk output keeps natural vocatives but removes model formatting and
 * stage directions so the dual-portrait layer always receives spoken dialogue.
 */
export function cleanActiveDialogue(raw: string, speakerName = "") {
  const parsed = parseNpcDialogue(raw),
    source = parsed.speech || raw,
    escapedName = escapedPattern([speakerName]),
    cleaned = source
      .replace(/[*_`#]/g, "")
      .replace(/(?:^|\n)\s*(?:状态|动作|神态|表情|姿态|旁白|环境)[：:].*(?=\n|$)/g, " ")
      .replace(/[（(【[][^）)】\]]{0,120}[）)】\]]/g, " ")
      .replace(new RegExp(`^\\s*(?:${escapedName})(?:说道|问道|答道|说|问|答|道)?[：:,，]?\\s*`, "i"), "")
      .replace(/^\s*(?:语言|台词)[：:]\s*/, "")
      .replace(/^\s*[“"]|[”"]\s*$/g, "")
      .replace(/\s+/g, " ")
      .trim();
  return cleaned || "……";
}

function escapedPattern(values: string[]) {
  const escaped = values
    .filter(Boolean)
    .map((value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return escaped.length ? escaped.join("|") : "(?!)";
}

/** Returns only a spoken line. Invalid/meta output is represented by null. */
export function cleanAmbientSpeech(
  raw: string,
  forbiddenNames: string[] = [],
): string | null {
  const parsed = parseNpcDialogue(raw),
    speechOnly = parsed.speech || raw,
    namePattern = escapedPattern(forbiddenNames),
    withoutDirections = speechOnly
      .replace(/(?:^|\n)\s*(?:状态|动作|神态|表情|姿态|旁白)[：:].*(?=\n|$)/g, " ")
      .replace(/[（(【[].*?[）)】\]]/g, " ")
      .replace(/^\s*(?:甲|乙|语言|台词)[：:]\s*/, "")
      .replace(/^[^：\n]{1,20}\s+to\s+[^：\n]{1,20}[：:]\s*/, "")
      .replace(/[^，。！？；：\n“”]{1,16}\s+to\s+[^，。！？；：\n“”]{1,16}/gi, " ")
      .replace(/(?:谁|某人|某某|发言者)\s*(?:对|到|to)\s*(?:谁|某人|某某|接收者)/gi, " ")
      .replace(/(?:发言者|接收者|说话者|对话对象|外层|气泡|格式|路由|标记)[：:]?/g, " ")
      .replace(new RegExp(`^(?:${namePattern})(?:说|说道|问道|答道|道)?[：:,，]?\\s*`, "g"), "")
      .replace(new RegExp(`(?:对|向)(?:${namePattern})(?:说|说道|问道|答道)[：:,，]?\\s*`, "g"), "")
      .replace(new RegExp(`(?:${namePattern})`, "g"), "")
      .replace(/[*_`#]/g, "")
      .replace(/[“”]/g, "")
      .replace(/\s+/g, " ")
      .trim(),
    narration = /(?:风|雨|雪|月光|阳光|雾|云|竹林|树影|花瓣|衣袖|发丝|眼眸|目光|嘴角|声音|回声).{0,14}(?:吹|掠|穿|落|摇|映|响|传|动|起|泛|垂|飘)|(?:微微|轻轻|缓缓|悄然).{0,10}(?:动|笑|抬|垂|转|望|看|吹|走|摇|点|皱)|(?:她|他|其).{0,12}(?:指尖|手指|抬眼|扫过|滑入|缩回|蹭了蹭|盯着|看向|望向|点了点)|(?:站|坐|走|立|倚)在.{0,14}(?:上|下|旁|边|前|后|中)/,
    spokenClauses = withoutDirections
      .split(/(?<=[，。！？；])/)
      .filter((clause) => !narration.test(clause))
      .join("")
      .trim();
  return spokenClauses &&
    !/^(?:……|没有台词|无台词|无|暂无)$/.test(spokenClauses) &&
    !/^(?:to|谁|某某|格式|接收者|发言者)+$/i.test(spokenClauses)
    ? spokenClauses
    : null;
}

/** Returns only an observable action. Empty/fallback model output is null. */
export function cleanAmbientAction(
  raw: string,
  forbiddenNames: string[] = [],
): string | null {
  const action = (parseNpcDialogue(raw).action || raw)
    .replace(/(?:^|\n)\s*(?:状态|语言|台词|解释|旁白)[：:].*(?=\n|$)/g, " ")
    .replace(/^\s*(?:动作)[：:]\s*/, "")
    .replace(/[（(【[].*?[）)】\]]/g, " ")
    .replace(new RegExp(`(?:${escapedPattern(forbiddenNames)})`, "g"), "")
    .replace(/[*_`#“”]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return action && !/^(?:没有动作|无动作|无|暂无|……)$/.test(action)
    ? action
    : null;
}

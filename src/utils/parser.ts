type Flag = "H" | "L" | "N" | "A";

export type ParsedObservation = {
  name: string;
  value: number | string;
  unit: string;
  low: number | null;
  high: number | null;
  flag: Flag;
  rangeText: string;
  sectionHint?: string;
  raw: string;
};

const QUAL_VALUES = new Set([
  "absent",
  "negative",
  "normal",
  "present",
  "trace",
  "hazy",
  "clear",
  "light red",
  "pale yellow",
  "other",
]);

const SECTION_HINTS = [
  "liver function test",
  "lft",
  "rft",
  "renal",
  "kidney",
  "electrolytes",
  "cbc",
  "haemogram",
  "urine",
  "clinical chemistry",
];

const UNIT_RE =
  /\b(mg\/dL|g\/dL|gm\/dL|mmol\/L|U\/L|U\/Lt|fL|pg|%|\/hpf|C\s*\/hpf|cells\/cu\.?mm|10\^3\/\S+|Years?)\b/i;
const NUMERIC_VALUE_RE = /^-?\d+(?:\.\d+)?(?:,\d{3})*$/;
const RANGE_RE = /(-?\d+(?:\.\d+)?)\s*(?:-|to)\s*(-?\d+(?:\.\d+)?)/i;

function normalizeSpaces(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function stripMarkup(s: string): string {
  return normalizeSpaces(
    s
      .replace(/<[^>]*>/g, " ")
      .replace(/[#*_`~|]/g, " ")
      .replace(/\b\/?(?:b|u|i|br|small)\b/gi, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/\\/g, " ")
  );
}

function toNumber(s: string): number {
  return Number(s.replace(/,/g, ""));
}

function isSeparatorLike(s: string): boolean {
  const t = stripMarkup(s);
  if (!t) return true;
  return /^[-–—_=.:|/\\\s]{3,}$/.test(t);
}

function looksLikeImageArtifact(s: string): boolean {
  const l = s.toLowerCase();
  return (
    l.includes("qr code") ||
    l.includes("barcode") ||
    l.includes("img.jpg") ||
    l.includes(".jpg") ||
    l.includes(".png") ||
    l.includes("sample identification") ||
    l.includes("background illustration")
  );
}

function isBadName(name: string): boolean {
  const l = name.toLowerCase();
  return (
    !l ||
    isSeparatorLike(l) ||
    looksLikeImageArtifact(l) ||
    l === "investigation" ||
    l.includes("observed value") ||
    l.includes("biological reference interval") ||
    l === "test description" ||
    l.includes("test description observed") ||
    l.startsWith("age:") ||
    l === "age" ||
    l.includes("sex:") ||
    l.includes("laboratory accredited as per iso") ||
    l.startsWith("male :") ||
    l.startsWith("female :") ||
    l.startsWith("gfr with creatinine (above")
  );
}

function isMetadataLine(line: string): boolean {
  const l = stripMarkup(line).toLowerCase();

  const noise = [
    "name :",
    "age / gender",
    "contact no",
    "address",
    "pin code",
    "vid no",
    "pid no",
    "referred by",
    "registered on",
    "collected on",
    "reported on",
    "medical laboratory report",
    "sample collected at",
    "processing location",
    "page ",
    "dr.",
    "reg no",
    "reference:",
    "sid:",
    "-- end of report --",
  ];

  if (!l) return true;
  if (line.length > 220) return true;
  if (isSeparatorLike(l)) return true;
  if (looksLikeImageArtifact(l)) return true;
  return noise.some((n) => l.includes(n));
}

function normalizeSectionTitle(line: string): string {
  const l = stripMarkup(line).toLowerCase();
  if (l.includes("lft") || l.includes("liver function")) return "LFT (Liver Function Test)";
  if (l.includes("rft") || l.includes("renal") || l.includes("kidney")) return "RFT (Kidney Function Test)";
  if (l.includes("electrolytes")) return "Electrolytes";
  if (l.includes("cbc") || l.includes("haemogram")) return "CBC (Complete Blood Count)";
  if (l.includes("urine")) return "Urine Examination";
  if (l.includes("clinical chemistry")) return "Clinical Chemistry";
  return stripMarkup(line);
}

function detectSection(line: string): string | undefined {
  const l = stripMarkup(line).toLowerCase();
  if (SECTION_HINTS.some((h) => l.includes(h))) return normalizeSectionTitle(line);
  return undefined;
}

function parseReference(raw: string): { low: number | null; high: number | null; text: string } {
  const text = stripMarkup(raw);
  if (!text) return { low: null, high: null, text: "" };

  const mRange = text.match(RANGE_RE);
  if (mRange) {
    return { low: toNumber(mRange[1]), high: toNumber(mRange[2]), text };
  }

  const mLt = text.match(/(?:<|<=|upto|up to)\s*(-?\d+(?:\.\d+)?)/i);
  if (mLt) return { low: null, high: toNumber(mLt[1]), text };

  const mGt = text.match(/(?:>|>=)\s*(-?\d+(?:\.\d+)?)/i);
  if (mGt) return { low: toNumber(mGt[1]), high: null, text };

  return { low: null, high: null, text };
}

function splitUnitAndRange(text: string): { unit: string; rangeText: string } {
  const cleaned = stripMarkup(text);
  if (!cleaned) return { unit: "", rangeText: "" };

  const unitMatch = cleaned.match(UNIT_RE);
  const rangeMatch = cleaned.match(RANGE_RE);

  let unit = unitMatch ? unitMatch[1] : "";
  let rangeText = "";

  if (rangeMatch) {
    rangeText = `${rangeMatch[1]}-${rangeMatch[2]}`;
  } else {
    const ltGt = cleaned.match(/(?:<|<=|>|>=|upto|up to)\s*-?\d+(?:\.\d+)?/i);
    if (ltGt) rangeText = ltGt[0];
  }

  if (!rangeText && (cleaned.includes(" to ") || cleaned.includes("-"))) {
    rangeText = cleaned;
  }

  return { unit: normalizeSpaces(unit), rangeText: normalizeSpaces(rangeText) };
}

function computeFlag(
  value: number | string,
  low: number | null,
  high: number | null,
  rangeText: string,
  refText: string
): Flag {
  if (typeof value === "number") {
    if (low !== null && value < low) return "L";
    if (high !== null && value > high) return "H";
    return "N";
  }

  const v = normalizeSpaces(String(value).toLowerCase());
  const ref = normalizeSpaces((rangeText || refText).toLowerCase());

  if (!v) return "A";
  if (!ref) return "A";
  if (ref.includes(v)) return "N";

  if (["present", "trace", "hazy"].includes(v) && (ref.includes("absent") || ref.includes("clear"))) {
    return "H";
  }

  return "A";
}

function cleanName(name: string): string {
  return normalizeSpaces(
    stripMarkup(name)
      .replace(/\(serum.*?\)/gi, "")
      .replace(/\(edta.*?\)/gi, "")
      .replace(/\(.*?method.*?\)/gi, "")
  );
}

function parsePipeRow(line: string): ParsedObservation | null {
  if (!line.includes("|")) return null;

  const cols = line
    .split("|")
    .map((c) => stripMarkup(c))
    .filter(Boolean);

  if (cols.length < 2) return null;

  const name = cleanName(cols[0]);
  if (isBadName(name)) return null;

  let valueRaw = cols[1] || "";
  let unitRaw = cols[2] || "";
  let rangeRaw = cols[3] || "";

  if (isSeparatorLike(valueRaw) || isSeparatorLike(unitRaw) || isSeparatorLike(rangeRaw)) {
    return null;
  }

  if (!rangeRaw && unitRaw && (unitRaw.match(RANGE_RE) || /(?:<|>|upto|up to)/i.test(unitRaw))) {
    rangeRaw = unitRaw;
    unitRaw = "";
  }

  const value: number | string = NUMERIC_VALUE_RE.test(valueRaw) ? toNumber(valueRaw) : valueRaw;

  if (!rangeRaw && unitRaw && QUAL_VALUES.has(unitRaw.toLowerCase()) && typeof value === "string") {
    rangeRaw = unitRaw;
    unitRaw = "";
  }

  const split = splitUnitAndRange(`${unitRaw} ${rangeRaw}`.trim());
  const ref = parseReference(rangeRaw || split.rangeText);

  let unit = unitRaw || split.unit;
  let rangeText = ref.text || split.rangeText || "-";

  // prevent range accidentally becoming unit
  if (!unit && UNIT_RE.test(rangeText)) {
    const unitMatch = rangeText.match(UNIT_RE);
    if (unitMatch) {
      unit = unitMatch[1];
      rangeText = normalizeSpaces(rangeText.replace(unitMatch[1], ""));
      if (!rangeText) rangeText = "-";
    }
  }

  const flag = computeFlag(value, ref.low, ref.high, rangeText, rangeRaw);

  return {
    name,
    value,
    unit: normalizeSpaces(unit),
    low: ref.low,
    high: ref.high,
    flag,
    rangeText: normalizeSpaces(rangeText) || "-",
    raw: line,
  };
}

function parseInlineNumericRow(line: string): ParsedObservation | null {
  const cleaned = stripMarkup(line);
  if (!cleaned || isSeparatorLike(cleaned)) return null;
  if (looksLikeImageArtifact(cleaned)) return null;
  if (/\d{2}\/\d{2}\/\d{4}/.test(cleaned)) return null;

  const match = cleaned.match(/^(.*?)(-?\d+(?:\.\d+)?)\s+(.*)$/);
  if (!match) return null;

  const name = cleanName(match[1]);
  if (isBadName(name)) return null;

  const value = toNumber(match[2]);
  const tail = normalizeSpaces(match[3]);

  if (isSeparatorLike(tail)) return null;

  const unitFromTail = tail.match(UNIT_RE)?.[1] || "";
  const ref = parseReference(tail);

  if (!unitFromTail && !ref.text) return null;

  const rangeText = ref.text || "-";
  const flag = computeFlag(value, ref.low, ref.high, rangeText, tail);

  return {
    name,
    value,
    unit: unitFromTail,
    low: ref.low,
    high: ref.high,
    flag,
    rangeText,
    raw: line,
  };
}

export function parseOCRText(text: string): ParsedObservation[] {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  const observations: ParsedObservation[] = [];
  const seen = new Set<string>();
  let activeSection: string | undefined;

  for (const line of lines) {
    if (isMetadataLine(line)) continue;

    const section = detectSection(line);
    if (section) {
      activeSection = section;
      continue;
    }

    const parsed = parsePipeRow(line) || parseInlineNumericRow(line);
    if (!parsed) continue;
    if (isBadName(parsed.name)) continue;

    const key = `${parsed.name}|${parsed.value}|${parsed.unit}|${parsed.rangeText}`;
    if (seen.has(key)) continue;
    seen.add(key);

    parsed.sectionHint = activeSection;
    observations.push(parsed);
  }

  return observations;
}
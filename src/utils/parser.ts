export type ParsedObservation = {
  name: string;
  originalName: string;
  value: number;
  unit: string;
  low: number;
  high: number;
  flag: "L" | "H" | "N";
  needsReview?: boolean;
};

const NAME_ALIASES: Record<string, string> = {
  haemoglobin: "Hemoglobin",
  "haemoglobin hb": "Hemoglobin",
  "hemoglobin hb": "Hemoglobin",
  "erythrocyte rbc count": "RBC Count",
  "total leucocytes wbc count": "WBC Count",
  "total leukocytes wbc count": "WBC Count",
  "bilirubin indirect": "Bilirubin Indirect",
  "bilirubin direct": "Bilirubin Direct",
  "bilirubin total": "Bilirubin Total",
  "albumin globulin ratio": "Albumin/Globulin Ratio",
};

const IGNORE_PREFIXES = [
  "name",
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
  "page ",
  "dr.",
  "md (",
  "h.o.d.",
  "reg no",
  "medical laboratory report",
  "sample collected at",
  "processing location",
  "investigation",
  "routine examination profile",
  "general examination",
  "chemical examination",
  "microscopic examination",
  "remark",
  "pathologist remark",
  "-- ",
];

const IGNORE_CONTAINS = [
  "mild decrease",
  "moderate to severe decrease",
  "severe decrese",
  "kidney failure",
  "normal or high",
  "equation is not valid",
  "all urine samples are checked",
  "test done on",
  "no abnormality detected",
  "c represents critical results",
  "biological reference interval",
  "observed value",
];

// Medical-ish units supported in this assignment scope.
const UNIT_PATTERN =
  "(?:mg\\/dL|gm\\/dL|g\\/dL|U\\/L|mmol\\/L|mL\\/min\\/1\\.73m²|cells\\/cu\\.mm|mill\\/cu\\.mm|fL|pg|%|\\/hpf|10\\^3\\/μL|10\\^3\\/uL|Years|1)";

function normalizeLine(input: string): string {
  return input
    .replace(/\*\*/g, "")
    .replace(/[_`]/g, "")
    .replace(/\t/g, " ")
    .replace(/[|]/g, " ")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function parseNumber(raw: string): number {
  return Number(raw.replace(/,/g, "").trim());
}

function shouldIgnoreLine(line: string): boolean {
  const l = line.toLowerCase();
  if (IGNORE_PREFIXES.some((p) => l.startsWith(p))) return true;
  if (IGNORE_CONTAINS.some((k) => l.includes(k))) return true;
  // Skip obvious non-lab string values
  if (/\b(?:absent|negative|trace|present|clear|hazy|normal)\b/i.test(l) && !/\d/.test(l)) return true;
  return false;
}

function cleanName(rawName: string): string {
  // Remove method/sample context in parentheses and OCR artifacts.
  const withoutContext = rawName
    .replace(/\((serum|edta|chromogenic|protein|diazo|ifcc|urease|enzymatic|jaffes|calculated|biuret|bromocresol|molybdate|arsenazo).*?\)/gi, "")
    .replace(/\b(?:serum|plasma|blood|urine)\b/gi, " ")
    .replace(/[:.,]+$/g, " ")
    .replace(/[^\w\s/()-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Requirement: remove numbers from names.
  const noNumbers = withoutContext
    .replace(/\b\d+(?:\.\d+)?\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Normalize brackets/hyphens to spaces for alias lookup.
  const aliasKey = noNumbers
    .toLowerCase()
    .replace(/[()/-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return NAME_ALIASES[aliasKey] || noNumbers;
}

function flagFromRange(value: number, low: number, high: number): "L" | "H" | "N" {
  if (value < low) return "L";
  if (value > high) return "H";
  return "N";
}

function parseReferenceRange(raw: string): { low: number; high: number } | null {
  const text = raw.toLowerCase().trim();

  const hyphen = text.match(/(-?\d+(?:\.\d+)?)\s*-\s*(-?\d+(?:\.\d+)?)/);
  if (hyphen) {
    const low = parseNumber(hyphen[1]);
    const high = parseNumber(hyphen[2]);
    if (!Number.isNaN(low) && !Number.isNaN(high)) return { low, high };
  }

  const lt = text.match(/^<\s*(-?\d+(?:\.\d+)?)/);
  if (lt) {
    const high = parseNumber(lt[1]);
    if (!Number.isNaN(high)) return { low: 0, high };
  }

  const gt = text.match(/^(?:>|above)\s*(-?\d+(?:\.\d+)?)/);
  if (gt) {
    const low = parseNumber(gt[1]);
    if (!Number.isNaN(low)) return { low, high: low * 2 }; // fallback; validator will mark needsReview
  }

  return null;
}

function parseObservedValue(raw: string): { value: number; needsReview: boolean } | null {
  const text = raw.trim().toLowerCase();

  // Observed value as range: 6-8 or 12-15 -> average + needsReview
  const observedRange = text.match(/^(-?\d+(?:\.\d+)?)\s*-\s*(-?\d+(?:\.\d+)?)$/);
  if (observedRange) {
    const a = parseNumber(observedRange[1]);
    const b = parseNumber(observedRange[2]);
    if (Number.isNaN(a) || Number.isNaN(b)) return null;
    return { value: (a + b) / 2, needsReview: true };
  }

  // Observed value as comparator: >100 or <5 -> numeric part + needsReview
  const observedComparator = text.match(/^[<>]\s*(-?\d+(?:\.\d+)?)$/);
  if (observedComparator) {
    const v = parseNumber(observedComparator[1]);
    if (Number.isNaN(v)) return null;
    return { value: v, needsReview: true };
  }

  // Plain numeric
  const plain = parseNumber(text);
  if (!Number.isNaN(plain)) return { value: plain, needsReview: false };

  return null;
}

function buildObservation(args: {
  rawName: string;
  rawValue: string;
  rawUnit?: string;
  rawRange: string;
  forcedReview?: boolean;
}): ParsedObservation | null {
  const name = cleanName(args.rawName);
  if (!name) return null;

  const observed = parseObservedValue(args.rawValue);
  if (!observed) return null;

  const ref = parseReferenceRange(args.rawRange);
  if (!ref) return null;

  const unit = (args.rawUnit || "1").trim();
  const flag = flagFromRange(observed.value, ref.low, ref.high);

  return {
    name,
    originalName: normalizeLine(args.rawName),
    value: observed.value,
    unit,
    low: ref.low,
    high: ref.high,
    flag,
    needsReview: Boolean(args.forcedReview || observed.needsReview),
  };
}

export function parseOCRText(text: string): ParsedObservation[] {
  const lines = text.split("\n").map(normalizeLine).filter(Boolean);
  const observations: ParsedObservation[] = [];

  // name value unit range
  const pA = new RegExp(
    `^([A-Za-z][A-Za-z0-9\\s,./()%-]+?)\\s+([<>]?[\\d,]+(?:\\.\\d+)?(?:\\s*-\\s*[\\d,]+(?:\\.\\d+)?)?)\\s+(${UNIT_PATTERN})\\s+((?:<|>|above)?\\s*[\\d.]+(?:\\s*-\\s*[\\d.]+)?)$`,
    "i"
  );

  // name : value unit (range)
  const pB = new RegExp(
    `^([A-Za-z][A-Za-z0-9\\s,./()%-]+?)\\s*[:\\-]\\s*([<>]?[\\d,]+(?:\\.\\d+)?(?:\\s*-\\s*[\\d,]+(?:\\.\\d+)?)?)\\s*(${UNIT_PATTERN})?\\s*\\(?\\s*((?:<|>|above)?\\s*[\\d.]+(?:\\s*-\\s*[\\d.]+)?)\\s*\\)?$`,
    "i"
  );

  // urine style often in OCR:
  // "Pus cells (WBCs) 6-8 /hpf 0-5"
  // "Epithelial cells 12-15 /hpf 0-5"
  const pUrine = new RegExp(
    `^([A-Za-z][A-Za-z0-9\\s,./()%-]+?)\\s+([<>]?[\\d,]+(?:\\.\\d+)?(?:\\s*-\\s*[\\d,]+(?:\\.\\d+)?)?)\\s+(\\/hpf|${UNIT_PATTERN})\\s+((?:<|>|above)?\\s*[\\d.]+(?:\\s*-\\s*[\\d.]+)?)$`,
    "i"
  );

  // no-unit ratio style:
  // "Albumin/Globulin Ratio 1.27 1.1-2.2"
  const pNoUnit = /^([A-Za-z][A-Za-z0-9\s,./()%-]+?)\s+([<>]?[\d,]+(?:\.\d+)?(?:\s*-\s*[\d,]+(?:\.\d+)?)?)\s+((?:<|>|above)?\s*[\d.]+(?:\s*-\s*[\d.]+)?)$/i;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    if (shouldIgnoreLine(line)) continue;

    // Merge split-line urine pattern:
    // "Red blood cells >100" + "C /hpf 0-2"
    if (/^[A-Za-z].*[<>]\s*[\d.]+\s*$/.test(line) && i + 1 < lines.length) {
      const next = lines[i + 1];
      if (/^(?:C\s+)?\/hpf\s+[\d.]+\s*-\s*[\d.]+$/i.test(next)) {
        line = `${line} ${next.replace(/^C\s+/i, "")}`;
        i += 1;
      }
    }

    let m = line.match(pUrine);
    if (m) {
      const obs = buildObservation({
        rawName: m[1],
        rawValue: m[2],
        rawUnit: m[3],
        rawRange: m[4],
      });
      if (obs) observations.push(obs);
      continue;
    }

    m = line.match(pA);
    if (m) {
      const obs = buildObservation({
        rawName: m[1],
        rawValue: m[2],
        rawUnit: m[3],
        rawRange: m[4],
      });
      if (obs) observations.push(obs);
      continue;
    }

    m = line.match(pB);
    if (m) {
      const obs = buildObservation({
        rawName: m[1],
        rawValue: m[2],
        rawUnit: m[3] || "1",
        rawRange: m[4],
      });
      if (obs) observations.push(obs);
      continue;
    }

    m = line.match(pNoUnit);
    if (m) {
      const obs = buildObservation({
        rawName: m[1],
        rawValue: m[2],
        rawUnit: "1",
        rawRange: m[3],
        forcedReview: true,
      });
      if (obs) observations.push(obs);
      continue;
    }
  }

  const seen = new Set<string>();
  return observations.filter((o) => {
    const key = `${o.name}|${o.value}|${o.unit}|${o.low}|${o.high}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
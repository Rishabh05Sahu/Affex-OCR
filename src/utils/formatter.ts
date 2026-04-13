import type { ParsedObservation } from "./parser";

type UiObservation = {
  name: string;
  value: string | number;
  unit: string;
  range: string;
  status: "High" | "Low" | "Normal" | "Review";
};

type UiSection = {
  name: string;
  observations: UiObservation[];
};

function cleanText(s: string): string {
  return s
    .replace(/<[^>]*>/g, " ")
    .replace(/[#*_`~|]/g, " ")
    .replace(/\b\/?(?:b|u|i|br|small)\b/gi, " ")
    .replace(/\\/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isSeparatorLike(s: string): boolean {
  const t = cleanText(s);
  return !t || /^[-–—_=.:|/\\\s]{3,}$/.test(t);
}

function isBadObservationName(name: string): boolean {
  const l = name.toLowerCase();
  return (
    !l ||
    isSeparatorLike(l) ||
    l === "investigation" ||
    l.includes("observed value") ||
    l.includes("biological reference interval") ||
    l.includes("barcode") ||
    l.includes("qr code") ||
    l.includes("img.jpg") ||
    l.includes("background illustration") ||
    l.startsWith("age:") ||
    l === "age" ||
    l.includes("sex:") ||
    l.includes("laboratory accredited as per iso") ||
    l.startsWith("male :") ||
    l.startsWith("female :") ||
    l.startsWith("gfr with creatinine (above")
  );
}

function mapFlag(flag: ParsedObservation["flag"]): UiObservation["status"] {
  if (flag === "H") return "High";
  if (flag === "L") return "Low";
  if (flag === "N") return "Normal";
  return "Review";
}

function normalizeSection(name: string): string {
  const l = name.toLowerCase();
  if (l.includes("lft") || l.includes("liver function")) return "LFT (Liver Function Test)";
  if (l.includes("rft") || l.includes("renal") || l.includes("kidney")) return "RFT (Kidney Function Test)";
  if (l.includes("electrolytes")) return "Electrolytes";
  if (l.includes("cbc") || l.includes("haemogram")) return "CBC (Complete Blood Count)";
  if (l.includes("urine")) return "Urine Examination";
  if (l.includes("clinical chemistry")) return "Clinical Chemistry";
  return "Other Tests";
}

function fallbackSectionByName(testName: string): string {
  const n = testName.toLowerCase();

  if (
    n.includes("bilirubin") ||
    n.includes("sgot") ||
    n.includes("sgpt") ||
    n.includes("alkaline") ||
    n.includes("gamma gt") ||
    n.includes("protein") ||
    n.includes("albumin") ||
    n.includes("globulin")
  ) return "LFT (Liver Function Test)";

  if (
    n.includes("creatinine") ||
    n.includes("bun") ||
    n.includes("urea") ||
    n.includes("uric") ||
    n.includes("egfr") ||
    n.includes("calcium") ||
    n.includes("phosphorus")
  ) return "RFT (Kidney Function Test)";

  if (n.includes("sodium") || n.includes("potassium") || n.includes("chloride")) return "Electrolytes";

  if (
    n.includes("hemoglobin") ||
    n.includes("platelet") ||
    n.includes("rbc") ||
    n.includes("wbc") ||
    n.includes("leucocyte") ||
    n.includes("neutrophil") ||
    n.includes("lymphocyte")
  ) return "CBC (Complete Blood Count)";

  if (
    n.includes("urine") ||
    n.includes("pus") ||
    n.includes("epithelial") ||
    n.includes("specific gravity") ||
    n.includes("bacteria") ||
    n.includes("ketones") ||
    n.includes("nitrite")
  ) return "Urine Examination";

  return "Other Tests";
}

function deriveRange(obs: ParsedObservation): string {
  const t = cleanText(obs.rangeText || "");
  if (t && t !== "-" && !isSeparatorLike(t)) return t;
  if (obs.low !== null && obs.high !== null) return `${obs.low}-${obs.high}`;
  if (obs.low !== null) return `>= ${obs.low}`;
  if (obs.high !== null) return `<= ${obs.high}`;
  return "-";
}

export function groupObservations(observations: ParsedObservation[]) {
  const sections: Record<string, UiSection> = {};

  for (const obs of observations) {
    const name = cleanText(obs.name);
    if (isBadObservationName(name)) continue;

    const value = typeof obs.value === "string" ? cleanText(obs.value) : obs.value;
    if (typeof value === "string" && isSeparatorLike(value)) continue;

    const unit = cleanText(obs.unit || "");
    const range = deriveRange(obs);

    const hinted = normalizeSection(cleanText(obs.sectionHint || ""));
    const byName = fallbackSectionByName(name);
    const finalSection = hinted === "Other Tests" ? byName : hinted;

    if (!sections[finalSection]) {
      sections[finalSection] = { name: finalSection, observations: [] };
    }

    sections[finalSection].observations.push({
      name,
      value,
      unit: isSeparatorLike(unit) ? "" : unit,
      range,
      status: mapFlag(obs.flag),
    });
  }

  return { sections: Object.values(sections) };
}
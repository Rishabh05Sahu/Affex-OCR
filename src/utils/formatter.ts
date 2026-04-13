export function groupObservations(observations: any[]) {
  const sections: Record<string, any> = {};

  function getSection(name: string) {
    const n = name.toLowerCase();

    if (
      n.includes("bilirubin") ||
      n.includes("sgot") ||
      n.includes("sgpt") ||
      n.includes("alkaline") ||
      n.includes("protein") ||
      n.includes("albumin")
    ) {
      return "LFT (Liver Function Test)";
    }

    if (
      n.includes("creatinine") ||
      n.includes("urea") ||
      n.includes("uric") ||
      n.includes("calcium") ||
      n.includes("phosphorus")
    ) {
      return "RFT (Kidney Function Test)";
    }

    if (
      n.includes("sodium") ||
      n.includes("potassium") ||
      n.includes("chloride")
    ) {
      return "Electrolytes";
    }

    if (
      n.includes("hemoglobin") ||
      n.includes("platelet") ||
      n.includes("rbc") ||
      n.includes("wbc")
    ) {
      return "CBC (Complete Blood Count)";
    }

    if (
      n.includes("urine") ||
      n.includes("pus") ||
      n.includes("epithelial") ||
      n.includes("ph")
    ) {
      return "Urine Examination";
    }

    return "Other Tests";
  }

  observations.forEach((obs) => {
    const sectionName = getSection(obs.name);

    if (!sections[sectionName]) {
      sections[sectionName] = {
        name: sectionName,
        observations: [],
      };
    }

    sections[sectionName].observations.push({
      name: obs.name,
      value: obs.value,
      unit: obs.unit,
      range: `${obs.low}-${obs.high}`,
      status:
        obs.flag === "H"
          ? "High"
          : obs.flag === "L"
          ? "Low"
          : "Normal",
    });
  });

  return {
    sections: Object.values(sections),
  };
}
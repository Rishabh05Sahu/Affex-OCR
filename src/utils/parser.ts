export function parseOCRText(text: string) {
  const lines = text.split("\n");
  const observations: any[] = [];

  for (let line of lines) {
    const clean = line.trim();

    if (!clean) continue;

    // 🔥 HANDLE TABLE ROWS
    if (clean.startsWith("|")) {
      const cols = clean
        .split("|")
        .map((c) => c.replace(/<[^>]+>/g, "").trim())
        .filter(Boolean);

      // Expect: [name, value, unit, range]
      if (cols.length >= 3) {
        const name = cols[0];
        const valueRaw = cols[1];
        const unit = cols[2] || "";
        const rangeRaw = cols[3] || "";

        // Skip headers
        if (
          name.toLowerCase().includes("investigation") ||
          name.toLowerCase().includes("observed")
        ) {
          continue;
        }

        // Skip empty rows
        if (!valueRaw) continue;

        // 🔥 Extract numeric value
        const value = parseFloat(valueRaw.replace(/[^\d.]/g, ""));

        let low = 0;
        let high = 0;

        if (rangeRaw.includes("-")) {
          const parts = rangeRaw.split("-");
          low = parseFloat(parts[0]);
          high = parseFloat(parts[1]);
        } else if (rangeRaw.includes("<")) {
          high = parseFloat(rangeRaw.replace(/[^\d.]/g, ""));
        }

        let flag = "N";
        if (value && high && value > high) flag = "H";
        if (value && low && value < low) flag = "L";

        if (!isNaN(value)) {
          observations.push({
            name,
            value,
            unit,
            low,
            high,
            flag,
          });
        }
      }

      continue;
    }
  }

  return observations;
}
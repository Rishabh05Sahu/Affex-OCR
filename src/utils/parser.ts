export function parseOCRText(text: string) {
  const lines = text.split("\n");

  const observations: any[] = [];

  const patterns = [
    // Format 1: Hemoglobin: 11.2 g/dL (12-16)
    /([A-Za-z\s]+)\s*[:\-]\s*(\d+\.?\d*)\s*([a-zA-Z\/%]+)\s*\(?(\d+\.?\d*)\s*[-–]\s*(\d+\.?\d*)\)?/,

    // Format 2: Hemoglobin 11.2 g/dL 12-16
    /([A-Za-z\s]+)\s+(\d+\.?\d*)\s+([a-zA-Z\/%]+)\s+(\d+\.?\d*)\s*[-–]\s*(\d+\.?\d*)/,
  ];

  for (const line of lines) {
    for (const regex of patterns) {
      const match = line.match(regex);

      if (match) {
        const name = match[1].trim();
        const value = parseFloat(match[2]);
        const unit = match[3];
        const low = parseFloat(match[4]);
        const high = parseFloat(match[5]);

        let flag = "N";
        if (value < low) flag = "L";
        else if (value > high) flag = "H";

        observations.push({
          name,
          value,
          unit,
          low,
          high,
          flag,
        });

        break;
      }
    }
  }

  return observations;
}
export function validateObservations(observations: any[]) {
  const needsReview = new Set<string>();

  const cleaned = observations.map((obs) => {
    const value = Number(obs.value);
    const low = Number(obs.low);
    const high = Number(obs.high);

    const invalidValue = Number.isNaN(value);
    const invalidRange = Number.isNaN(low) || Number.isNaN(high) || low > high;
    const missingUnit = !obs.unit;

    if (invalidValue || invalidRange || missingUnit || obs.needsReview) {
      needsReview.add(obs.name || "Unknown");
    }

    return {
      ...obs,
      value,
      low,
      high,
      unit: obs.unit || "1",
    };
  });

  return { cleaned, needsReview: [...needsReview] };
}
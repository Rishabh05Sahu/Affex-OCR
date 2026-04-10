export function validateObservations(observations: any[]) {
  const needsReview: string[] = [];

  const cleaned = observations.map((obs) => {
    const value = Number(obs.value);

    if (isNaN(value) || !obs.unit) {
      needsReview.push(obs.name);
    }

    return {
      ...obs,
      value,
    };
  });

  return { cleaned, needsReview };
}
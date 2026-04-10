import { LOINC_MAP } from "./loincMap";

type Observation = {
  name: string;
  value: number;
  unit: string;
  low: number;
  high: number;
  flag: string;
};

type FHIRBundle = {
  resourceType: "Bundle";
  type: "collection";
  entry: any[];
  meta: {
    source: string;
    needsReview: string[];
  };
};

function getLOINC(name: string) {
  const key = name.toLowerCase();

  for (const test in LOINC_MAP) {
    if (key.includes(test)) {
      return LOINC_MAP[test];
    }
  }

  return null;
}

export function mapToFHIR(observations: Observation[]): FHIRBundle {
  return {
    resourceType: "Bundle",
    type: "collection",
    entry: observations.map((obs) => {
      const loinc = getLOINC(obs.name);

      return {
        resource: {
          resourceType: "Observation",
          status: "preliminary",
          code: loinc
            ? {
                coding: [
                  {
                    system: "http://loinc.org",
                    code: loinc.code,
                    display: loinc.display,
                  },
                ],
                text: obs.name,
              }
            : {
                text: obs.name,
              },
          valueQuantity: {
            value: obs.value,
            unit: obs.unit,
          },
          interpretation: [
            {
              coding: [
                {
                  code: obs.flag,
                },
              ],
            },
          ],
          referenceRange: [
            {
              low: { value: obs.low, unit: obs.unit },
              high: { value: obs.high, unit: obs.unit },
            },
          ],
        },
      };
    }),
    meta: {
      source: "ocr-extraction",
      needsReview: [],
    },
  };
}
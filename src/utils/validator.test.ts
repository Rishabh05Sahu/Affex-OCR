import { validateObservations } from "./validator";

describe("validateObservations", () => {
  it("should flag invalid observations and keep valid ones", () => {
    const input = [
      {
        name: "Hemoglobin",
        value: "11.2",
        unit: "g/dL",
        low: 12,
        high: 16,
        flag: "L",
      },
      {
        name: "Glucose",
        value: "abc", // ❌ invalid
        unit: "mg/dL",
        low: 70,
        high: 100,
        flag: "N",
      },
      {
        name: "Creatinine",
        value: 1.2,
        unit: "", // ❌ missing unit
        low: 0.6,
        high: 1.3,
        flag: "N",
      },
    ];

    const result = validateObservations(input);

    // ✅ cleaned values
    expect(result.cleaned[0].value).toBe(11.2);

    // ❌ needs review should contain invalid ones
    expect(result.needsReview).toContain("Glucose");
    expect(result.needsReview).toContain("Creatinine");
  });
});
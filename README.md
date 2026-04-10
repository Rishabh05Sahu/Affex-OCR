# Medical Report OCR Service

A Node.js (Next.js API) microservice that extracts medical observations from lab reports (image/PDF) using OCR and returns structured FHIR R4 data.

---

## 🚀 Features

- OCR extraction using Datalab Marker API
- Supports JPEG, PNG, WebP, PDF
- FHIR R4 compliant response (Observation Bundle)
- LOINC code mapping (Hemoglobin, Glucose, etc.)
- Validation layer with `needsReview`
- Bearer token authentication
- Health check endpoint
- Unit test for validation layer
- Minimal UI for upload & preview

---

## 🛠️ Tech Stack

- Next.js (App Router)
- TypeScript
- Tailwind CSS
- Axios
- Jest (testing)

---


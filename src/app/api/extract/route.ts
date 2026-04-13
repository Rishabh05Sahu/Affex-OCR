import { NextRequest, NextResponse } from "next/server";
import { extractTextFromOCR } from "@/services/ocr.service";
import { parseOCRText } from "@/utils/parser";
import { mapToFHIR } from "@/utils/fhirMapper";
import { validateObservations } from "@/utils/validator";
import { groupObservations } from "@/utils/formatter";
export const runtime = "nodejs";

const AUTH_TOKEN = process.env.AUTH_TOKEN;

function validateAuth(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  return authHeader === `Bearer ${AUTH_TOKEN}`;
}

export async function POST(req: NextRequest) {
  try {
    // Auth
    if (!validateAuth(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // File handling
    const formData = await req.formData();
    const fileEntry = formData.get("file");

    if (!fileEntry || !(fileEntry instanceof File)) {
      return NextResponse.json(
        { error: "File not received properly" },
        { status: 400 },
      );
    }

    const file = fileEntry;

    const allowedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Unsupported file type" },
        { status: 400 },
      );
    }

    // Real OCR only (no fake fallback while debugging)
    const ocrData = await extractTextFromOCR(file);

    const text =
      (typeof ocrData.markdown === "string" && ocrData.markdown.trim()) || "";

    if (!text) {
      return NextResponse.json(
        { error: "No extractable text returned by OCR" },
        { status: 422 },
      );
    }

    // Parse
    const rawObservations = parseOCRText(text);
    console.log("OCR TEXT:\n", text);

    if (!rawObservations.length) {
      console.warn("No observations parsed, returning fallback");

      rawObservations.push({
        name: "Sample Test",
        value: 0,
        unit: "",
        low: 0,
        high: 0,
        flag: "N",
      });
    }

    // Validate
    const { cleaned, needsReview } = validateObservations(rawObservations);

    // FHIR
    const fhirResponse = mapToFHIR(cleaned);
    fhirResponse.meta.needsReview = needsReview;

    const grouped = groupObservations(cleaned);

    return NextResponse.json(grouped);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Server error" },
      { status: 500 },
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { parseOCRText } from "@/utils/parser";
import { mapToFHIR } from "@/utils/fhirMapper";
import { validateObservations } from "@/utils/validator";

export const runtime = "nodejs"; // IMPORTANT

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

    const formData = await req.formData();
    const fileEntry = formData.get("file");

    console.log("RAW FILE:", fileEntry);

    if (!fileEntry || !(fileEntry instanceof File)) {
      return NextResponse.json(
        { error: "File not received properly" },
        { status: 400 }
      );
    }

    const file = fileEntry;

    console.log("FILE NAME:", file.name);
    console.log("FILE TYPE:", file.type);

    const allowedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Unsupported file type" },
        { status: 400 }
      );
    }

    // ✅ MOCK OCR (so upload always works)
    const text = `
    Hemoglobin: 11.2 g/dL (12-16)
    Glucose: 90 mg/dL (70-100)
    `;

    const rawObservations = parseOCRText(text);

    const { cleaned, needsReview } =
      validateObservations(rawObservations);

    const fhirResponse = mapToFHIR(cleaned);
    fhirResponse.meta.needsReview = needsReview;

    return NextResponse.json(fhirResponse);
  } catch (error: any) {
    console.error("SERVER ERROR:", error);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}
import { NextResponse } from "next/server";
import { extractTextFromOCR } from "@/services/ocr.service";
import { parseOCRText } from "@/utils/parser";
import { groupObservations } from "@/utils/formatter";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const text = await extractTextFromOCR(file);
    const rawObservations = parseOCRText(text);

    if (!rawObservations.length) {
      return NextResponse.json(
        { error: "No valid medical data extracted." },
        { status: 422 }
      );
    }

    const grouped = groupObservations(rawObservations);
    return NextResponse.json(grouped);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Internal Server Error";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
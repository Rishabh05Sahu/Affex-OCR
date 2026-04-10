import axios from "axios";

const API_KEY = process.env.DATALAB_API_KEY;

type DatalabSubmitResponse = {
  success?: boolean;
  request_id?: string;
  request_check_url?: string;
};

type DatalabResultResponse = {
  status: "processing" | "complete" | "failed" | string;
  success?: boolean;
  markdown?: string | null;
  html?: string | null;
  json?: unknown;
  chunks?: unknown;
  error?: string | null;
};

export async function extractTextFromOCR(file: File): Promise<DatalabResultResponse> {
  if (!API_KEY) {
    throw new Error("Missing DATALAB_API_KEY");
  }

  // Datalab expects multipart upload for file conversion.
  const form = new FormData();
  form.append("file", file);
  form.append("output_format", "markdown");
  form.append("mode", "balanced");

  try {
    const submitRes = await axios.post<DatalabSubmitResponse>(
      "https://www.datalab.to/api/v1/convert",
      form,
      {
        headers: {
          "X-API-Key": API_KEY,
        },
      }
    );

    const checkUrl = submitRes.data?.request_check_url;
    if (!checkUrl) {
      throw new Error("No request_check_url returned by Datalab");
    }

    while (true) {
      const checkRes = await axios.get<DatalabResultResponse>(checkUrl, {
        headers: {
          "X-API-Key": API_KEY,
        },
      });

      const result = checkRes.data;

      if (result.status === "complete") {
        if (result.success === false) {
          throw new Error(result.error || "Datalab OCR reported failure");
        }
        return result;
      }

      if (result.status === "failed") {
        throw new Error(result.error || "Datalab OCR failed");
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  } catch (error: any) {
    const apiError =
      error?.response?.data?.error ||
      error?.response?.data?.detail ||
      error?.message ||
      "Unknown OCR error";

    throw new Error(`OCR Service Error: ${apiError}`);
  }
}
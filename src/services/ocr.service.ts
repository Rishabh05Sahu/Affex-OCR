import axios from "axios";

const API_KEY = process.env.DATALAB_API_KEY;

export async function extractTextFromOCR(file: File) {
  try {
    const formData = new FormData();

    const buffer = await file.arrayBuffer();
    const blob = new Blob([buffer], { type: file.type });

    formData.append("file", blob, file.name);

    // STEP 1: Submit OCR request
    const submitRes = await axios.post(
      "https://www.datalab.to/api/v1/marker",
      formData,
      {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
        },
      }
    );

    const checkUrl = submitRes.data.request_check_url;

    if (!checkUrl) {
      throw new Error("No polling URL received from OCR");
    }

    // STEP 2: Poll for result (max 20s)
    const maxAttempts = 10;
    let attempts = 0;

    while (attempts < maxAttempts) {
      const checkRes = await axios.get(checkUrl, {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
        },
      });

      const status = checkRes.data.status;

      if (status === "completed") {
        return checkRes.data;
      }

      if (status === "failed") {
        throw new Error("OCR processing failed");
      }

      await new Promise((res) => setTimeout(res, 2000));
      attempts++;
    }

    throw new Error("OCR timeout");
  } catch (error: any) {
    console.error("OCR ERROR:", error.message);
    throw new Error("OCR Service Error");
  }
}
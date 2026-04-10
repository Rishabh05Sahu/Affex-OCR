import axios from "axios";

const API_KEY = process.env.DATALAB_API_KEY;

export async function extractTextFromOCR(file: File) {
  try {
    const formData = new FormData();

    // ✅ FIX: Convert to buffer → blob (important for PDF)
    const buffer = await file.arrayBuffer();
    const blob = new Blob([buffer], { type: file.type });

    formData.append("file", blob, file.name);

    // Submit
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

    // Poll
    while (true) {
      const checkRes = await axios.get(checkUrl, {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
        },
      });

      if (checkRes.data.status === "completed") {
        return checkRes.data;
      }

      if (checkRes.data.status === "failed") {
        throw new Error("OCR failed");
      }

      await new Promise((res) => setTimeout(res, 2000));
    }
  } catch (error) {
    throw new Error("OCR Service Error");
  }
}
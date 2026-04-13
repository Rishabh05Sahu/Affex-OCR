const DATALAB_BASE_URL = process.env.DATALAB_BASE_URL || "https://www.datalab.to";
const DATALAB_API_KEY = process.env.DATALAB_API_KEY;

type DatalabSubmitResponse = {
  success?: boolean;
  request_id?: string;
  request_check_url?: string;
  error?: string;
};

type DatalabPollResponse = {
  status?: string; // processing | complete | failed
  success?: boolean;
  markdown?: string | null;
  html?: string | null;
  json?: unknown;
  chunks?: unknown;
  error?: string | null;
};

function toErrorMessage(payload: unknown, fallback: string): string {
  if (!payload) return fallback;
  if (typeof payload === "string") return payload;

  if (typeof payload === "object") {
    const p = payload as Record<string, unknown>;
    if (typeof p.error === "string" && p.error.trim()) return p.error;
    if (typeof p.message === "string" && p.message.trim()) return p.message;
  }

  try {
    return JSON.stringify(payload);
  } catch {
    return fallback;
  }
}

function extractTextFromResult(result: DatalabPollResponse): string {
  // Prefer markdown for downstream parsing
  if (typeof result.markdown === "string" && result.markdown.trim()) {
    return result.markdown;
  }

  // Fallback to HTML
  if (typeof result.html === "string" && result.html.trim()) {
    return result.html.replace(/<[^>]+>/g, " ");
  }

  // Fallback to json/chunks as string
  if (result.json != null) {
    return typeof result.json === "string" ? result.json : JSON.stringify(result.json);
  }

  if (result.chunks != null) {
    return typeof result.chunks === "string" ? result.chunks : JSON.stringify(result.chunks);
  }

  return "";
}

async function datalabFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const text = await res.text();

  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const msg = toErrorMessage(data, `Datalab request failed (${res.status})`);
    throw new Error(msg);
  }

  return data as T;
}

export async function extractTextFromOCR(file: File): Promise<string> {
  if (!DATALAB_API_KEY) {
    throw new Error("Missing DATALAB_API_KEY");
  }

  // 1) Submit conversion request
  const form = new FormData();
  form.append("file", file);
  form.append("output_format", "markdown");
  form.append("mode", "accurate");
  form.append("paginate", "true");

  const submitUrl = `${DATALAB_BASE_URL}/api/v1/convert`;
  const submit = await datalabFetch<DatalabSubmitResponse>(submitUrl, {
    method: "POST",
    headers: {
      "X-API-Key": DATALAB_API_KEY,
    },
    body: form,
  });

  const checkUrl = submit.request_check_url;
  if (!checkUrl) {
    throw new Error(
      toErrorMessage(submit, "Datalab did not return request_check_url")
    );
  }

  // 2) Poll for completion
  const maxAttempts = 180; // ~6 min at 2s interval
  const delayMs = 2000;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const poll = await datalabFetch<DatalabPollResponse>(checkUrl, {
      method: "GET",
      headers: {
        "X-API-Key": DATALAB_API_KEY,
      },
    });

    const status = (poll.status || "").toLowerCase();

    if (status === "complete") {
      if (poll.success === false) {
        throw new Error(toErrorMessage(poll.error, "Datalab conversion failed"));
      }

      const text = extractTextFromResult(poll).trim();
      if (!text) {
        throw new Error("Datalab returned empty OCR output");
      }

      return text;
    }

    if (status === "failed" || status === "error") {
      throw new Error(toErrorMessage(poll.error, "Datalab conversion failed"));
    }

    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  throw new Error("Datalab OCR timed out while waiting for completion");
}
export interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AskRequest {
  subject: string;
  question: string;
  history: HistoryMessage[];
}

export interface AskResponse {
  answer: string;
}

export interface AskError {
  error: string;
}

// ─── Notes types ─────────────────────────────────────────────────────────────

export interface UploadResponse {
  text: string;
  pages: number;
  charCount: number;
}

export interface ExplainResponse {
  explanation: string;
}

// ─── Chat API ─────────────────────────────────────────────────────────────────

const REQUEST_TIMEOUT_MS = 30_000;

export async function askQuestion(request: AskRequest): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorData = (await response.json().catch(() => null)) as AskError | null;
      throw new Error(
        errorData?.error || `Request failed with status ${response.status}`
      );
    }

    const data = (await response.json()) as AskResponse;
    return data.answer;
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(
        "Request timed out after 30 seconds. The server may be slow or unreachable. Please try again."
      );
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ─── Notes API ────────────────────────────────────────────────────────────────

export async function uploadPdf(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/notes/upload", {
    method: "POST",
    body: formData,
  });

  const data = await response.json() as (UploadResponse & AskError);
  if (!response.ok) throw new Error(data.error || `Upload failed (${response.status})`);
  return data;
}

export async function explainNotes(text: string, subject: string): Promise<string> {
  const response = await fetch("/api/notes/explain", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, subject }),
  });

  const data = await response.json() as (ExplainResponse & AskError);
  if (!response.ok) throw new Error(data.error || `Explain failed (${response.status})`);
  return data.explanation;
}

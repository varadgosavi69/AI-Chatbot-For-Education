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

export async function askQuestion(request: AskRequest): Promise<string> {
  const response = await fetch("/api/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorData = (await response.json().catch(() => null)) as AskError | null;
    throw new Error(
      errorData?.error || `Request failed with status ${response.status}`
    );
  }

  const data = (await response.json()) as AskResponse;
  return data.answer;
}

import { useState, useRef, useEffect, type FormEvent, type KeyboardEvent } from "react";
import ReactMarkdown from "react-markdown";
import { askQuestion, type HistoryMessage } from "./api";

const SUBJECTS = [
  "Math",
  "Physics",
  "Chemistry",
  "Computer Science",
  "Biology",
  "General",
] as const;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  isError?: boolean;
}

const STORAGE_PREFIX = "quickdoubt_chat_";
const LAST_SUBJECT_KEY = "quickdoubt_last_subject";

function getStorageKey(subjectName: string): string {
  return `${STORAGE_PREFIX}${subjectName.toLowerCase().replace(/\s+/g, "_")}`;
}

function loadMessages(subjectName: string): ChatMessage[] {
  try {
    const stored = localStorage.getItem(getStorageKey(subjectName));
    if (stored) {
      return JSON.parse(stored) as ChatMessage[];
    }
  } catch {
    // corrupted data — ignore
  }
  return [];
}

function saveMessages(subjectName: string, msgs: ChatMessage[]): void {
  // Only save non-error messages
  const toSave = msgs.filter((m) => !m.isError);
  localStorage.setItem(getStorageKey(subjectName), JSON.stringify(toSave));
}

function App() {
  const [subject, setSubject] = useState<string>(() => {
    const saved = localStorage.getItem(LAST_SUBJECT_KEY);
    return saved && (SUBJECTS as readonly string[]).includes(saved)
      ? saved
      : SUBJECTS[0];
  });
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadMessages(subject));
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [lastFailedQuestion, setLastFailedQuestion] = useState<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Save messages to localStorage whenever they change
  useEffect(() => {
    saveMessages(subject, messages);
  }, [messages, subject]);

  // Load messages when subject changes + remember last subject
  const handleSubjectChange = (newSubject: string) => {
    // Save current messages before switching
    saveMessages(subject, messages);
    setSubject(newSubject);
    setMessages(loadMessages(newSubject));
    setLastFailedQuestion(null);
    localStorage.setItem(LAST_SUBJECT_KEY, newSubject);
  };

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const sendMessage = async (questionText?: string) => {
    const question = questionText || input.trim();
    if (!question || isLoading) return;

    setInput("");
    setLastFailedQuestion(null);

    // Add user message
    const userMessage: ChatMessage = { role: "user", content: question };
    setMessages((prev) => [...prev.filter((m) => !m.isError), userMessage]);

    setIsLoading(true);

    try {
      // Build history from non-error messages (excluding the current user message)
      const history: HistoryMessage[] = messages
        .filter((m) => !m.isError)
        .map((m) => ({ role: m.role, content: m.content }));

      const answer = await askQuestion({
        subject,
        question,
        history,
      });

      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: answer,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error: unknown) {
      const errorMsg =
        error instanceof Error ? error.message : "Something went wrong";
      const errorMessage: ChatMessage = {
        role: "assistant",
        content: `⚠️ Error: ${errorMsg}`,
        isError: true,
      };
      setMessages((prev) => [...prev, errorMessage]);
      setLastFailedQuestion(question);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    sendMessage();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleRetry = () => {
    if (lastFailedQuestion) {
      sendMessage(lastFailedQuestion);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-900">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-slate-800 border-b border-slate-700 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-2xl">⚡</span>
          <h1 className="text-xl font-bold text-white">QuickDoubt</h1>
        </div>

        {/* Subject Selector */}
        <div className="flex items-center gap-2">
          <label htmlFor="subject-select" className="text-sm text-slate-400">
            Subject:
          </label>
          <select
            id="subject-select"
            value={subject}
            onChange={(e) => handleSubjectChange(e.target.value)}
            className="bg-slate-700 text-white text-sm rounded-lg px-3 py-1.5 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            {SUBJECTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </header>

      {/* Chat Messages Area */}
      <main className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-3">
            <span className="text-5xl">🎓</span>
            <p className="text-lg font-medium">Welcome to QuickDoubt!</p>
            <p className="text-sm text-center max-w-md">
              Select a subject above and ask any question. I'll explain it
              step-by-step like a patient tutor.
            </p>
          </div>
        )}

        {messages.map((msg, index) => (
          <div
            key={index}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] md:max-w-[70%] rounded-2xl px-4 py-3 ${
                msg.role === "user"
                  ? "bg-indigo-600 text-white rounded-br-sm"
                  : msg.isError
                    ? "bg-red-900/50 text-red-200 border border-red-700 rounded-bl-sm"
                    : "bg-slate-700 text-slate-100 rounded-bl-sm"
              }`}
            >
              {msg.role === "assistant" && !msg.isError ? (
                <div className="markdown-content">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              )}

              {/* Retry button for error messages */}
              {msg.isError && lastFailedQuestion && (
                <button
                  onClick={handleRetry}
                  className="mt-2 text-sm text-red-300 hover:text-white underline cursor-pointer"
                >
                  🔄 Retry
                </button>
              )}
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-slate-700 rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex items-center gap-1.5">
                <span className="typing-dot w-2 h-2 bg-slate-400 rounded-full inline-block" />
                <span className="typing-dot w-2 h-2 bg-slate-400 rounded-full inline-block" />
                <span className="typing-dot w-2 h-2 bg-slate-400 rounded-full inline-block" />
              </div>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </main>

      {/* Input Area */}
      <footer className="shrink-0 border-t border-slate-700 bg-slate-800 px-4 py-3">
        <form onSubmit={handleSubmit} className="flex gap-2 items-end max-w-4xl mx-auto">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Ask a ${subject} question...`}
            disabled={isLoading}
            rows={1}
            className="flex-1 bg-slate-700 text-white placeholder-slate-400 rounded-xl px-4 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 border border-slate-600 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-xl px-5 py-2.5 font-medium transition-colors cursor-pointer"
          >
            {isLoading ? "..." : "Send"}
          </button>
        </form>
      </footer>
    </div>
  );
}

export default App;

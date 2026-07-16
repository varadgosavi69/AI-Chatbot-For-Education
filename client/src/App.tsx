import {
  useState,
  useRef,
  useEffect,
  type FormEvent,
  type KeyboardEvent,
  type ChangeEvent,
} from "react";
import ReactMarkdown from "react-markdown";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, type PieLabelRenderProps } from "recharts";
import {
  askQuestion,
  uploadPdf,
  explainNotes,
  visualizeNotes,
  type HistoryMessage,
  type VisualizeResponse,
  type MindmapNode,
} from "./api";

// ─── Constants ───────────────────────────────────────────────────────────────

const SUBJECTS = [
  "Math",
  "Physics",
  "Chemistry",
  "Computer Science",
  "Biology",
  "General",
] as const;

type Subject = (typeof SUBJECTS)[number];

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  isError?: boolean;
}

interface SubjectTheme {
  accent: string;
  accentHover: string;
  accentRing: string;
  userBubble: string;
  userShadow: string;
  accentBorder: string;
  emoji: string;
  hex: string;
}

const SUBJECT_THEMES: Record<string, SubjectTheme> = {
  Math: {
    accent: "bg-blue-600",
    accentHover: "hover:bg-blue-500",
    accentRing: "focus:ring-blue-500",
    userBubble: "bg-blue-600",
    userShadow: "shadow-blue-900/30",
    accentBorder: "#3b82f6",
    emoji: "📐",
    hex: "#3b82f6",
  },
  Physics: {
    accent: "bg-violet-600",
    accentHover: "hover:bg-violet-500",
    accentRing: "focus:ring-violet-500",
    userBubble: "bg-violet-600",
    userShadow: "shadow-violet-900/30",
    accentBorder: "#8b5cf6",
    emoji: "⚛",
    hex: "#8b5cf6",
  },
  Chemistry: {
    accent: "bg-emerald-600",
    accentHover: "hover:bg-emerald-500",
    accentRing: "focus:ring-emerald-500",
    userBubble: "bg-emerald-600",
    userShadow: "shadow-emerald-900/30",
    accentBorder: "#10b981",
    emoji: "🧪",
    hex: "#10b981",
  },
  "Computer Science": {
    accent: "bg-amber-600",
    accentHover: "hover:bg-amber-500",
    accentRing: "focus:ring-amber-500",
    userBubble: "bg-amber-600",
    userShadow: "shadow-amber-900/30",
    accentBorder: "#f59e0b",
    emoji: "💻",
    hex: "#f59e0b",
  },
  Biology: {
    accent: "bg-teal-600",
    accentHover: "hover:bg-teal-500",
    accentRing: "focus:ring-teal-500",
    userBubble: "bg-teal-600",
    userShadow: "shadow-teal-900/30",
    accentBorder: "#14b8a6",
    emoji: "🧬",
    hex: "#14b8a6",
  },
  General: {
    accent: "bg-indigo-600",
    accentHover: "hover:bg-indigo-500",
    accentRing: "focus:ring-indigo-500",
    userBubble: "bg-indigo-600",
    userShadow: "shadow-indigo-900/30",
    accentBorder: "#6366f1",
    emoji: "💡",
    hex: "#6366f1",
  },
};

const PIE_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981",
  "#3b82f6", "#14b8a6", "#f97316", "#84cc16", "#e11d48",
];

const STORAGE_PREFIX = "quickdoubt_chat_";
const LAST_SUBJECT_KEY = "quickdoubt_last_subject";

function getStorageKey(subjectName: string): string {
  return `${STORAGE_PREFIX}${subjectName.toLowerCase().replace(/\s+/g, "_")}`;
}

function loadMessages(subjectName: string): ChatMessage[] {
  try {
    const stored = localStorage.getItem(getStorageKey(subjectName));
    if (stored) return JSON.parse(stored) as ChatMessage[];
  } catch { /* corrupted — ignore */ }
  return [];
}

function saveMessages(subjectName: string, msgs: ChatMessage[]): void {
  const toSave = msgs.filter((m) => !m.isError);
  localStorage.setItem(getStorageKey(subjectName), JSON.stringify(toSave));
}

// ─── Visualisation sub-components ────────────────────────────────────────────

function MindmapNodeView({ node, depth = 0 }: { node: MindmapNode; depth?: number }) {
  return (
    <div>
      <div className="flex items-start gap-2 py-1" style={{ paddingLeft: `${depth * 20}px` }}>
        <span
          className="mt-1.5 w-2 h-2 rounded-full shrink-0"
          style={{
            backgroundColor: depth === 0 ? "#6366f1" : depth === 1 ? "#8b5cf6" : "#a78bfa",
            minWidth: 8,
          }}
        />
        <span className={`text-slate-200 ${depth === 0 ? "font-semibold text-base" : depth === 1 ? "font-medium text-sm" : "text-sm text-slate-300"}`}>
          {node.label}
        </span>
      </div>
      {node.children?.map((child, i) => (
        <MindmapNodeView key={i} node={child} depth={depth + 1} />
      ))}
    </div>
  );
}

function Mindmap({ data }: { data: VisualizeResponse["mindmap"] }) {
  return (
    <div className="bg-slate-800/60 rounded-xl p-5 border border-slate-700/50">
      <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">🧠 Mind Map</h4>
      <div className="font-semibold text-lg text-indigo-300 mb-3">{data.root}</div>
      <div className="space-y-0.5">
        {data.children?.map((child, i) => (
          <MindmapNodeView key={i} node={child} depth={1} />
        ))}
      </div>
    </div>
  );
}

function Flowchart({ data }: { data: VisualizeResponse["flowchart"] }) {
  const steps = data.steps || [];
  return (
    <div className="bg-slate-800/60 rounded-xl p-5 border border-slate-700/50">
      <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">🔄 Flowchart</h4>
      <div className="flex flex-col items-center gap-0">
        {steps.map((step, i) => (
          <div key={step.id} className="flex flex-col items-center w-full max-w-sm">
            <div className="w-full rounded-xl px-4 py-3 text-center text-sm font-medium text-white border border-indigo-500/40 bg-indigo-600/20 shadow">
              <span className="text-indigo-300 font-bold text-xs mr-2">{i + 1}.</span>
              {step.label}
            </div>
            {i < steps.length - 1 && (
              <div className="flex flex-col items-center py-1">
                <div className="w-0.5 h-5 bg-slate-600" />
                <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-slate-500" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function DataTable({ data }: { data: VisualizeResponse["table"] }) {
  return (
    <div className="bg-slate-800/60 rounded-xl p-5 border border-slate-700/50 overflow-x-auto">
      <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">📋 Summary Table</h4>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr>
            {data.headers?.map((h, i) => (
              <th key={i} className="text-left text-slate-300 font-semibold px-3 py-2 border-b border-slate-600 bg-slate-700/50">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows?.map((row, ri) => (
            <tr key={ri} className={ri % 2 === 0 ? "bg-slate-800/30" : ""}>
              {row.map((cell, ci) => (
                <td key={ci} className="px-3 py-2 text-slate-300 border-b border-slate-700/40">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PieChartViz({ data }: { data: VisualizeResponse["pieChart"] }) {
  return (
    <div className="bg-slate-800/60 rounded-xl p-5 border border-slate-700/50">
      <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">🥧 {data.title || "Distribution"}</h4>
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={data.segments}
            dataKey="value"
            nameKey="label"
            cx="50%"
            cy="50%"
            outerRadius={100}
            label={({ name, percent }: PieLabelRenderProps) => {
              const labelText = name || "";
              const percentValue = percent ?? 0;
              return `${labelText} (${(percentValue * 100).toFixed(0)}%)`;
            }}
            labelLine={true}
          >
            {data.segments?.map((_, index) => (
              <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: 8 }}
            labelStyle={{ color: "#e2e8f0" }}
          />
          <Legend wrapperStyle={{ color: "#94a3b8", fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Notes panel ─────────────────────────────────────────────────────────────

type NotesStep = "idle" | "uploading" | "explaining" | "explained" | "visualizing" | "done" | "error";

interface NotesState {
  step: NotesStep;
  fileName: string;
  extractedText: string;
  pages: number;
  explanation: string;
  visualData: VisualizeResponse | null;
  error: string;
  vizError: string;
}

function NotesPanel({ subject }: { subject: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<NotesState>({
    step: "idle",
    fileName: "",
    extractedText: "",
    pages: 0,
    explanation: "",
    visualData: null,
    error: "",
    vizError: "",
  });
  const [vizTab, setVizTab] = useState<"mindmap" | "flowchart" | "table" | "pie">("mindmap");

  const resetAll = () => {
    setState({ step: "idle", fileName: "", extractedText: "", pages: 0, explanation: "", visualData: null, error: "", vizError: "" });
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Client-side validation: reject non-PDF files immediately
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      setState((s) => ({
        ...s,
        step: "error",
        error: `"${file.name}" is not a PDF. Only .pdf files are accepted — please choose a PDF file.`,
      }));
      if (fileRef.current) fileRef.current.value = "";
      return;
    }

    let extracted: { text: string; pages: number };
    try {
      const res = await uploadPdf(file);
      extracted = { text: res.text, pages: res.pages };
    } catch (err) {
      setState((s) => ({ ...s, step: "error", error: err instanceof Error ? err.message : "Upload failed." }));
      return;
    }

    setState((s) => ({ ...s, step: "explaining", extractedText: extracted.text, pages: extracted.pages }));

    let explanation = "";
    try {
      explanation = await explainNotes(extracted.text, subject);
    } catch (err) {
      setState((s) => ({ ...s, step: "error", error: err instanceof Error ? err.message : "Explanation failed." }));
      return;
    }

    setState((s) => ({ ...s, step: "visualizing", explanation }));

    try {
      const visualData = await visualizeNotes(extracted.text);
      setState((s) => ({ ...s, step: "done", visualData }));
    } catch (err) {
      setState((s) => ({ ...s, step: "done", vizError: err instanceof Error ? err.message : "Visualization failed." }));
    }
  };

  const isLoading = state.step === "uploading" || state.step === "explaining" || state.step === "visualizing";
  const stepLabel =
    state.step === "uploading" ? "Extracting text from PDF…" :
    state.step === "explaining" ? "Generating simplified explanation…" :
    state.step === "visualizing" ? "Building visual diagrams…" : "";

  return (
    <div className="flex flex-col h-full overflow-y-auto px-4 py-6">
      <div className="max-w-3xl mx-auto w-full space-y-5">
        {/* Upload card */}
        <div className="bg-slate-800/70 rounded-2xl border border-slate-700/60 p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-white">📄 Notes Explainer</h2>
              <p className="text-sm text-slate-400 mt-0.5">Upload a PDF — get a simplified explanation + visual diagrams</p>
            </div>
            {state.step !== "idle" && (
              <button onClick={resetAll} className="text-xs text-slate-400 hover:text-red-400 transition-colors px-3 py-1.5 rounded-lg border border-slate-600 hover:border-red-700 cursor-pointer">
                ↺ Reset
              </button>
            )}
          </div>

          {state.step === "idle" || state.step === "error" ? (
            <label
              id="pdf-upload-label"
              htmlFor="pdf-upload-input"
              className={`flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-xl py-10 cursor-pointer transition-colors ${
                state.step === "error" ? "border-red-700/60 bg-red-950/20" : "border-slate-600 hover:border-indigo-500/60 hover:bg-slate-700/20"
              }`}
            >
              <span className="text-4xl">{state.step === "error" ? "⚠️" : "📂"}</span>
              {state.step === "error" ? (
                <div className="text-center">
                  <p className="text-red-300 font-medium">{state.error}</p>
                  <p className="text-slate-400 text-sm mt-1">Click to try a different file</p>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-slate-300 font-medium">Click to upload PDF notes</p>
                  <p className="text-slate-500 text-sm mt-1">PDF files only · max 20 MB</p>
                </div>
              )}
              <input id="pdf-upload-input" ref={fileRef} type="file" accept=".pdf,application/pdf" className="hidden" onChange={handleFileChange} />
            </label>
          ) : (
            <div className="flex items-center gap-3 bg-slate-700/40 rounded-xl px-4 py-3">
              <span className="text-2xl">📄</span>
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium truncate">{state.fileName}</p>
                {state.pages > 0 && (
                  <p className="text-slate-400 text-sm">{state.pages} page{state.pages !== 1 ? "s" : ""} · {(state.extractedText.length / 1000).toFixed(1)}k chars extracted</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex items-center gap-3 bg-slate-800/50 rounded-xl px-5 py-4 border border-slate-700/40 shadow">
            <div className="flex gap-1.5">
              <span className="typing-dot w-2.5 h-2.5 bg-indigo-400 rounded-full inline-block" />
              <span className="typing-dot w-2.5 h-2.5 bg-indigo-400 rounded-full inline-block" />
              <span className="typing-dot w-2.5 h-2.5 bg-indigo-400 rounded-full inline-block" />
            </div>
            <span className="text-slate-300 text-sm">{stepLabel}</span>
          </div>
        )}

        {/* Explanation */}
        {(state.step === "visualizing" || state.step === "done") && state.explanation && (
          <div className="bg-slate-800/60 rounded-2xl border border-slate-700/50 p-6 shadow">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">✨ Simplified Explanation</h3>
            <div className="markdown-content text-slate-200">
              <ReactMarkdown>{state.explanation}</ReactMarkdown>
            </div>
          </div>
        )}

        {/* Visualizations */}
        {state.step === "done" && state.visualData && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">📊 Visual Diagrams</h3>
              <div className="flex gap-1 bg-slate-800/70 rounded-lg p-1 border border-slate-700/50">
                {(["mindmap", "flowchart", "table", "pie"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setVizTab(tab)}
                    className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
                      vizTab === tab ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {tab === "mindmap" ? "🧠 Mind Map" : tab === "flowchart" ? "🔄 Flow" : tab === "table" ? "📋 Table" : "🥧 Pie"}
                  </button>
                ))}
              </div>
            </div>
            {vizTab === "mindmap" && <Mindmap data={state.visualData.mindmap} />}
            {vizTab === "flowchart" && <Flowchart data={state.visualData.flowchart} />}
            {vizTab === "table" && <DataTable data={state.visualData.table} />}
            {vizTab === "pie" && <PieChartViz data={state.visualData.pieChart} />}
          </div>
        )}

        {/* Viz error fallback */}
        {state.step === "done" && state.vizError && (
          <div className="bg-red-950/40 border border-red-800/50 rounded-xl px-5 py-4 text-red-300 text-sm">
            ⚠️ Visual diagrams could not be generated: {state.vizError}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

type AppTab = "chat" | "notes";

function App() {
  const [activeTab, setActiveTab] = useState<AppTab>("chat");
  const [subject, setSubject] = useState<string>(() => {
    const saved = localStorage.getItem(LAST_SUBJECT_KEY);
    return saved && (SUBJECTS as readonly string[]).includes(saved) ? saved : SUBJECTS[0];
  });
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadMessages(subject));
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [lastFailedQuestion, setLastFailedQuestion] = useState<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isUserScrolledUp = useRef(false);

  const theme = SUBJECT_THEMES[subject] || SUBJECT_THEMES["General"];

  useEffect(() => { saveMessages(subject, messages); }, [messages, subject]);

  const handleSubjectChange = (newSubject: string) => {
    saveMessages(subject, messages);
    setSubject(newSubject as Subject);
    setMessages(loadMessages(newSubject));
    setLastFailedQuestion(null);
    localStorage.setItem(LAST_SUBJECT_KEY, newSubject);
  };

  useEffect(() => {
    if (!isUserScrolledUp.current) chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleScroll = () => {
    const container = chatContainerRef.current;
    if (!container) return;
    isUserScrolledUp.current = (container.scrollHeight - container.scrollTop - container.clientHeight) > 100;
  };

  useEffect(() => { inputRef.current?.focus(); }, []);

  const sendMessage = async (questionText?: string) => {
    const question = questionText || input.trim();
    if (!question || isLoading) return;

    setInput("");
    setLastFailedQuestion(null);
    setMessages((prev) => [...prev.filter((m) => !m.isError), { role: "user", content: question }]);
    setIsLoading(true);

    try {
      const history: HistoryMessage[] = messages.filter((m) => !m.isError).map((m) => ({ role: m.role, content: m.content }));
      const answer = await askQuestion({ subject, question, history });
      setMessages((prev) => [...prev, { role: "assistant", content: answer }]);
    } catch (error: unknown) {
      let errorMsg: string;
      if (error instanceof TypeError && error.message === "Failed to fetch") {
        errorMsg = "Could not reach the server. Make sure the backend is running on port 3001.";
      } else if (error instanceof Error) {
        errorMsg = error.message;
      } else {
        errorMsg = "Something went wrong. Please try again.";
      }
      setMessages((prev) => [...prev, { role: "assistant", content: `⚠️ ${errorMsg}`, isError: true }]);
      setLastFailedQuestion(question);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleSubmit = (e: FormEvent) => { e.preventDefault(); sendMessage(); };
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };
  const handleRetry = () => { if (lastFailedQuestion) sendMessage(lastFailedQuestion); };
  const handleClearChat = () => {
    if (messages.length === 0) return;
    if (window.confirm(`Clear all ${subject} chat history? This cannot be undone.`)) {
      setMessages([]);
      setLastFailedQuestion(null);
      localStorage.removeItem(getStorageKey(subject));
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-900 overflow-hidden">
      <header className="flex flex-wrap items-center justify-between px-3 sm:px-6 py-3 sm:py-3.5 bg-slate-800/95 backdrop-blur-sm border-b border-slate-700/60 shrink-0 z-10 gap-2">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl leading-none">⚡</span>
          <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">QuickDoubt</h1>
        </div>
        <div className="flex gap-1 bg-slate-700/50 rounded-lg p-1 border border-slate-600/40">
          <button id="tab-chat" onClick={() => setActiveTab("chat")}
            className={`text-sm px-3.5 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${activeTab === "chat" ? "bg-slate-600 text-white shadow" : "text-slate-400 hover:text-slate-200"}`}>
            💬 Chat
          </button>
          <button id="tab-notes" onClick={() => setActiveTab("notes")}
            className={`text-sm px-3.5 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${activeTab === "notes" ? "bg-slate-600 text-white shadow" : "text-slate-400 hover:text-slate-200"}`}>
            📄 Notes
          </button>
        </div>
        {activeTab === "chat" && (
          <div className="flex items-center gap-2 sm:gap-3">
            <label htmlFor="subject-select" className="hidden sm:inline text-sm text-slate-400">Subject:</label>
            <select id="subject-select" value={subject} onChange={(e) => handleSubjectChange(e.target.value)}
              className={`bg-slate-700 text-white text-sm rounded-lg px-2.5 sm:px-3 py-1.5 border border-slate-600 focus:outline-none focus:ring-2 ${theme.accentRing} cursor-pointer`}>
              {SUBJECTS.map((s) => (<option key={s} value={s}>{s}</option>))}
            </select>
            <button onClick={handleClearChat} disabled={messages.length === 0}
              className="text-sm text-slate-400 hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              title="Clear chat history for this subject">
              🗑️ <span className="hidden sm:inline">Clear</span>
            </button>
          </div>
        )}
      </header>

      {activeTab === "chat" && (
        <>
          <main ref={chatContainerRef} onScroll={handleScroll} className="flex-1 min-h-0 overflow-y-auto px-4 py-5">
            <div key={subject} className="max-w-3xl mx-auto space-y-4 chat-fade-in">
              {messages.length === 0 && !isLoading && (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-4 py-16">
                  <div className="text-6xl mb-2">{theme.emoji}</div>
                  <h2 className="text-xl font-semibold text-slate-300">
                    {subject === "General" ? "Ask me anything!" : `Ready for ${subject}`}
                  </h2>
                  <p className="text-sm text-center max-w-sm leading-relaxed text-slate-500">
                    {subject === "General"
                      ? "I can help with any topic — just type your question below and I'll explain it step-by-step."
                      : `Ask me anything about ${subject} — I'll explain it step-by-step like a patient tutor.`}
                  </p>
                  <div className="flex items-center gap-2 mt-2 text-xs text-slate-600">
                    <span>Tip: Press</span>
                    <kbd className="bg-slate-700 px-2 py-0.5 rounded text-slate-400 font-mono text-xs">Enter</kbd>
                    <span>to send</span>
                  </div>
                </div>
              )}
              {messages.map((msg, index) => (
                <div key={index} className={`flex message-bubble ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[90%] sm:max-w-[85%] md:max-w-[72%] rounded-2xl px-3.5 sm:px-4 py-2.5 sm:py-3 shadow-md ${
                      msg.role === "user"
                        ? `${theme.userBubble} text-white rounded-br-none ${theme.userShadow}`
                        : msg.isError
                          ? "bg-red-950/60 text-red-200 border border-red-800/50 rounded-bl-none shadow-red-900/20"
                          : "text-slate-100 rounded-bl-none border border-slate-600/30 shadow-slate-900/40"
                    }`}
                    style={msg.role === "assistant" && !msg.isError ? { backgroundColor: "#293548", borderLeft: `3px solid ${theme.accentBorder}` } : undefined}
                  >
                    {msg.role === "assistant" && !msg.isError ? (
                      <div className="markdown-content"><ReactMarkdown>{msg.content}</ReactMarkdown></div>
                    ) : (
                      <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    )}
                    {msg.isError && lastFailedQuestion && (
                      <button onClick={handleRetry}
                        className="mt-2 inline-flex items-center gap-1.5 text-sm text-red-300 hover:text-white bg-red-900/40 hover:bg-red-800/50 px-3 py-1 rounded-lg transition-colors cursor-pointer">
                        🔄 Retry
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start message-bubble">
                  <div className="rounded-2xl rounded-bl-none px-5 py-4 shadow-md border border-slate-600/30" style={{ backgroundColor: "#293548" }}>
                    <div className="flex items-center gap-2">
                      <span className="typing-dot w-2.5 h-2.5 bg-slate-400 rounded-full inline-block" />
                      <span className="typing-dot w-2.5 h-2.5 bg-slate-400 rounded-full inline-block" />
                      <span className="typing-dot w-2.5 h-2.5 bg-slate-400 rounded-full inline-block" />
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          </main>
          <footer className="shrink-0 border-t border-slate-700/60 bg-slate-800/95 backdrop-blur-sm px-3 sm:px-6 py-3 sm:py-3.5">
            <form onSubmit={handleSubmit} className="flex gap-2 sm:gap-3 items-end max-w-3xl mx-auto">
              <textarea ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}
                placeholder={`Ask a ${subject} question...`} disabled={isLoading} rows={1}
                className={`flex-1 bg-slate-700 text-white placeholder-slate-400 rounded-xl px-3 sm:px-4 py-2.5 resize-none focus:outline-none focus:ring-2 ${theme.accentRing} border border-slate-600 disabled:opacity-50 text-sm sm:text-base`} />
              <button type="submit" disabled={isLoading || !input.trim()}
                className={`${theme.accent} ${theme.accentHover} disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-xl px-4 sm:px-5 py-2.5 font-medium transition-colors cursor-pointer text-sm sm:text-base`}>
                {isLoading ? "..." : "Send"}
              </button>
            </form>
          </footer>
        </>
      )}

      {activeTab === "notes" && (
        <div className="flex-1 min-h-0 overflow-hidden">
          <NotesPanel subject={subject} />
        </div>
      )}
    </div>
  );
}

export default App;

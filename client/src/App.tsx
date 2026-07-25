import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import ReactMarkdown from "react-markdown";
import {
  BarChart3,
  BookOpen,
  Bot,
  Brain,
  Check,
  Clipboard,
  Copy,
  Download,
  FileText,
  GraduationCap,
  Loader2,
  Menu,
  MessageSquare,
  Mic,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RefreshCcw,
  Send,
  Sparkles,
  Sun,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Upload,
  Volume2,
  X,
} from "lucide-react";
import {
  askPdfQuestion,
  askQuestion,
  explainNotes,
  uploadPdf,
  visualizeNotes,
  type HistoryMessage,
  type MindmapNode,
  type UploadResponse,
  type VisualizeResponse,
} from "./api";

const SUBJECTS = [
  "Mathematics",
  "Physics",
  "Chemistry",
  "Biology",
  "English",
  "History",
  "Geography",
  "Computer Science",
  "Artificial Intelligence",
  "Machine Learning",
  "Data Structures",
  "DBMS",
  "Operating Systems",
  "Computer Networks",
  "Cyber Security",
  "Aptitude",
  "General Knowledge",
] as const;

const SUGGESTED_PROMPTS = [
  "Explain Newton's laws with a real-life example",
  "Create a 20-minute revision plan for DBMS joins",
  "Help me understand chemical bonding simply",
  "Quiz me on data structures for interviews",
];

type AppView = "chat" | "notes" | "dashboard";
type ThemeMode = "dark" | "light";
type Reaction = "like" | "dislike" | null;

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  subject?: string;
  isError?: boolean;
  reaction?: Reaction;
}

interface ActivityItem {
  id: string;
  label: string;
  detail: string;
  createdAt: string;
}

interface Stats {
  questionsAsked: number;
  subjectsStudied: Set<string>;
  pdfQuestions: number;
  likedResponses: number;
  activity: ActivityItem[];
}

interface PdfChatState {
  document: UploadResponse | null;
  fileUrl: string;
  explanation: string;
  visualData: VisualizeResponse | null;
  messages: ChatMessage[];
  input: string;
  isUploading: boolean;
  isExplaining: boolean;
  isVisualizing: boolean;
  isAsking: boolean;
  error: string;
  previewReady: boolean;
}

function createId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function mapHistory(messages: ChatMessage[]): HistoryMessage[] {
  return messages
    .filter((message) => !message.isError)
    .map((message) => ({ role: message.role, content: message.content }));
}

function App() {
  const [view, setView] = useState<AppView>("chat");
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [subject, setSubject] = useState<string>("Mathematics");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [lastQuestion, setLastQuestion] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [stats, setStats] = useState<Stats>({
    questionsAsked: 0,
    subjectsStudied: new Set(),
    pdfQuestions: 0,
    likedResponses: 0,
    activity: [],
  });

  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isLoading]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const addActivity = (label: string, detail: string) => {
    setStats((current) => ({
      ...current,
      activity: [{ id: createId(), label, detail, createdAt: new Date().toISOString() }, ...current.activity].slice(0, 8),
    }));
  };

  const resetConversation = () => {
    setMessages([]);
    setInput("");
    setLastQuestion(null);
    setIsLoading(false);
    setIsStreaming(false);
    setView("chat");
    setMobileSidebarOpen(false);
    inputRef.current?.focus();
  };

  const newChat = () => {
    resetConversation();
  };

  const clearChat = () => {
    setMessages([]);
    setLastQuestion(null);
  };

  const sendMessage = async (prompt?: string) => {
    const question = (prompt ?? input).trim();
    if (!question || isLoading) return;

    const userMessage: ChatMessage = { id: createId(), role: "user", content: question, subject };
    const cleanHistory = messages.filter((message) => !message.isError);

    setMessages([...cleanHistory, userMessage]);
    setInput("");
    setIsLoading(true);
    setIsStreaming(true);
    setLastQuestion(question);

    try {
      const answer = await askQuestion({ subject, question, history: mapHistory(cleanHistory) });
      setMessages((current) => [...current, { id: createId(), role: "assistant", content: answer, subject }]);
      setStats((current) => {
        const subjectsStudied = new Set(current.subjectsStudied);
        subjectsStudied.add(subject);
        return { ...current, questionsAsked: current.questionsAsked + 1, subjectsStudied };
      });
      addActivity("Asked a question", `${subject}: ${question.slice(0, 72)}`);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: createId(),
          role: "assistant",
          content: error instanceof Error ? error.message : "Something went wrong. Please try again.",
          isError: true,
          subject,
        },
      ]);
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
      inputRef.current?.focus();
    }
  };

  const regenerate = async (assistantId: string) => {
    const index = messages.findIndex((message) => message.id === assistantId);
    const priorUser = [...messages.slice(0, index)].reverse().find((message) => message.role === "user");
    if (!priorUser) return;
    setMessages((current) => current.filter((message) => message.id !== assistantId));
    await sendMessage(priorUser.content);
  };

  const reactToMessage = (id: string, reaction: Reaction) => {
    setMessages((current) =>
      current.map((message) =>
        message.id === id ? { ...message, reaction: message.reaction === reaction ? null : reaction } : message
      )
    );
    if (reaction === "like") {
      setStats((current) => ({ ...current, likedResponses: current.likedResponses + 1 }));
    }
  };

  const copyText = async (text: string) => {
    await navigator.clipboard?.writeText(text);
  };

  const speakText = (text: string) => {
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  };

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
  };

  const appShell = theme === "dark" ? "dark bg-[#0b1020] text-slate-100" : "bg-slate-50 text-slate-950";

  return (
    <div className={`min-h-screen ${appShell} font-sans`}>
      {toast && <div className={`fixed right-4 top-4 z-50 max-w-sm rounded-2xl border px-4 py-3 text-sm shadow-lg ${toast.type === "error" ? "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200" : "border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-400/30 dark:bg-cyan-400/10 dark:text-cyan-200"}`} role="status" aria-live="polite">{toast.message}</div>}
      <div className="flex h-screen overflow-hidden">
        <Sidebar
          open={sidebarOpen}
          mobileOpen={mobileSidebarOpen}
          view={view}
          theme={theme}
          onToggle={() => setSidebarOpen((open) => !open)}
          onMobileClose={() => setMobileSidebarOpen(false)}
          onViewChange={(next) => {
            setView(next);
            setMobileSidebarOpen(false);
          }}
          onNewChat={newChat}
        />

        <main className="flex min-w-0 flex-1 flex-col">
          <Topbar
            view={view}
            subject={subject}
            theme={theme}
            onMenu={() => setMobileSidebarOpen(true)}
            onThemeChange={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
            onNewChat={newChat}
          />

          {view === "chat" && (
            <ChatView
              subject={subject}
              onSubjectChange={(nextSubject) => {
                setSubject(nextSubject);
                resetConversation();
              }}
              messages={messages}
              input={input}
              setInput={setInput}
              isLoading={isLoading}
              isStreaming={isStreaming}
              lastQuestion={lastQuestion}
              inputRef={inputRef}
              endRef={endRef}
              onSubmit={sendMessage}
              onClear={clearChat}
              onCopy={copyText}
              onRegenerate={regenerate}
              onReact={reactToMessage}
              onSpeak={speakText}
            />
          )}

          {view === "notes" && (
            <NotesView
              subject={subject}
              onActivity={addActivity}
              onPdfQuestion={() => setStats((current) => ({ ...current, pdfQuestions: current.pdfQuestions + 1 }))}
              onToast={showToast}
            />
          )}

          {view === "dashboard" && <Dashboard stats={stats} subject={subject} />}
        </main>
      </div>
    </div>
  );
}

function Sidebar({
  open,
  mobileOpen,
  view,
  theme,
  onToggle,
  onMobileClose,
  onViewChange,
  onNewChat,
}: {
  open: boolean;
  mobileOpen: boolean;
  view: AppView;
  theme: ThemeMode;
  onToggle: () => void;
  onMobileClose: () => void;
  onViewChange: (view: AppView) => void;
  onNewChat: () => void;
}) {
  const navItems = [
    { id: "chat" as const, label: "AI Tutor", icon: MessageSquare },
    { id: "notes" as const, label: "PDF Chat", icon: FileText },
    { id: "dashboard" as const, label: "Dashboard", icon: BarChart3 },
  ];

  return (
    <>
      {mobileOpen && <button aria-label="Close sidebar overlay" className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={onMobileClose} />}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r transition-all duration-300 lg:static ${
          open ? "w-72" : "w-20"
        } ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"} ${
          theme === "dark" ? "border-white/10 bg-[#0f172a]" : "border-slate-200 bg-white"
        }`}
      >
        <div className="flex h-16 items-center gap-3 px-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500 text-white shadow-lg shadow-cyan-500/20">
            <Sparkles size={20} />
          </div>
          {open && (
            <div className="min-w-0">
              <p className="truncate text-base font-semibold">QuickDoubt</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">AI study workspace</p>
            </div>
          )}
          <button className="ml-auto hidden rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-white/10 lg:block" onClick={onToggle} aria-label="Toggle sidebar">
            {open ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
          </button>
          <button className="ml-auto rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-white/10 lg:hidden" onClick={onMobileClose} aria-label="Close sidebar">
            <X size={18} />
          </button>
        </div>

        <div className="px-3">
          <button
            onClick={onNewChat}
            aria-label="Start a new chat"
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
          >
            <Plus size={18} />
            {open && <span>New Chat</span>}
          </button>
        </div>

        <nav className="mt-5 space-y-1 px-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = view === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onViewChange(item.id)}
                className={`flex h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                  active
                    ? "bg-cyan-50 text-cyan-700 dark:bg-cyan-400/10 dark:text-cyan-200"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10"
                } ${!open ? "justify-center" : ""}`}
              >
                <Icon size={18} />
                {open && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {open && (
          <div className="mt-auto p-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm dark:border-white/10 dark:bg-white/5">
              <div className="mb-2 flex items-center gap-2 font-semibold">
                <Brain size={17} />
                Study Mode
              </div>
              <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                Ask precise questions, upload notes, and track your learning in one focused workspace.
              </p>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}

function Topbar({
  view,
  subject,
  theme,
  onMenu,
  onThemeChange,
  onNewChat,
}: {
  view: AppView;
  subject: string;
  theme: ThemeMode;
  onMenu: () => void;
  onThemeChange: () => void;
  onNewChat: () => void;
}) {
  const title = view === "chat" ? "AI Tutor" : view === "notes" ? "PDF Chat" : "Student Dashboard";
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white/80 px-4 backdrop-blur-xl dark:border-white/10 dark:bg-[#0b1020]/80 sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-white/10 lg:hidden" onClick={onMenu} aria-label="Open sidebar">
          <Menu size={20} />
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold sm:text-lg">{title}</h1>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">{view === "chat" ? subject : "Fresh sessions on every refresh"}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={onNewChat} className="hidden items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-100 dark:border-white/10 dark:hover:bg-white/10 sm:flex">
          <Plus size={17} />
          New Chat
        </button>
        <button onClick={onThemeChange} className="rounded-xl border border-slate-200 p-2 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 dark:border-white/10 dark:hover:bg-white/10" aria-label="Toggle theme">
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>
    </header>
  );
}

function ChatView({
  subject,
  onSubjectChange,
  messages,
  input,
  setInput,
  isLoading,
  isStreaming,
  lastQuestion,
  inputRef,
  endRef,
  onSubmit,
  onClear,
  onCopy,
  onRegenerate,
  onReact,
  onSpeak,
}: {
  subject: string;
  onSubjectChange: (subject: string) => void;
  messages: ChatMessage[];
  input: string;
  setInput: (input: string) => void;
  isLoading: boolean;
  isStreaming: boolean;
  lastQuestion: string | null;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  endRef: React.RefObject<HTMLDivElement | null>;
  onSubmit: (prompt?: string) => void;
  onClear: () => void;
  onCopy: (text: string) => void;
  onRegenerate: (id: string) => void;
  onReact: (id: string, reaction: Reaction) => void;
  onSpeak: (text: string) => void;
}) {
  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200/80 bg-white/80 px-4 py-3 backdrop-blur-sm dark:border-white/10 dark:bg-slate-950/60 sm:px-6">
        <select
          value={subject}
          onChange={(event) => onSubjectChange(event.target.value)}
          aria-label="Select study subject"
          className="min-w-[220px] max-w-[280px] appearance-none rounded-2xl border border-slate-200 bg-white/95 px-4 py-2.5 pr-10 text-sm font-semibold shadow-sm outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 dark:border-white/10 dark:bg-slate-900/80 sm:min-w-[240px] sm:text-[15px]"
        >
          {SUBJECTS.map((item) => <option key={item}>{item}</option>)}
        </select>
        <button onClick={onClear} disabled={messages.length === 0} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 disabled:opacity-40 dark:hover:bg-white/10">
          <Trash2 size={17} />
          <span className="hidden sm:inline">Clear Chat</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-5xl space-y-6">
          {messages.length === 0 && !isLoading && <HomePrompts subject={subject} onPrompt={onSubmit} />}
          {messages.map((message) => (
            <ChatBubble
              key={message.id}
              message={message}
              onCopy={onCopy}
              onRegenerate={onRegenerate}
              onReact={onReact}
              onSpeak={onSpeak}
            />
          ))}
          {isLoading && <TypingSkeleton isStreaming={isStreaming} />}
          {lastQuestion && messages.some((message) => message.isError) && (
            <button onClick={() => onSubmit(lastQuestion)} className="rounded-xl border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:border-red-500/30 dark:hover:bg-red-500/10">
              Retry last question
            </button>
          )}
          <div ref={endRef} />
        </div>
      </div>

      <ChatComposer input={input} setInput={setInput} isLoading={isLoading} inputRef={inputRef} onSubmit={onSubmit} />
    </section>
  );
}

function HomePrompts({ subject, onPrompt }: { subject: string; onPrompt: (prompt?: string) => void }) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center py-10 text-center sm:py-16">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-500 text-white shadow-xl shadow-cyan-500/20">
        <Bot size={30} />
      </div>
      <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">What are we learning today?</h2>
      <p className="mt-3 max-w-xl text-sm leading-6 text-slate-500 dark:text-slate-400">
        Start a fresh {subject} conversation. This app does not load previous chats from localStorage, so every refresh begins clean.
      </p>
      <div className="mt-8 grid w-full gap-3 sm:grid-cols-2">
        {SUGGESTED_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            onClick={() => onPrompt(prompt)}
            className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 text-left text-sm font-medium shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-lg dark:border-white/10 dark:bg-slate-900/80 dark:hover:border-cyan-400/50"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}

function ChatBubble({
  message,
  onCopy,
  onRegenerate,
  onReact,
  onSpeak,
}: {
  message: ChatMessage;
  onCopy: (text: string) => void;
  onRegenerate: (id: string) => void;
  onReact: (id: string, reaction: Reaction) => void;
  onSpeak: (text: string) => void;
}) {
  const isAssistant = message.role === "assistant";
  return (
    <div className={`flex gap-3 animate-message-in ${message.role === "user" ? "justify-end" : "justify-start"}`}>
      {isAssistant && <Avatar icon={<Bot size={18} />} />}
      <div className={`max-w-[min(760px,88%)] ${message.role === "user" ? "order-first" : ""}`}>
        <div
          className={`rounded-3xl px-4 py-3.5 text-sm leading-7 shadow-sm ${
            message.role === "user"
              ? "bg-slate-900 text-white dark:bg-cyan-600"
              : message.isError
                ? "border border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200"
                : "border border-slate-200/80 bg-white/90 text-slate-800 shadow-sm dark:border-white/10 dark:bg-slate-900/80 dark:text-slate-100"
          }`}
        >
          {isAssistant && !message.isError ? <div className="markdown-content"><ReactMarkdown>{message.content}</ReactMarkdown></div> : <p className="whitespace-pre-wrap">{message.content}</p>}
        </div>
        {isAssistant && (
          <div className="mt-2 flex flex-wrap items-center gap-1 text-slate-500">
            <IconButton label="Copy" onClick={() => onCopy(message.content)} icon={<Copy size={15} />} />
            <IconButton label="Regenerate" onClick={() => onRegenerate(message.id)} icon={<RefreshCcw size={15} />} />
            <IconButton label="Like" active={message.reaction === "like"} onClick={() => onReact(message.id, "like")} icon={<ThumbsUp size={15} />} />
            <IconButton label="Dislike" active={message.reaction === "dislike"} onClick={() => onReact(message.id, "dislike")} icon={<ThumbsDown size={15} />} />
            <IconButton label="Read aloud" onClick={() => onSpeak(message.content)} icon={<Volume2 size={15} />} />
          </div>
        )}
      </div>
      {!isAssistant && <Avatar icon={<GraduationCap size={18} />} />}
    </div>
  );
}

function Avatar({ icon }: { icon: React.ReactNode }) {
  return <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 dark:border-white/10 dark:bg-white/10 dark:text-slate-200">{icon}</div>;
}

function IconButton({ label, icon, active, onClick }: { label: string; icon: React.ReactNode; active?: boolean; onClick: () => void }) {
  return (
    <button title={label} aria-label={label} onClick={onClick} className={`rounded-lg p-2 transition hover:bg-slate-100 dark:hover:bg-white/10 ${active ? "text-cyan-600 dark:text-cyan-300" : ""}`}>
      {icon}
    </button>
  );
}

function TypingSkeleton({ isStreaming = false }: { isStreaming?: boolean }) {
  return (
    <div className="flex gap-3">
      <Avatar icon={<Bot size={18} />} />
      <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/6">
        <div className="mb-3 flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className={isStreaming ? "animate-spin" : "animate-pulse"} size={16} />
          {isStreaming ? "Generating response" : "Preparing answer"}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-cyan-500 [animation-delay:0ms]" />
          <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-cyan-500 [animation-delay:120ms]" />
          <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-cyan-500 [animation-delay:240ms]" />
        </div>
      </div>
    </div>
  );
}

function ChatComposer({
  input,
  setInput,
  isLoading,
  inputRef,
  onSubmit,
}: {
  input: string;
  setInput: (value: string) => void;
  isLoading: boolean;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  onSubmit: (prompt?: string) => void;
}) {
  const [listening, setListening] = useState(false);

  const startVoice = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setInput("Voice input is not supported in this browser.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      setInput(`${input} ${event.results[0][0].transcript}`.trim());
    };
    recognition.start();
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit();
  };

  const keyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      onSubmit();
    }
  };

  return (
    <footer className="border-t border-slate-200/80 bg-white/80 px-4 py-4 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/60 sm:px-6">
      <form onSubmit={submit} className="mx-auto flex max-w-5xl items-end gap-2 rounded-2xl border border-slate-200/80 bg-white/90 p-2 shadow-sm shadow-slate-200/40 dark:border-white/10 dark:bg-slate-900/80 dark:shadow-none">
        <button type="button" title="Voice input" onClick={startVoice} className={`rounded-xl p-3 ${listening ? "bg-red-100 text-red-600 dark:bg-red-500/20" : "hover:bg-slate-100 dark:hover:bg-white/10"}`}>
          <Mic size={19} />
        </button>
        <textarea
          ref={inputRef}
          rows={1}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={keyDown}
          placeholder="Ask a question..."
          className="max-h-36 flex-1 resize-none bg-transparent px-1 py-3 text-sm outline-none placeholder:text-slate-400"
        />
        <button type="submit" disabled={!input.trim() || isLoading} className="rounded-xl bg-cyan-500 p-3 text-white transition hover:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-40">
          <Send size={19} />
        </button>
      </form>
    </footer>
  );
}

function NotesView({ subject, onActivity, onPdfQuestion, onToast }: { subject: string; onActivity: (label: string, detail: string) => void; onPdfQuestion: () => void; onToast: (message: string, type?: "success" | "error") => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<PdfChatState>({
    document: null,
    fileUrl: "",
    explanation: "",
    visualData: null,
    messages: [],
    input: "",
    isUploading: false,
    isExplaining: false,
    isVisualizing: false,
    isAsking: false,
    error: "",
    previewReady: false,
  });

  useEffect(() => () => {
    if (state.fileUrl) URL.revokeObjectURL(state.fileUrl);
  }, [state.fileUrl]);

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setState((current) => ({ ...current, error: "Please upload a PDF file." }));
      return;
    }

    setState((current) => ({ ...current, isUploading: true, error: "", messages: [], explanation: "", visualData: null, previewReady: false }));
    try {
      const response = await uploadPdf(file);
      const fileUrl = URL.createObjectURL(file);
      setState((current) => ({ ...current, document: response, fileUrl, isUploading: false, isExplaining: true, previewReady: false }));
      onActivity("Uploaded PDF", response.fileName);
      onToast("PDF uploaded and ready to study", "success");

      const explanation = await explainNotes(response.text, subject);
      setState((current) => ({ ...current, explanation, isExplaining: false, isVisualizing: true, previewReady: true }));

      try {
        const visualData = await visualizeNotes(response.text);
        setState((current) => ({ ...current, visualData, isVisualizing: false }));
      } catch {
        setState((current) => ({ ...current, isVisualizing: false, previewReady: true }));
      }
    } catch (error) {
      setState((current) => ({
        ...current,
        isUploading: false,
        isExplaining: false,
        isVisualizing: false,
        error: error instanceof Error ? error.message : "PDF upload failed.",
        previewReady: false,
      }));
      onToast(error instanceof Error ? error.message : "PDF upload failed.", "error");
    }
  };

  const askPdf = async () => {
    const question = state.input.trim();
    if (!question || !state.document || state.isAsking) return;
    const cleanHistory = state.messages.filter((message) => !message.isError);
    const userMessage: ChatMessage = { id: createId(), role: "user", content: question };
    setState((current) => ({ ...current, input: "", isAsking: true, messages: [...cleanHistory, userMessage] }));
    try {
      const answer = await askPdfQuestion({ documentId: state.document.documentId, question, history: mapHistory(cleanHistory) });
      setState((current) => ({ ...current, isAsking: false, messages: [...current.messages, { id: createId(), role: "assistant", content: answer }] }));
      onPdfQuestion();
      onActivity("Asked PDF question", question.slice(0, 72));
      onToast("Answer generated from the uploaded PDF", "success");
    } catch (error) {
      setState((current) => ({
        ...current,
        isAsking: false,
        messages: [...current.messages, { id: createId(), role: "assistant", content: error instanceof Error ? error.message : "PDF chat failed.", isError: true }],
      }));
    }
  };

  const markdownExport = useMemo(() => {
    const title = state.document?.fileName || "QuickDoubt PDF Notes";
    const chat = state.messages.map((message) => `**${message.role === "user" ? "Question" : "Answer"}:**\n\n${message.content}`).join("\n\n");
    return `# ${title}\n\n## Explanation\n\n${state.explanation || "No explanation generated yet."}\n\n## PDF Chat\n\n${chat || "No PDF chat yet."}\n`;
  }, [state.document?.fileName, state.explanation, state.messages]);

  const exportMarkdown = () => {
    const blob = new Blob([markdownExport], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "quickdoubt-notes.md";
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = () => {
    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) return;
    printWindow.document.write(`<html><head><title>QuickDoubt Notes</title><style>body{font-family:Inter,Arial,sans-serif;line-height:1.6;padding:32px;color:#0f172a} pre{white-space:pre-wrap}</style></head><body><pre>${markdownExport.replace(/[<>&]/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[char] || char))}</pre></body></html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  return (
    <section className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[minmax(360px,0.9fr)_minmax(420px,1.1fr)]">
      <div className="border-b border-slate-200/80 bg-white/70 p-4 backdrop-blur-sm dark:border-white/10 dark:bg-slate-950/50 sm:p-6 lg:border-b-0 lg:border-r">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">PDF study room</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Upload once, preview, export, and ask from the PDF only.</p>
          </div>
          <input ref={fileRef} type="file" accept=".pdf,application/pdf" className="hidden" onChange={upload} />
          <button onClick={() => fileRef.current?.click()} className="flex items-center gap-2 rounded-xl bg-cyan-500 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400">
            <Upload size={17} />
            Upload
          </button>
        </div>

        <div className="min-h-[420px] overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm transition-all duration-300 dark:border-white/10 dark:bg-slate-900/80">
          {state.fileUrl ? (
            <div className="relative h-[520px] w-full">
              {!state.previewReady && !state.error && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80 backdrop-blur-sm dark:bg-slate-900/80">
                  <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 shadow-sm dark:border-white/10 dark:bg-slate-800 dark:text-slate-200">
                    <Loader2 className="animate-spin" size={16} />
                    Preparing your PDF workspace
                  </div>
                </div>
              )}
              <iframe title="PDF preview" src={state.fileUrl} className="h-full w-full bg-white" />
            </div>
          ) : (
            <button onClick={() => fileRef.current?.click()} className="flex h-[420px] w-full flex-col items-center justify-center gap-3 text-slate-500 transition hover:bg-slate-50 dark:hover:bg-white/5">
              <FileText size={44} />
              <span className="font-medium">Choose a PDF to preview it here</span>
              <span className="text-xs">Text-based PDFs work best for chat.</span>
            </button>
          )}
        </div>
        {state.error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-200">{state.error}</p>}
      </div>

      <div className="flex min-h-0 flex-col bg-slate-50/60 p-4 dark:bg-slate-950/30 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold">{state.document?.fileName || "No PDF uploaded"}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {state.document ? `${state.document.pages} pages • ${state.document.charCount.toLocaleString()} characters` : "Upload a PDF to unlock grounded chat."}
            </p>
          </div>
          <div className="flex gap-2">
            <button disabled={!state.document} onClick={exportMarkdown} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium disabled:opacity-40 dark:border-white/10">
              <Clipboard size={16} />
              Markdown
            </button>
            <button disabled={!state.document} onClick={exportPdf} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium disabled:opacity-40 dark:border-white/10">
              <Download size={16} />
              PDF
            </button>
          </div>
        </div>

        {(state.isUploading || state.isExplaining || state.isVisualizing) && <LoadingPanel label={state.isUploading ? "Extracting PDF text" : state.isExplaining ? "Generating notes overview" : "Building study visuals"} />}

        {state.explanation && (
          <div className="mb-4 rounded-3xl border border-slate-200/80 bg-white/90 p-4 shadow-sm transition-all duration-300 dark:border-white/10 dark:bg-slate-900/80">
            <h4 className="mb-3 flex items-center gap-2 font-semibold"><BookOpen size={18} /> Notes overview</h4>
            <div className="markdown-content max-h-56 overflow-y-auto text-sm"><ReactMarkdown>{state.explanation}</ReactMarkdown></div>
          </div>
        )}

        {!state.document && !state.isUploading && !state.error && (
          <div className="mb-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-600 shadow-sm dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-300">
            Upload a PDF to unlock grounded explanations, exports, and question answering from the document.
          </div>
        )}

        {state.visualData && <MiniVisuals data={state.visualData} />}

        <div className="mt-4 flex min-h-[320px] flex-1 flex-col rounded-3xl border border-slate-200/80 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900/80">
          <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold dark:border-white/10">Ask questions from this PDF</div>
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {state.messages.length === 0 && !state.isAsking && (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-600 shadow-sm dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-300">
                Try asking for a summary, key definitions, formulas, or likely exam questions from the uploaded PDF.
              </div>
            )}
            {state.messages.map((message) => <ChatBubble key={message.id} message={message} onCopy={(text) => navigator.clipboard?.writeText(text)} onRegenerate={() => undefined} onReact={() => undefined} onSpeak={(text) => window.speechSynthesis.speak(new SpeechSynthesisUtterance(text))} />)}
            {state.isAsking && <TypingSkeleton />}
          </div>
          <div className="border-t border-slate-200 p-3 dark:border-white/10">
            <form onSubmit={(event) => { event.preventDefault(); askPdf(); }} className="flex gap-2">
              <input value={state.input} onChange={(event) => setState((current) => ({ ...current, input: event.target.value }))} disabled={!state.document} placeholder="Ask only from the PDF..." className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-400 disabled:opacity-50 dark:border-white/10" />
              <button disabled={!state.input.trim() || !state.document || state.isAsking} className="rounded-xl bg-cyan-500 px-4 text-white disabled:opacity-40"><Send size={18} /></button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}

function LoadingPanel({ label }: { label: string }) {
  return (
    <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-500"><Loader2 className="animate-spin" size={16} /> {label}</div>
      <div className="space-y-2">
        <div className="h-3 w-full animate-pulse rounded-full bg-slate-200 dark:bg-white/10" />
        <div className="h-3 w-2/3 animate-pulse rounded-full bg-slate-200 dark:bg-white/10" />
      </div>
    </div>
  );
}

function MiniVisuals({ data }: { data: VisualizeResponse }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
        <h4 className="mb-2 font-semibold">Mind map</h4>
        <MindmapNodeView node={{ label: data.mindmap.root, children: data.mindmap.children }} />
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
        <h4 className="mb-2 font-semibold">Flow</h4>
        <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
          {data.flowchart.steps.slice(0, 5).map((step, index) => <p key={step.id}>{index + 1}. {step.label}</p>)}
        </div>
      </div>
    </div>
  );
}

function MindmapNodeView({ node }: { node: MindmapNode }) {
  return (
    <div className="text-sm">
      <p className="font-medium">{node.label}</p>
      {node.children?.length > 0 && (
        <div className="ml-4 mt-1 space-y-1 border-l border-slate-200 pl-3 text-slate-600 dark:border-white/10 dark:text-slate-300">
          {node.children.slice(0, 5).map((child, index) => <MindmapNodeView key={`${child.label}-${index}`} node={child} />)}
        </div>
      )}
    </div>
  );
}

function Dashboard({ stats, subject }: { stats: Stats; subject: string }) {
  const progress = Math.min(100, stats.questionsAsked * 8 + stats.pdfQuestions * 12 + stats.subjectsStudied.size * 5);
  const studyStreak = Math.max(1, Math.min(14, 1 + stats.questionsAsked + Math.min(stats.pdfQuestions, 3)));
  const timeSpent = Math.max(25, stats.questionsAsked * 12 + stats.pdfQuestions * 18);
  const weeklyActivity = [
    { day: "Mon", value: Math.min(10, 2 + stats.questionsAsked % 3) },
    { day: "Tue", value: Math.min(10, 3 + stats.pdfQuestions % 4) },
    { day: "Wed", value: Math.min(10, 4 + stats.questionsAsked % 2) },
    { day: "Thu", value: Math.min(10, 2 + stats.pdfQuestions % 3) },
    { day: "Fri", value: Math.min(10, 5 + stats.questionsAsked % 4) },
    { day: "Sat", value: Math.min(10, 3 + stats.pdfQuestions % 2) },
    { day: "Sun", value: Math.min(10, 4 + stats.questionsAsked % 3) },
  ];
  const cards = [
    { label: "Questions asked", value: stats.questionsAsked, icon: MessageSquare },
    { label: "Subjects studied", value: stats.subjectsStudied.size, icon: BookOpen },
    { label: "PDF questions", value: stats.pdfQuestions, icon: FileText },
    { label: "Liked answers", value: stats.likedResponses, icon: ThumbsUp },
  ];

  return (
    <section className="flex-1 overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-300 dark:border-white/10 dark:bg-white/5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold">Learning progress</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Today’s in-session study signal for {subject} and your PDF work.</p>
            </div>
            <div className="flex items-center gap-2 rounded-2xl bg-cyan-50 px-4 py-3 text-cyan-700 dark:bg-cyan-400/10 dark:text-cyan-200">
              <Check size={18} />
              <span className="text-sm font-semibold">{progress}% active</span>
            </div>
          </div>
          <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
            <div className="h-full rounded-full bg-cyan-500 transition-all" style={{ width: `${progress}%` }} />
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
              <p className="text-sm text-slate-500 dark:text-slate-400">Study streak</p>
              <p className="mt-1 text-2xl font-semibold">{studyStreak} days</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
              <p className="text-sm text-slate-500 dark:text-slate-400">Time spent</p>
              <p className="mt-1 text-2xl font-semibold">{timeSpent} min</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
              <p className="text-sm text-slate-500 dark:text-slate-400">Total questions</p>
              <p className="mt-1 text-2xl font-semibold">{stats.questionsAsked + stats.pdfQuestions}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-200">
                  <Icon size={19} />
                </div>
                <p className="text-3xl font-semibold">{card.value}</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{card.label}</p>
              </div>
            );
          })}
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
            <h3 className="mb-4 font-semibold">Subject-wise statistics</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from(stats.subjectsStudied).length === 0 && <p className="text-sm text-slate-500 sm:col-span-2">Your subject insights will appear as you ask questions in different topics.</p>}
              {Array.from(stats.subjectsStudied).map((subjectName) => (
                <div key={subjectName} className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5">
                  <p className="text-sm font-medium">{subjectName}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Active learning focus</p>
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
              <h4 className="mb-3 text-sm font-semibold">Weekly activity</h4>
              <div className="flex items-end gap-2">
                {weeklyActivity.map((entry) => (
                  <div key={entry.day} className="flex flex-1 flex-col items-center gap-2">
                    <div className="w-full rounded-t-xl bg-cyan-500" style={{ height: `${Math.max(18, entry.value * 10)}px` }} />
                    <span className="text-xs text-slate-500 dark:text-slate-400">{entry.day}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
            <h3 className="mb-4 font-semibold">Recent sessions</h3>
            <div className="space-y-3">
              {stats.activity.length === 0 && <p className="text-sm text-slate-500">Your activity will appear after asking questions or uploading PDFs.</p>}
              {stats.activity.map((item) => (
                <div key={item.id} className="rounded-xl bg-slate-50 p-3 transition hover:bg-slate-100 dark:bg-white/5 dark:hover:bg-white/10">
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

declare global {
  interface SpeechRecognition {
    lang: string;
    interimResults: boolean;
    onstart: (() => void) | null;
    onend: (() => void) | null;
    onresult: ((event: SpeechRecognitionEvent) => void) | null;
    start: () => void;
  }

  type SpeechRecognitionConstructor = new () => SpeechRecognition;

  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

export default App;

# QuickDoubt — Architecture

## System Overview

```
┌──────────────────────────────────────────────────────────────┐
│                     Browser (Port 5173)                      │
│                                                              │
│   ┌─────────────────────┐   ┌──────────────────────────┐    │
│   │     Chat Tab        │   │       Notes Tab          │    │
│   │                     │   │                          │    │
│   │  Subject selector   │   │  PDF upload (drag/click) │    │
│   │  Message thread     │   │  Extracted text preview  │    │
│   │  Typing indicators  │   │  Simplified explanation  │    │
│   │  Retry on error     │   │  ┌──────────────────┐   │    │
│   │                     │   │  │ Visual Diagrams  │   │    │
│   │                     │   │  │  Mind Map        │   │    │
│   │                     │   │  │  Flowchart       │   │    │
│   │                     │   │  │  Table           │   │    │
│   │                     │   │  │  Pie Chart       │   │    │
│   │                     │   │  └──────────────────┘   │    │
│   └─────────────────────┘   └──────────────────────────┘    │
│                React 19 + TypeScript + Tailwind              │
└────────────────────────┬─────────────────────────────────────┘
                         │ HTTP (Vite dev proxy → port 3001)
                         │ /api/ask
                         │ /api/notes/upload
                         │ /api/notes/explain
                         │ /api/notes/visualize
                         ▼
┌──────────────────────────────────────────────────────────────┐
│                   Express Server (Port 3001)                  │
│                   Node.js + TypeScript                       │
│                                                              │
│   POST /api/ask           →  Chat with Claude                │
│   POST /api/notes/upload  →  multer + pdf-parse             │
│   POST /api/notes/explain →  Claude (markdown explanation)   │
│   POST /api/notes/visualize → Claude (structured JSON)      │
│   GET  /api/health        →  Liveness check                 │
└────────────────────────┬─────────────────────────────────────┘
                         │ HTTPS
                         ▼
┌──────────────────────────────────────────────────────────────┐
│               Anthropic API (Claude claude-sonnet-4-5)       │
│                                                              │
│   Authenticated via ANTHROPIC_API_KEY in server/.env        │
└──────────────────────────────────────────────────────────────┘
```

---

## Component Breakdown

### Frontend (`client/`)

| File | Role |
|------|------|
| `src/App.tsx` | Root component. Renders `Chat` tab and `Notes` tab. Hosts `NotesPanel` and all four visualisation sub-components (`Mindmap`, `Flowchart`, `DataTable`, `PieChartViz`). |
| `src/api.ts` | Typed fetch wrappers: `askQuestion`, `uploadPdf`, `explainNotes`, `visualizeNotes`. All calls go to relative `/api/…` paths (proxied by Vite). |
| `src/index.css` | Global styles, markdown content formatting, typing-dot animation. |
| `vite.config.ts` | Configures the `/api` proxy to `http://localhost:3001` so CORS is never an issue in development. |

### Backend (`server/src/index.ts`)

| Route | Middleware / Logic |
|-------|--------------------|
| `POST /api/ask` | Validates body, builds message history, calls Claude `messages.create`, returns `{ answer }`. |
| `POST /api/notes/upload` | `multer` stores file in memory. `pdf-parse` extracts text. Returns `{ text, pages, charCount }`. Returns 422 if no text found (scanned PDF). |
| `POST /api/notes/explain` | Sends extracted text to Claude with a "explain for a student" system prompt. Returns `{ explanation }` as markdown. |
| `POST /api/notes/visualize` | Sends text to Claude with a strict JSON-only system prompt. Strips markdown fences, parses JSON, validates 4 required keys. Retries once if JSON is malformed. Returns structured object. |

---

## Notes Feature: End-to-End Flow

```
User uploads PDF
      │
      ▼
[Client] validate file type (must be .pdf)
      │
      ▼
POST /api/notes/upload
      │
  multer (in-memory)
      │
  pdf-parse → extract raw text
      │
  check text length ≥ 10 chars (reject scanned images)
      │
      ▼
[Client receives] { text, pages, charCount }
      │
      ▼
POST /api/notes/explain (text + subject)
      │
  Claude: "Explain these notes simply…"
      │
      ▼
[Client renders] markdown explanation (react-markdown)
      │
      ▼
POST /api/notes/visualize (text)
      │
  Claude: "Return ONLY valid JSON with mindmap/flowchart/table/pieChart"
      │
  strip markdown fences → JSON.parse
      │  (retry once if invalid)
      │
  validate shape (all 4 keys present)
      │
      ▼
[Client renders] tabbed visual diagrams
  🧠 Mind Map   🔄 Flowchart   📋 Table   🥧 Pie Chart
```

---

## Key Design Decisions

- **Vite proxy** — avoids CORS entirely in development; no `CORS_ORIGIN` env var needed on the frontend.
- **In-memory PDF processing** — multer uses `memoryStorage()`, so no temp files are written to disk.
- **JSON retry logic** — Claude occasionally wraps JSON in markdown fences; the backend strips those and retries once with a stricter prompt before failing.
- **Client-side file validation** — Non-PDF files are caught before the network request, giving instant feedback.
- **Per-subject localStorage** — Chat history is stored per-subject so switching subjects doesn't lose previous conversations.

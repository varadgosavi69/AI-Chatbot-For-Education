import express, { Request, Response } from "express";
import cors from "cors";
import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";
import multer from "multer";
// pdf-parse ships CJS; esModuleInterop handles the default import
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string; numpages: number }>;

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const frontendUrl = process.env.FRONTEND_URL?.trim();
const allowedOrigins = [frontendUrl, "http://localhost:5173", "http://127.0.0.1:5173"].filter(Boolean);

// Middleware — allow localhost dev origins and a deployed frontend URL if configured
app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
  })
);
app.use(express.json());

// Validate API key on startup
const apiKey = process.env.ANTHROPIC_API_KEY || "";
if (!apiKey || apiKey === "your_anthropic_api_key_here" || !apiKey.startsWith("sk-")) {
  console.error("❌ ANTHROPIC_API_KEY is missing or still set to the placeholder value.");
  console.error("   Set a real key in server/.env — it must start with 'sk-'.");
  process.exit(1);
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Multer — store upload in memory (no disk writes)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB max
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are accepted"));
    }
  },
});

// Types
interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
}

interface AskRequestBody {
  subject: string;
  question: string;
  history: HistoryMessage[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function buildSystemPrompt(subject: string): string {
  return `You are an expert, patient tutor for ${subject}. Explain clearly, step-by-step, at a student's level. Use simple examples. Keep answers concise but complete.`;
}

function extractText(responseContent: Anthropic.ContentBlock[]): string {
  return (
    responseContent
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("") || ""
  );
}

function stripMarkdownFences(raw: string): string {
  // Remove ```json ... ``` or ``` ... ``` wrappers if present
  return raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
}

// ─── POST /api/ask ───────────────────────────────────────────────────────────

app.post("/api/ask", async (req: Request, res: Response): Promise<void> => {
  try {
    const { subject, question, history } = req.body as AskRequestBody;

    if (!subject || !question) {
      res.status(400).json({ error: "subject and question are required" });
      return;
    }

    const messages: Anthropic.MessageParam[] = [
      ...(history || []).map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })),
      { role: "user" as const, content: question },
    ];

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250514",
      max_tokens: 2048,
      system: buildSystemPrompt(subject),
      messages,
    });

    const answer =
      extractText(response.content) || "Sorry, I could not generate a response.";

    res.json({ answer });
  } catch (error: unknown) {
    console.error("Error calling Claude API:", error);
    if (error instanceof Anthropic.APIError) {
      res.status(error.status || 500).json({ error: `Claude API error: ${error.message}` });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /api/notes/upload ──────────────────────────────────────────────────
// Accepts a PDF file, extracts raw text, and returns it to the frontend.

app.post(
  "/api/notes/upload",
  upload.single("file"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "No file uploaded. Please attach a PDF." });
        return;
      }

      const parsed = await pdfParse(req.file.buffer);
      const text = parsed.text.trim();

      if (!text || text.length < 10) {
        res.status(422).json({
          error:
            "No readable text was found in this PDF. It may be a scanned image — please use a text-based PDF.",
        });
        return;
      }

      res.json({ text, pages: parsed.numpages, charCount: text.length });
    } catch (err: unknown) {
      console.error("PDF parse error:", err);
      if (err instanceof Error && err.message === "Only PDF files are accepted") {
        res.status(400).json({ error: "Only PDF files are accepted. Please upload a .pdf file." });
        return;
      }
      res.status(500).json({ error: "Failed to extract text from the PDF." });
    }
  }
);

// ─── POST /api/notes/explain ─────────────────────────────────────────────────
// Takes extracted text + subject, returns a markdown explanation from Claude.

app.post("/api/notes/explain", async (req: Request, res: Response): Promise<void> => {
  try {
    const { text, subject } = req.body as { text: string; subject?: string };

    if (!text || text.trim().length < 10) {
      res.status(400).json({ error: "text is required and must be non-empty." });
      return;
    }

    const subjectLabel = subject || "the subject";
    const systemPrompt =
      "Explain the following notes in simple, clear language for a student. " +
      "Break down complex concepts. Keep it well-structured with headings. " +
      "Use markdown formatting (##, ###, bullet points, bold) to make it easy to read.";

    const userMessage =
      `Subject: ${subjectLabel}\n\nNotes to explain:\n\n${text.slice(0, 12000)}`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250514",
      max_tokens: 3000,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const explanation = extractText(response.content);
    if (!explanation) {
      res.status(500).json({ error: "Claude returned an empty explanation." });
      return;
    }

    res.json({ explanation });
  } catch (error: unknown) {
    console.error("Explain error:", error);
    if (error instanceof Anthropic.APIError) {
      res.status(error.status || 500).json({ error: `Claude API error: ${error.message}` });
      return;
    }
    res.status(500).json({ error: "Failed to generate explanation." });
  }
});

// ─── POST /api/notes/visualize ───────────────────────────────────────────────
// Returns structured JSON for mindmap, flowchart, table, pieChart.

const VISUALIZE_SYSTEM = `You are a data structuring assistant. 
Your output must be ONLY valid JSON — no markdown, no preamble, no explanation, no code fences.
Return a JSON object matching this exact shape:
{
  "mindmap": { "root": "<topic>", "children": [{ "label": "<text>", "children": [{ "label": "<text>", "children": [] }] }] },
  "flowchart": { "steps": [{ "id": "<unique_id>", "label": "<text>", "next": ["<id>"] }] },
  "table": { "headers": ["<col1>", "<col2>"], "rows": [["<val>", "<val>"]] },
  "pieChart": { "title": "<title>", "segments": [{ "label": "<text>", "value": <number> }] }
}
All four keys are required. Do not add extra keys.`;

async function callVisualize(text: string): Promise<string> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250514",
    max_tokens: 3000,
    system: VISUALIZE_SYSTEM,
    messages: [
      {
        role: "user",
        content: `Extract visual structure from these notes. Return ONLY valid JSON:\n\n${text.slice(0, 10000)}`,
      },
    ],
  });
  return extractText(response.content);
}

app.post("/api/notes/visualize", async (req: Request, res: Response): Promise<void> => {
  try {
    const { text } = req.body as { text: string };

    if (!text || text.trim().length < 10) {
      res.status(400).json({ error: "text is required and must be non-empty." });
      return;
    }

    let raw = await callVisualize(text);
    raw = stripMarkdownFences(raw);

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Retry once with stricter prompt
      console.warn("Visualize: first attempt returned invalid JSON, retrying…");
      const retry = await anthropic.messages.create({
        model: "claude-sonnet-4-5-20250514",
        max_tokens: 3000,
        system: VISUALIZE_SYSTEM + "\n\nCRITICAL: Return ONLY the raw JSON object. Nothing else.",
        messages: [
          {
            role: "user",
            content: `The following notes need to be structured into a JSON object. Output ONLY the JSON:\n\n${text.slice(0, 8000)}`,
          },
        ],
      });
      const retryRaw = stripMarkdownFences(extractText(retry.content));
      try {
        parsed = JSON.parse(retryRaw);
      } catch {
        res.status(502).json({
          error: "Could not generate valid visual data. Please try again with different notes.",
        });
        return;
      }
    }

    // Basic shape validation
    const data = parsed as Record<string, unknown>;
    if (!data.mindmap || !data.flowchart || !data.table || !data.pieChart) {
      res.status(502).json({
        error: "Visual data was incomplete. Please try again.",
      });
      return;
    }

    res.json(parsed);
  } catch (error: unknown) {
    console.error("Visualize error:", error);
    if (error instanceof Anthropic.APIError) {
      res.status(error.status || 500).json({ error: `Claude API error: ${error.message}` });
      return;
    }
    res.status(500).json({ error: "Failed to generate visual data." });
  }
});

// ─── Health check ────────────────────────────────────────────────────────────

app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`⚡ QuickDoubt backend ready`);
});

import express, { Request, Response } from "express";
import cors from "cors";
import { GoogleGenerativeAI, GoogleGenerativeAIError, GoogleGenerativeAIFetchError } from "@google/generative-ai";
import dotenv from "dotenv";
import multer from "multer";
import { PDFParse } from "pdf-parse";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const allowedOrigins = [process.env.FRONTEND_URL, "http://localhost:5173", "http://127.0.0.1:5173"].filter(
  (origin): origin is string => Boolean(origin)
);

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
const apiKey = process.env.GEMINI_API_KEY || "";
if (!apiKey || apiKey === "your_gemini_api_key_here") {
  console.error("❌ GEMINI_API_KEY is missing or still set to the placeholder value.");
  console.error("   Set a real key in server/.env and make sure it is valid.");
  process.exit(1);
}

const gemini = new GoogleGenerativeAI(apiKey);
const geminiModel = gemini.getGenerativeModel({ model: "gemini-1.5-flash" });

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

function mapHistory(history: HistoryMessage[]): Array<{ role: "user" | "model"; parts: { text: string }[] }> {
  return (history || []).map((msg) => ({
    role: msg.role === "assistant" ? "model" : "user",
    parts: [{ text: msg.content }],
  }));
}

function extractText(response: { response?: { text?: () => string } }): string {
  try {
    return response.response?.text?.().trim() || "";
  } catch {
    return "";
  }
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

    const contents = [
      ...mapHistory(history),
      { role: "user" as const, parts: [{ text: question }] },
    ];

    const response = await geminiModel.generateContent({
      systemInstruction: buildSystemPrompt(subject),
      contents,
      generationConfig: { maxOutputTokens: 2048 },
    });

    const answer = extractText(response) || "Sorry, I could not generate a response.";

    res.json({ answer });
  } catch (error: unknown) {
    console.error("Error calling Gemini API:", error);
    if (error instanceof GoogleGenerativeAIFetchError) {
      res.status(error.status || 500).json({ error: `Gemini API error: ${error.message}` });
      return;
    }
    if (error instanceof GoogleGenerativeAIError) {
      res.status(500).json({ error: `Gemini API error: ${error.message}` });
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

      let parsed;
      try {
        const parser = new PDFParse({ data: new Uint8Array(req.file.buffer) });
        parsed = await parser.getText();
      } catch (parseErr: unknown) {
        console.error("PDF parsing crashed server-side:", parseErr);
        res.status(500).json({
          error: "PDF parsing crashed. The file might be corrupted or in an unsupported format.",
          details: parseErr instanceof Error ? parseErr.message : String(parseErr),
        });
        return;
      }

      const text = parsed.text.trim();

      if (!text || text.length < 10) {
        res.status(422).json({
          error:
            "No readable text was found in this PDF. It may be a scanned image — please use a text-based PDF.",
        });
        return;
      }

      res.json({ text, pages: parsed.total, charCount: text.length });
    } catch (err: unknown) {
      console.error("PDF upload/parse general error:", err);
      if (err instanceof Error && err.message === "Only PDF files are accepted") {
        res.status(400).json({ error: "Only PDF files are accepted. Please upload a .pdf file." });
        return;
      }
      res.status(500).json({
        error: "Failed to extract text from the PDF.",
        details: err instanceof Error ? err.message : String(err),
      });
    }
  }
);

// ─── POST /api/notes/explain ─────────────────────────────────────────────────
// Takes extracted text + subject, returns a markdown explanation from Gemini.

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

    const response = await geminiModel.generateContent({
      systemInstruction: systemPrompt,
      contents: [{ role: "user", parts: [{ text: userMessage }] }],
      generationConfig: { maxOutputTokens: 3000 },
    });

    const explanation = extractText(response);
    if (!explanation) {
      res.status(500).json({ error: "Gemini returned an empty explanation." });
      return;
    }

    res.json({ explanation });
  } catch (error: unknown) {
    console.error("Explain error:", error);
    if (error instanceof GoogleGenerativeAIFetchError) {
      res.status(error.status || 500).json({ error: `Gemini API error: ${error.message}` });
      return;
    }
    if (error instanceof GoogleGenerativeAIError) {
      res.status(500).json({ error: `Gemini API error: ${error.message}` });
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
  const response = await geminiModel.generateContent({
    systemInstruction: VISUALIZE_SYSTEM,
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `Extract visual structure from these notes. Return ONLY valid JSON:\n\n${text.slice(0, 10000)}`,
          },
        ],
      },
    ],
    generationConfig: { maxOutputTokens: 3000, responseMimeType: "application/json" },
  });
  return extractText(response);
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
      const retry = await geminiModel.generateContent({
        systemInstruction: VISUALIZE_SYSTEM + "\n\nCRITICAL: Return ONLY the raw JSON object. Nothing else.",
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `The following notes need to be structured into a JSON object. Output ONLY the JSON:\n\n${text.slice(0, 8000)}`,
              },
            ],
          },
        ],
        generationConfig: { maxOutputTokens: 3000, responseMimeType: "application/json" },
      });
      const retryRaw = stripMarkdownFences(extractText(retry));
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
    if (error instanceof GoogleGenerativeAIFetchError) {
      res.status(error.status || 500).json({ error: `Gemini API error: ${error.message}` });
      return;
    }
    if (error instanceof GoogleGenerativeAIError) {
      res.status(500).json({ error: `Gemini API error: ${error.message}` });
      return;
    }
    res.status(500).json({ error: "Failed to generate visual data." });
  }
});

// ─── Root route ─────────────────────────────────────────────────────────────

app.get("/", (_req: Request, res: Response) => {
  res.json({ status: "QuickDoubt backend is running" });
});

// ─── Health check ────────────────────────────────────────────────────────────

app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`⚡ QuickDoubt backend ready`);
});

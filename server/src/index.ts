import express, { Request, Response } from "express";
import cors from "cors";
import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Validate API key on startup
if (!process.env.ANTHROPIC_API_KEY) {
  console.error("❌ ANTHROPIC_API_KEY is not set in .env file");
  process.exit(1);
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
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

// System prompt builder
function buildSystemPrompt(subject: string): string {
  return `You are an expert, patient tutor for ${subject}. Explain clearly, step-by-step, at a student's level. Use simple examples. Keep answers concise but complete.`;
}

// POST /api/ask
app.post("/api/ask", async (req: Request, res: Response): Promise<void> => {
  try {
    const { subject, question, history } = req.body as AskRequestBody;

    // Validation
    if (!subject || !question) {
      res.status(400).json({ error: "subject and question are required" });
      return;
    }

    // Build messages array: previous history + new user question
    const messages: Anthropic.MessageParam[] = [
      ...(history || []).map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })),
      { role: "user" as const, content: question },
    ];

    // Call Claude API
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250514",
      max_tokens: 2048,
      system: buildSystemPrompt(subject),
      messages,
    });

    // Extract text from the response
    const answer =
      response.content
        .filter((block) => block.type === "text")
        .map((block) => {
          if (block.type === "text") return block.text;
          return "";
        })
        .join("") || "Sorry, I could not generate a response.";

    res.json({ answer });
  } catch (error: unknown) {
    console.error("Error calling Claude API:", error);

    if (error instanceof Anthropic.APIError) {
      res.status(error.status || 500).json({
        error: `Claude API error: ${error.message}`,
      });
      return;
    }

    res.status(500).json({ error: "Internal server error" });
  }
});

// Health check
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`⚡ QuickDoubt backend ready`);
});

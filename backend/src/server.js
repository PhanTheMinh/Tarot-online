import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import OpenAI from "openai";
import { z } from "zod";

const PORT = Number(process.env.PORT || 8080);
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";

if (!process.env.OPENAI_API_KEY) {
  console.warn("[WARN] OPENAI_API_KEY is missing. API calls will fail until you set it.");
}

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const app = express();

const allowlist = (process.env.ALLOWED_ORIGINS || "").split(",").map((v) => v.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowlist.length === 0 || allowlist.includes(origin)) return cb(null, true);
    return cb(new Error("Not allowed by CORS"));
  }
}));
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

const chatSchema = z.object({
  question: z.string().min(1),
  name: z.string().min(1).max(80).optional(),
  spread: z.string().max(120).optional()
});

function buildTarotPrompt({ name, question, spread }) {
  const userName = name ? `Người hỏi: ${name}.` : "Người hỏi: ẩn danh.";
  const spreadLine = spread ? `Kiểu trải bài: ${spread}.` : "Kiểu trải bài: 1 lá định hướng.";

  return [
    "Bạn là chuyên gia Tarot thân thiện, nói tiếng Việt dễ hiểu.",
    "Phong cách: thấu cảm, không phán xét, tập trung định hướng tích cực và hành động cụ thể.",
    "Nếu câu hỏi liên quan sức khỏe/tài chính/pháp lý, nhắc đây không phải tư vấn chuyên môn.",
    userName,
    spreadLine,
    `Câu hỏi: ${question}`,
    "Trả lời theo format:\n1) Năng lượng hiện tại\n2) Góc nhìn Tarot\n3) Hành động gợi ý trong 7 ngày tới"
  ].join("\n");
}

async function askTarot(payload) {
  const prompt = buildTarotPrompt(payload);
  const response = await client.responses.create({
    model: OPENAI_MODEL,
    input: prompt,
    temperature: 0.8
  });

  return response.output_text?.trim() || "Mình chưa nhận được nội dung trả lời. Bạn thử lại nhé.";
}

app.post("/api/chat", async (req, res) => {
  try {
    const parsed = chatSchema.parse(req.body);
    const answer = await askTarot(parsed);
    res.json({ answer });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid payload", details: error.issues });
    }

    console.error(error);
    res.status(500).json({ error: "Chat failed" });
  }
});

const server = createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (ws) => {
  ws.send(JSON.stringify({ type: "system", message: "Đã kết nối realtime Tarot." }));

  ws.on("message", async (raw) => {
    try {
      const body = JSON.parse(raw.toString());
      const parsed = chatSchema.parse(body);
      ws.send(JSON.stringify({ type: "typing", value: true }));
      const answer = await askTarot(parsed);
      ws.send(JSON.stringify({ type: "answer", data: answer }));
      ws.send(JSON.stringify({ type: "typing", value: false }));
    } catch (error) {
      ws.send(JSON.stringify({
        type: "error",
        message: error instanceof z.ZodError ? "Payload không hợp lệ." : "Không thể xử lý câu hỏi."
      }));
    }
  });
});

server.listen(PORT, () => {
  console.log(`Tarot backend listening on http://localhost:${PORT}`);
});

import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import OpenAI from "openai";
import { z } from "zod";

const PORT = Number(process.env.PORT || 8080);
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const LOG_LEVEL = process.env.LOG_LEVEL || "debug";

if (!process.env.OPENAI_API_KEY) {
  console.warn("[WARN] OPENAI_API_KEY is missing. API calls will fail until you set it.");
}

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const app = express();

const allowlist = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((v) => v.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || allowlist.length === 0 || allowlist.includes(origin)) return cb(null, true);
      return cb(new Error("Not allowed by CORS"));
    }
  })
);
app.use(express.json({ limit: "1mb" }));

function log(level, message, context = {}) {
  const levels = ["debug", "info", "warn", "error"];
  if (levels.indexOf(level) < levels.indexOf(LOG_LEVEL)) return;
  console[level](`[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}`, context);
}

function createRequestId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

app.use((req, res, next) => {
  req.requestId = createRequestId();
  res.setHeader("x-request-id", req.requestId);
  next();
});

app.get("/health", (_, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

const chatSchema = z.object({
  question: z.string().min(1),
  name: z.string().min(1).max(80).optional(),
  spread: z.string().max(120).optional(),
  drawnCard: z.string().max(120).optional()
});

function buildTarotPrompt({ name, question, spread, drawnCard }) {
  const userName = name ? `Người hỏi: ${name}.` : "Người hỏi: ẩn danh.";
  const spreadLine = spread ? `Kiểu trải bài: ${spread}.` : "Kiểu trải bài: 1 lá định hướng.";
  const cardLine = drawnCard ? `Lá bài đã bốc: ${drawnCard}.` : "Lá bài đã bốc: chưa có.";

  return [
    "Bạn là chuyên gia Tarot thân thiện, nói tiếng Việt dễ hiểu.",
    "Phong cách: thấu cảm, không phán xét, tập trung định hướng tích cực và hành động cụ thể.",
    "Nếu câu hỏi liên quan sức khỏe/tài chính/pháp lý, nhắc đây không phải tư vấn chuyên môn.",
    userName,
    spreadLine,
    cardLine,
    `Câu hỏi: ${question}`,
    "Trả lời theo format:\n1) Năng lượng hiện tại\n2) Góc nhìn Tarot\n3) Hành động gợi ý trong 7 ngày tới"
  ].join("\n");
}

function normalizeError(error, requestId) {
  const isOpenAIError = typeof error?.status === "number" || typeof error?.code === "string";

  if (error instanceof z.ZodError) {
    return {
      statusCode: 400,
      clientMessage: "Payload không hợp lệ.",
      errorCode: "VALIDATION_ERROR",
      details: error.issues,
      requestId
    };
  }

  if (isOpenAIError) {
    const status = Number(error.status || 500);
    const message = error?.message || "OpenAI API error";

    if (status === 401) {
      return {
        statusCode: 401,
        clientMessage: "OPENAI_API_KEY không hợp lệ hoặc đã hết hạn.",
        errorCode: "OPENAI_AUTH_ERROR",
        details: message,
        requestId
      };
    }

    if (status === 429) {
      return {
        statusCode: 429,
        clientMessage: "Vượt giới hạn tốc độ hoặc quota OpenAI.",
        errorCode: "OPENAI_RATE_LIMIT",
        details: message,
        requestId
      };
    }

    return {
      statusCode: 502,
      clientMessage: "OpenAI tạm thời lỗi, vui lòng thử lại.",
      errorCode: "OPENAI_UPSTREAM_ERROR",
      details: message,
      requestId
    };
  }

  return {
    statusCode: 500,
    clientMessage: "Không thể xử lý câu hỏi ở backend.",
    errorCode: "INTERNAL_ERROR",
    details: error?.message || String(error),
    requestId
  };
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
  const requestId = req.requestId || createRequestId();

  try {
    const parsed = chatSchema.parse(req.body);
    const answer = await askTarot(parsed);
    return res.json({ answer, requestId });
  } catch (error) {
    const normalized = normalizeError(error, requestId);

    log("error", "HTTP /api/chat failed", {
      requestId,
      errorCode: normalized.errorCode,
      details: normalized.details,
      stack: error?.stack,
      body: req.body
    });

    return res.status(normalized.statusCode).json({
      error: normalized.clientMessage,
      errorCode: normalized.errorCode,
      requestId,
      details: normalized.details
    });
  }
});

const server = createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (ws, req) => {
  const socketId = createRequestId();
  const ip = req.socket.remoteAddress;

  log("info", "WebSocket connected", { socketId, ip });
  ws.send(JSON.stringify({ type: "system", message: "Đã kết nối realtime Tarot.", socketId }));

  ws.on("message", async (raw) => {
    const requestId = createRequestId();

    try {
      let body;
      try {
        body = JSON.parse(raw.toString());
      } catch {
        throw new Error("INVALID_JSON");
      }

      const parsed = chatSchema.parse(body);
      ws.send(JSON.stringify({ type: "typing", value: true, requestId }));
      const answer = await askTarot(parsed);
      ws.send(JSON.stringify({ type: "answer", data: answer, requestId }));
      ws.send(JSON.stringify({ type: "typing", value: false, requestId }));

      log("info", "WebSocket question processed", {
        socketId,
        requestId,
        questionLength: parsed.question.length
      });
    } catch (error) {
      const normalized = error?.message === "INVALID_JSON"
        ? {
            statusCode: 400,
            clientMessage: "Payload không phải JSON hợp lệ.",
            errorCode: "INVALID_JSON",
            details: "Cannot parse incoming websocket payload.",
            requestId
          }
        : normalizeError(error, requestId);

      log("error", "WebSocket message failed", {
        socketId,
        requestId,
        errorCode: normalized.errorCode,
        details: normalized.details,
        raw: raw.toString(),
        stack: error?.stack
      });

      ws.send(
        JSON.stringify({
          type: "error",
          message: normalized.clientMessage,
          errorCode: normalized.errorCode,
          requestId,
          details: normalized.details
        })
      );
      ws.send(JSON.stringify({ type: "typing", value: false, requestId }));
    }
  });

  ws.on("close", () => {
    log("info", "WebSocket closed", { socketId });
  });
});

server.listen(PORT, "0.0.0.0", () => {
  log("info", `Tarot backend listening on http://0.0.0.0:${PORT}`);
});
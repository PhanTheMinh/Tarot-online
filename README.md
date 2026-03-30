# Tarot Online (Node.js + Vue + iOS Swift)

Ứng dụng hỏi đáp Tarot realtime gồm:
- **Backend**: Node.js + Express + WebSocket + OpenAI Responses API.
- **Web frontend**: Vue 3 + Vite.
- **iOS app**: SwiftUI + URLSessionWebSocketTask.

> ⚠️ Bảo mật: Bạn đã chia sẻ API key trong chat. Hãy **thu hồi (revoke) key đó ngay** trên OpenAI dashboard và tạo key mới trước khi chạy dự án.

## 1) Kiến trúc realtime

Bạn **nên dùng socket/WebSocket** cho bài toán Tarot vì:
- Nhận phản hồi gần realtime, UX tốt hơn polling.
- Có thể gửi trạng thái `typing`, sự kiện hệ thống, streaming token sau này.
- Dùng **chuẩn WebSocket** giúp cả Vue và Swift native kết nối dễ dàng.

Luồng:
1. Client (Web/iOS) mở WebSocket tới `ws://<backend>/ws`.
2. Gửi JSON `{ name, spread, question }`.
3. Backend gọi OpenAI Responses API, trả lần lượt:
   - `{"type":"typing","value":true}`
   - `{"type":"answer","data":"..."}`
   - `{"type":"typing","value":false}`

## 2) Chuẩn bị môi trường

- Node.js 20+
- npm 10+
- Xcode 15+ (để build iOS)

## 3) Cài và chạy Backend

```bash
cd backend
cp .env.example .env
# cập nhật OPENAI_API_KEY trong .env
npm install
npm run dev
```

Backend chạy ở `http://localhost:8080`.

Kiểm tra nhanh:
```bash
curl http://localhost:8080/health
```

## 4) Cài và chạy Web (Vue)

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Web mặc định chạy ở `http://localhost:5173`.

## 5) Chạy iOS app (SwiftUI)

Code Swift nằm tại `ios/TarotApp/TarotApp/`:
- `TarotApp.swift`
- `ContentView.swift`
- `TarotChatViewModel.swift`
- `TarotModels.swift`
- `AppConfig.swift`

### Tạo project iOS trong Xcode (1 lần)
Vì repo hiện chỉ chứa source Swift, bạn tạo shell project như sau:
1. Mở Xcode → **File > New > Project > iOS App**.
2. Product Name: `TarotApp`, Interface: `SwiftUI`, Language: `Swift`.
3. Lưu project vào `ios/TarotApp/`.
4. Chép đè các file Swift từ repo vào target `TarotApp`.
5. Đảm bảo iPhone/simulator có thể truy cập backend `ws://localhost:8080/ws`:
   - Nếu chạy simulator cùng máy Mac: giữ nguyên `localhost`.
   - Nếu chạy iPhone thật: sửa `AppConfig.websocketURL` thành IP LAN của máy backend, ví dụ `ws://192.168.1.10:8080/ws`.

### Cấu hình ATS cho HTTP/WebSocket local dev
Trong `Info.plist`, thêm exception domain cho local/IP nếu cần để cho phép kết nối không TLS lúc dev.

## 6) Đóng gói iOS (Archive)

1. Chọn scheme `TarotApp` và **Any iOS Device (arm64)**.
2. Xcode menu: **Product > Archive**.
3. Mở Organizer → chọn build archive.
4. Chọn **Distribute App**:
   - TestFlight/App Store
   - Ad Hoc
   - Development
5. Làm theo wizard ký số (signing, provisioning profile) và export `.ipa` nếu cần.

## 7) OpenAI API notes

Backend dùng SDK `openai` với `responses.create`.

Ví dụ payload ở server:
```js
const response = await client.responses.create({
  model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
  input: prompt,
  temperature: 0.8
});
```

## 8) Production checklist

- Không commit `.env` hoặc API key.
- Dùng HTTPS/WSS trong production.
- Thêm auth (JWT/session) cho người dùng.
- Thêm rate limit và logging.
- Thêm moderation/guardrails cho nội dung nhạy cảm.
- Theo dõi chi phí token (usage/budget alerts).

---

Nếu bạn muốn, bước tiếp theo mình có thể bổ sung:
- lưu lịch sử phiên Tarot (PostgreSQL + Prisma),
- đăng nhập Apple/Google,
- streaming token realtime thay vì đợi full câu trả lời.

## 9) Troubleshooting frontend

### Lỗi: `Unchecked runtime.lastError: ... moved into back/forward cache ... message channel is closed`
- Thông báo này thường đến từ **Chrome extension** (không phải lỗi business logic của app).
- Khi tab vào/ra **back-forward cache (bfcache)**, channel của extension có thể bị đóng.
- Ở bản này, frontend đã thêm `pagehide/pageshow` để đóng/mở lại WebSocket an toàn.

Nếu vẫn gặp lỗi, thử:
1. Mở app trong cửa sổ Incognito (không extension),
2. Tắt extension đang inject content script,
3. Kiểm tra WS trong DevTools > Network > WS.

## 10) Debug lỗi `Không thể xử lý câu hỏi`

Backend hiện đã trả lỗi có cấu trúc để bạn debug nhanh:

### HTTP `/api/chat` error response
```json
{
  "error": "OPENAI_API_KEY không hợp lệ hoặc đã hết hạn.",
  "errorCode": "OPENAI_AUTH_ERROR",
  "requestId": "...",
  "details": "..."
}
```

### WebSocket error event
```json
{
  "type": "error",
  "message": "Vượt giới hạn tốc độ hoặc quota OpenAI.",
  "errorCode": "OPENAI_RATE_LIMIT",
  "requestId": "...",
  "details": "..."
}
```

Các mã lỗi chính:
- `INVALID_JSON`
- `VALIDATION_ERROR`
- `OPENAI_AUTH_ERROR`
- `OPENAI_RATE_LIMIT`
- `OPENAI_UPSTREAM_ERROR`
- `INTERNAL_ERROR`

Bạn có thể bật log chi tiết bằng `LOG_LEVEL=debug` trong `backend/.env`.
Mỗi request sẽ có `requestId` để trace xuyên suốt giữa frontend log và backend log.

## 11) UI bốc bài (web)

Frontend đã có phần **Bốc 1 lá** với hoạt ảnh lật bài:
- Deck đầy đủ **78 lá**: 22 lá Ẩn Chính + 56 lá Ẩn Phụ (Cups/Pentacles/Swords/Wands).
- UI hiển thị **ảnh thật Rider-Waite** cho 22 lá Ẩn Chính.
- UI cũng hiển thị ảnh cho **56 lá Ẩn Phụ** (SVG local trong `frontend/public/cards/minor`).
- Khi gửi câu hỏi mà chưa bốc, app tự bốc trước rồi mới gửi.
- Tên lá bốc được gửi lên backend qua field `drawnCard` để AI giải theo đúng lá.

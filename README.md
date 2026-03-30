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

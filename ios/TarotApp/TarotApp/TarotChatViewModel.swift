import Foundation

@MainActor
final class TarotChatViewModel: ObservableObject {
    @Published var name = ""
    @Published var spread = "3 lá: Quá khứ - Hiện tại - Tương lai"
    @Published var question = ""
    @Published var typing = false
    @Published var messages: [TarotMessage] = []

    private var socketTask: URLSessionWebSocketTask?

    func connect() {
        socketTask = URLSession.shared.webSocketTask(with: AppConfig.websocketURL)
        socketTask?.resume()
        messages.append(TarotMessage(role: "system", text: "Đã kết nối realtime."))
        receiveLoop()
    }

    func sendQuestion() {
        let q = question.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !q.isEmpty else { return }

        let payload = TarotRequest(
            name: name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : name,
            spread: spread.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : spread,
            question: q
        )

        do {
            let data = try JSONEncoder().encode(payload)
            let text = String(decoding: data, as: UTF8.self)
            socketTask?.send(.string(text)) { [weak self] error in
                if let error {
                    Task { @MainActor in
                        self?.messages.append(TarotMessage(role: "error", text: error.localizedDescription))
                    }
                }
            }

            messages.append(TarotMessage(role: "you", text: q))
            question = ""
        } catch {
            messages.append(TarotMessage(role: "error", text: error.localizedDescription))
        }
    }

    private func receiveLoop() {
        socketTask?.receive { [weak self] result in
            guard let self else { return }
            switch result {
            case .failure(let error):
                Task { @MainActor in
                    self.messages.append(TarotMessage(role: "error", text: error.localizedDescription))
                }
            case .success(let message):
                Task { @MainActor in
                    self.handleIncoming(message)
                    self.receiveLoop()
                }
            }
        }
    }

    private func handleIncoming(_ message: URLSessionWebSocketTask.Message) {
        let text: String
        switch message {
        case .string(let value):
            text = value
        case .data(let data):
            text = String(decoding: data, as: UTF8.self)
        @unknown default:
            return
        }

        guard let data = text.data(using: .utf8),
              let payload = try? JSONDecoder().decode(SocketPayload.self, from: data) else {
            messages.append(TarotMessage(role: "system", text: text))
            return
        }

        if payload.type == "typing" {
            typing = payload.value ?? false
            return
        }

        if payload.type == "answer" {
            messages.append(TarotMessage(role: "reader", text: payload.data ?? ""))
            return
        }

        messages.append(TarotMessage(role: payload.type, text: payload.message ?? ""))
    }
}

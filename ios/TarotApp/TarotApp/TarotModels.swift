import Foundation

struct TarotMessage: Identifiable {
    let id = UUID()
    let role: String
    let text: String
}

struct TarotRequest: Codable {
    let name: String?
    let spread: String?
    let question: String
}

struct SocketPayload: Codable {
    let type: String
    let message: String?
    let data: String?
    let value: Bool?
}

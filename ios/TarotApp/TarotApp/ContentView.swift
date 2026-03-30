import SwiftUI

struct ContentView: View {
    @StateObject private var vm = TarotChatViewModel()

    var body: some View {
        NavigationStack {
            VStack(spacing: 12) {
                TextField("Tên của bạn", text: $vm.name)
                    .textFieldStyle(.roundedBorder)
                TextField("Kiểu trải bài", text: $vm.spread)
                    .textFieldStyle(.roundedBorder)
                TextEditor(text: $vm.question)
                    .frame(height: 120)
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(.secondary))

                Button("Gửi câu hỏi") {
                    vm.sendQuestion()
                }
                .buttonStyle(.borderedProminent)

                if vm.typing {
                    Text("Tarot reader đang rút bài...")
                        .foregroundStyle(.secondary)
                }

                List(vm.messages) { msg in
                    VStack(alignment: .leading, spacing: 4) {
                        Text(msg.role).font(.caption).foregroundStyle(.secondary)
                        Text(msg.text)
                    }
                }
            }
            .padding()
            .navigationTitle("Tarot Realtime")
            .onAppear {
                vm.connect()
            }
        }
    }
}

#Preview {
    ContentView()
}

<script setup>
import { ref } from 'vue';

const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8080/ws';
const name = ref('');
const spread = ref('3 lá: Quá khứ - Hiện tại - Tương lai');
const question = ref('');
const typing = ref(false);
const messages = ref([]);
let ws;

function connect() {
  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    messages.value.push({ role: 'system', text: 'Đã kết nối websocket.' });
  };

  ws.onmessage = (event) => {
    const payload = JSON.parse(event.data);
    if (payload.type === 'typing') {
      typing.value = payload.value;
      return;
    }

    if (payload.type === 'answer') {
      messages.value.push({ role: 'reader', text: payload.data });
      return;
    }

    messages.value.push({ role: payload.type || 'system', text: payload.message || 'Có dữ liệu mới.' });
  };

  ws.onerror = () => {
    messages.value.push({ role: 'error', text: 'Lỗi kết nối websocket.' });
  };
}

connect();

function ask() {
  if (!question.value.trim()) return;
  const payload = {
    name: name.value.trim(),
    spread: spread.value.trim(),
    question: question.value.trim()
  };

  messages.value.push({ role: 'you', text: payload.question });
  ws.send(JSON.stringify(payload));
  question.value = '';
}
</script>

<template>
  <main class="container">
    <h1>Tarot Realtime</h1>
    <div class="form-grid">
      <input v-model="name" placeholder="Tên của bạn" />
      <input v-model="spread" placeholder="Kiểu trải bài" />
      <textarea v-model="question" rows="4" placeholder="Bạn muốn hỏi điều gì?"></textarea>
      <button @click="ask">Gửi câu hỏi</button>
    </div>

    <p v-if="typing" class="typing">Tarot reader đang rút bài...</p>

    <div class="messages">
      <article v-for="(m, idx) in messages" :key="idx" :class="['msg', m.role]">
        <strong>{{ m.role }}:</strong> {{ m.text }}
      </article>
    </div>
  </main>
</template>

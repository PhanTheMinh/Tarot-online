<script setup>
import { onBeforeUnmount, ref } from 'vue';

const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8080/ws';
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
const name = ref('');
const spread = ref('3 lá: Quá khứ - Hiện tại - Tương lai');
const question = ref('');
const typing = ref(false);
const messages = ref([]);
const isConnected = ref(false);

let ws;
let reconnectTimer;

function pushMessage(role, text) {
  messages.value.push({ role, text });
}

function clearReconnectTimer() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = undefined;
  }
}

function scheduleReconnect() {
  clearReconnectTimer();
  reconnectTimer = setTimeout(() => {
    connect();
  }, 1200);
}

function connect() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return;
  }

  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    isConnected.value = true;
    pushMessage('system', 'Đã kết nối websocket realtime.');
  };

  ws.onmessage = (event) => {
    const payload = JSON.parse(event.data);

    if (payload.type === 'typing') {
      typing.value = payload.value;
      return;
    }

    if (payload.type === 'answer') {
      pushMessage('reader', payload.data);
      return;
    }

    if (payload.type === 'error') {
      const detail = payload.details ? ` | details: ${JSON.stringify(payload.details)}` : '';
      pushMessage('error', `[${payload.errorCode || 'UNKNOWN'}][${payload.requestId || '-'}] ${payload.message || 'Lỗi không xác định'}${detail}`);
      return;
    }

    pushMessage(payload.type || 'system', payload.message || 'Có dữ liệu mới.');
  };

  ws.onerror = () => {
    pushMessage('error', 'Kết nối websocket bị lỗi. App sẽ tự kết nối lại.');
  };

  ws.onclose = () => {
    isConnected.value = false;
    typing.value = false;
    scheduleReconnect();
  };
}

function closeSocket() {
  clearReconnectTimer();
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    ws.close();
  }
}

async function askViaHttp(payload) {
  const res = await fetch(`${apiBaseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await res.json();

  if (!res.ok) {
    const detail = data.details ? ` | details: ${JSON.stringify(data.details)}` : '';
    throw new Error(`[${data.errorCode || 'HTTP_ERROR'}][${data.requestId || '-'}] ${data.error || 'Backend trả lỗi khi gọi HTTP fallback.'}${detail}`);
  }

  pushMessage('reader', data.answer || 'Không có dữ liệu trả về.');
}

async function ask() {
  if (!question.value.trim()) return;

  const payload = {
    name: name.value.trim(),
    spread: spread.value.trim(),
    question: question.value.trim()
  };

  pushMessage('you', payload.question);
  question.value = '';

  try {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
      return;
    }

    pushMessage('system', 'Mất kết nối realtime, chuyển qua HTTP fallback.');
    await askViaHttp(payload);
  } catch (error) {
    pushMessage('error', error instanceof Error ? error.message : 'Không thể gửi câu hỏi.');
  }
}

function handlePageHide() {
  // Tránh trạng thái "message channel is closed" khi tab vào bfcache.
  closeSocket();
}

function handlePageShow() {
  connect();
}

connect();
window.addEventListener('pagehide', handlePageHide);
window.addEventListener('pageshow', handlePageShow);

onBeforeUnmount(() => {
  window.removeEventListener('pagehide', handlePageHide);
  window.removeEventListener('pageshow', handlePageShow);
  closeSocket();
});
</script>

<template>
  <main class="container">
    <h1>Tarot Realtime</h1>

    <p class="badge" :class="isConnected ? 'connected' : 'disconnected'">
      {{ isConnected ? 'Realtime: Connected' : 'Realtime: Disconnected' }}
    </p>

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

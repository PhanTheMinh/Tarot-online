<script setup>
import { computed, onBeforeUnmount, ref } from 'vue';

const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8080/ws';
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
const name = ref('');
const spread = ref('3 lá: Quá khứ - Hiện tại - Tương lai');
const question = ref('');
const typing = ref(false);
const messages = ref([]);
const isConnected = ref(false);
const drawnCard = ref('');
const isDrawing = ref(false);


const cardImages = {
  'The Fool': 'https://upload.wikimedia.org/wikipedia/commons/9/90/RWS_Tarot_00_Fool.jpg',
  'The Magician': 'https://upload.wikimedia.org/wikipedia/commons/d/de/RWS_Tarot_01_Magician.jpg',
  'The High Priestess': 'https://upload.wikimedia.org/wikipedia/commons/8/88/RWS_Tarot_02_High_Priestess.jpg',
  'The Empress': 'https://upload.wikimedia.org/wikipedia/commons/d/d2/RWS_Tarot_03_Empress.jpg',
  'The Emperor': 'https://upload.wikimedia.org/wikipedia/commons/c/c3/RWS_Tarot_04_Emperor.jpg',
  'The Hierophant': 'https://upload.wikimedia.org/wikipedia/commons/8/8d/RWS_Tarot_05_Hierophant.jpg',
  'The Lovers': 'https://upload.wikimedia.org/wikipedia/commons/3/3a/TheLovers.jpg',
  'The Chariot': 'https://upload.wikimedia.org/wikipedia/commons/9/9b/RWS_Tarot_07_Chariot.jpg',
  'Strength': 'https://upload.wikimedia.org/wikipedia/commons/f/f5/RWS_Tarot_08_Strength.jpg',
  'The Hermit': 'https://upload.wikimedia.org/wikipedia/commons/4/4d/RWS_Tarot_09_Hermit.jpg',
  'Wheel of Fortune': 'https://upload.wikimedia.org/wikipedia/commons/3/3c/RWS_Tarot_10_Wheel_of_Fortune.jpg',
  'Justice': 'https://upload.wikimedia.org/wikipedia/commons/e/e0/RWS_Tarot_11_Justice.jpg',
  'The Hanged Man': 'https://upload.wikimedia.org/wikipedia/commons/2/2b/RWS_Tarot_12_Hanged_Man.jpg',
  'Death': 'https://upload.wikimedia.org/wikipedia/commons/d/d7/RWS_Tarot_13_Death.jpg',
  'Temperance': 'https://upload.wikimedia.org/wikipedia/commons/f/f8/RWS_Tarot_14_Temperance.jpg',
  'The Devil': 'https://upload.wikimedia.org/wikipedia/commons/5/55/RWS_Tarot_15_Devil.jpg',
  'The Tower': 'https://upload.wikimedia.org/wikipedia/commons/5/53/RWS_Tarot_16_Tower.jpg',
  'The Star': 'https://upload.wikimedia.org/wikipedia/commons/d/db/RWS_Tarot_17_Star.jpg',
  'The Moon': 'https://upload.wikimedia.org/wikipedia/commons/7/7f/RWS_Tarot_18_Moon.jpg',
  'The Sun': 'https://upload.wikimedia.org/wikipedia/commons/1/17/RWS_Tarot_19_Sun.jpg',
  'Judgement': 'https://upload.wikimedia.org/wikipedia/commons/d/dd/RWS_Tarot_20_Judgement.jpg',
  'The World': 'https://upload.wikimedia.org/wikipedia/commons/f/ff/RWS_Tarot_21_World.jpg'
};

const tarotDeck = [
  'The Fool', 'The Magician', 'The High Priestess', 'The Empress', 'The Emperor',
  'The Hierophant', 'The Lovers', 'The Chariot', 'Strength', 'The Hermit',
  'Wheel of Fortune', 'Justice', 'The Hanged Man', 'Death', 'Temperance',
  'The Devil', 'The Tower', 'The Star', 'The Moon', 'The Sun',
  'Judgement', 'The World'
];

const cardLabel = computed(() => drawnCard.value || 'Chưa bốc lá nào');
const cardImageUrl = computed(() => drawnCard.value ? cardImages[drawnCard.value] : '');

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

function drawCard() {
  if (isDrawing.value) return;
  isDrawing.value = true;
  drawnCard.value = '';

  setTimeout(() => {
    const next = tarotDeck[Math.floor(Math.random() * tarotDeck.length)];
    drawnCard.value = next;
    isDrawing.value = false;
    pushMessage('system', `Bạn vừa bốc lá: ${next}`);
  }, 900);
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

  if (!drawnCard.value) {
    drawCard();
    pushMessage('system', 'Bạn chưa bốc bài, hệ thống đang tự bốc 1 lá trước khi giải.');
    await new Promise((resolve) => setTimeout(resolve, 950));
  }

  const payload = {
    name: name.value.trim(),
    spread: spread.value.trim(),
    drawnCard: drawnCard.value,
    question: question.value.trim()
  };

  pushMessage('you', `${payload.question}\n(Lá bốc: ${payload.drawnCard})`);
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

    <section class="draw-zone">
      <div class="tarot-card" :class="{ drawing: isDrawing, revealed: !!drawnCard }">
        <div class="card-face front">
          <template v-if="!isDrawing && cardImageUrl">
            <img :src="cardImageUrl" :alt="cardLabel" class="card-image" />
            <span class="card-caption">{{ cardLabel }}</span>
          </template>
          <template v-else>
            {{ isDrawing ? 'Đang bốc...' : cardLabel }}
          </template>
        </div>
        <div class="card-face back">🔮 Tarot</div>
      </div>
      <button @click="drawCard" :disabled="isDrawing">Bốc 1 lá</button>
    </section>

    <div class="form-grid">
      <input v-model="name" placeholder="Tên của bạn" />
      <input v-model="spread" placeholder="Kiểu trải bài" />
      <textarea v-model="question" rows="4" placeholder="Bạn muốn hỏi điều gì?"></textarea>
      <button @click="ask" :disabled="isDrawing">Gửi câu hỏi</button>
    </div>

    <p v-if="typing" class="typing">Tarot reader đang rút bài...</p>

    <div class="messages">
      <article v-for="(m, idx) in messages" :key="idx" :class="['msg', m.role]">
        <strong>{{ m.role }}:</strong> {{ m.text }}
      </article>
    </div>
  </main>
</template>

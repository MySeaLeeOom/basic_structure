<script setup lang="ts">
import { ref } from 'vue';
import Button from '@/volt/Button.vue';
import InputText from 'primevue/inputtext';
import { useAuthStore } from '@/stores/authStore';

const authStore = useAuthStore();
const query = ref('');
const messages = ref<{ role: 'user' | 'assistant', content: string }[]>([]);
const isTyping = ref(false);

const sendMessage = async () => {
  if (!query.value.trim() || !authStore.user?.id) return;

  const userQuery = query.value;
  const userId = authStore.user.id;
  
  messages.value.push({ role: 'user', content: userQuery });
  query.value = '';
  isTyping.value = true;

  const assistantMessage = ref({ role: 'assistant' as const, content: '' });
  messages.value.push(assistantMessage.value);

  try {
    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        query: userQuery
      })
    });

    const reader = response.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();
    let partialLine = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = (partialLine + chunk).split('\n');
      partialLine = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;

        const data = line.slice(6);
        if (data.includes('[DONE]')) {
          isTyping.value = false;
          continue;
        }

        try {
          if (data.startsWith('{')) {
            const parsed = JSON.parse(data);
            assistantMessage.value.content += parsed.data || parsed.content || '';
          } else {
            assistantMessage.value.content += data;
          }
        } catch (e) {
          assistantMessage.value.content += data;
        }
      }
    }
  } catch (err) {
    console.error('Chat failed:', err);
    assistantMessage.value.content = 'Error: Could not connect to AI service.';
  } finally {
    isTyping.value = false;
  }
};
</script>

<template>
  <div class="flex flex-col h-full border-l border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-900 w-80 p-4">
    <h3 class="text-lg font-bold mb-4 text-surface-900 dark:text-surface-50">AI Co-Pilot (Stage 1)</h3>
    
    <div class="flex-1 overflow-y-auto mb-4 space-y-4 pr-2">
      <div v-for="(msg, idx) in messages" :key="idx" 
           :class="['p-3 rounded-lg text-sm', msg.role === 'user' ? 'bg-primary-100 dark:bg-primary-900 text-primary-900 dark:!text-white ml-4' : 'bg-surface-200 dark:bg-surface-800 text-surface-900 dark:!text-white mr-4']">
        <div class="font-bold mb-1" :class="msg.role === 'user' ? 'text-primary-700 dark:text-primary-300' : 'text-surface-700 dark:text-surface-300'">
          {{ msg.role === 'user' ? 'You' : 'AI' }}
        </div>
        <div class="whitespace-pre-wrap">{{ msg.content }}</div>
      </div>
      <div v-if="isTyping" class="text-xs text-surface-500 dark:text-surface-400 animate-pulse">AI is thinking...</div>
    </div>

    <div class="flex gap-2">
      <InputText v-model="query" @keyup.enter="sendMessage" placeholder="Ask about your notes..." class="flex-1" />
      <Button icon="pi pi-send" @click="sendMessage" :disabled="isTyping" />
    </div>
  </div>
</template>

<style scoped>
::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 10px; }
</style>

<script setup lang="ts">
import { ref } from 'vue';
import Button from '@/volt/Button.vue';
import InputText from '@/volt/InputText.vue';
import { useAuthStore } from '@/stores/authStore';
import { useUiI18n } from '~/composables/useUiI18n';

const authStore = useAuthStore();
const { t } = useUiI18n();
const QUERY_MAX = 4000;
const query = ref('');
const messages = ref<{ role: 'user' | 'assistant', content: string }[]>([]);
const isTyping = ref(false);

const sendMessage = async () => {
  const userQuery = query.value.trim();
  if (!userQuery || !authStore.user?.id) return;
  if (userQuery.length > QUERY_MAX) {
    messages.value.push({ role: 'assistant', content: t('chat.error.connect') });
    return;
  }
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
      body: JSON.stringify({ query: userQuery })
    });

    if (!response.ok) {
      assistantMessage.value.content = t('chat.error.connect');
      return;
    }

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
        const trimmedLine = line.trim();
        if (!trimmedLine || !trimmedLine.startsWith('data: ')) continue;

        const rawData = trimmedLine.slice(6).trim();
        if (rawData === '[DONE]') {
          isTyping.value = false;
          continue;
        }

        try {
          const parsed = JSON.parse(rawData);
          if (parsed.text) {
            assistantMessage.value.content += parsed.text;
          } else if (parsed.error) {
            assistantMessage.value.content += `\n${t('chat.error.prefix', { error: parsed.error })}`;
          }
        } catch (e) {
          // Fallback if not valid JSON
          assistantMessage.value.content += rawData;
        }
      }
    }
  } catch (err) {
    console.error('Chat failed:', err);
    assistantMessage.value.content = t('chat.error.connect');
  } finally {
    isTyping.value = false;
  }
};
</script>

<template>
  <div class="w-full md:w-80 shrink-0 flex flex-col h-72 md:h-full min-h-0 bg-surface-0 dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-xl p-4 shadow-sm overflow-hidden">
    <h2 class="section-title">{{ t('chat.title') }}</h2>
    
    <div class="flex-1 overflow-y-auto mb-4 space-y-4 pr-2 custom-scrollbar">
      <div v-for="(msg, idx) in messages" :key="idx" 
           :class="['p-3 rounded-lg text-sm border', 
                    msg.role === 'user' 
                      ? 'bg-primary-50 dark:bg-primary-950 border-primary-200 dark:border-primary-800 text-surface-700 dark:!text-white ml-6' 
                      : 'bg-surface-100 dark:bg-surface-800 border-surface-200 dark:border-surface-700 text-surface-700 dark:!text-white mr-6']">
        <div class="text-[10px] font-bold uppercase tracking-tighter mb-1" :class="msg.role === 'user' ? 'text-primary-700 dark:text-primary-300' : 'text-surface-700 dark:text-surface-300'">
          {{ msg.role === 'user' ? t('chat.role.user') : t('chat.role.assistant') }}
        </div>
        <div class="whitespace-pre-wrap leading-relaxed">{{ msg.content }}</div>
      </div>
      <div v-if="isTyping" class="text-[10px] uppercase font-bold text-primary-500 animate-pulse ml-1">
        {{ t('chat.thinking') }}
      </div>
      <div v-if="messages.length === 0" class="p-4 text-center text-xs italic text-surface-400">
        {{ t('chat.empty') }}
      </div>
    </div>

    <div class="flex gap-2 pt-3 border-t border-surface-100 dark:border-surface-800">
      <InputText 
        v-model="query" 
        @keyup.enter="sendMessage" 
        :placeholder="t('chat.inputPlaceholder')" 
        :maxlength="QUERY_MAX"
        class="flex-1 min-w-0 dark:!text-white dark:placeholder:text-surface-500" 
      />
      <Button :label="t('chat.send')" @click="sendMessage" :disabled="isTyping" severity="primary" size="small" /> 
    </div>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: var(--p-surface-300);
  border-radius: 10px;
}
.dark .custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: var(--p-surface-700);
}
</style>

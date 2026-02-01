<script setup lang="ts">
import { ref, computed } from 'vue';
import { notes } from '@/data/notes';

const selectedNoteId = ref(notes[0]!.id);
const selectedNote = computed(() =>
  notes.find((n) => n.id === selectedNoteId.value) ?? notes[0]!
);

const sidebarCollapsed = ref(false);
</script>

<template>
  <div class="flex h-[calc(100vh-60px)]">
    <!-- LEFT: Obsidian-style Sidebar -->
    <aside class="w-60 shrink-0 bg-surface-50 dark:bg-surface-800 flex flex-col">
      <!-- Sidebar header -->
      <div class="px-3 py-2 flex items-center justify-between">
        <span class="text-xs font-medium uppercase tracking-wider text-surface-400 dark:text-surface-500">
          Notes
        </span>
        <button
          class="p-1 rounded hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 transition-colors"
          @click="sidebarCollapsed = !sidebarCollapsed"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
          </svg>
        </button>
      </div>

      <!-- Note list -->
      <nav class="flex-1 overflow-y-auto px-2 py-1">
        <button
          v-for="note in notes"
          :key="note.id"
          :class="[
            'w-full flex items-center gap-2 px-2 py-1.5 rounded-r-md text-left text-sm transition-all',
            selectedNoteId === note.id
              ? 'bg-primary-500/10 text-primary-500 dark:text-primary-400 border-l-2 border-primary-500'
              : 'text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700 border-l-2 border-transparent'
          ]"
          @click="selectedNoteId = note.id"
        >
          <!-- Document icon -->
          <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span class="truncate">{{ note.title }}</span>
        </button>
      </nav>

    </aside>

    <!-- RIGHT: Document View (Google Docs style) -->
    <main class="flex-1 bg-surface-200 dark:bg-surface-950 overflow-auto">
      <!-- Document container -->
      <div class="flex justify-center py-8 px-4">
        <!-- Paper -->
        <article class="w-full max-w-[816px] min-h-[1056px] bg-white dark:bg-surface-800 shadow-lg rounded-sm">
          <!-- Document content -->
          <div class="p-16">
            <!-- Title -->
            <h1 class="text-3xl font-bold text-surface-900 dark:text-surface-50 mb-8 pb-4 border-b border-surface-200 dark:border-surface-700">
              {{ selectedNote.title }}
            </h1>

            <!-- Markdown content (placeholder - will be rendered markdown later) -->
            <div class="prose prose-surface dark:prose-invert max-w-none">
              <pre class="whitespace-pre-wrap font-sans text-surface-700 dark:text-surface-300 leading-relaxed text-base">{{ selectedNote.content }}</pre>
            </div>
          </div>
        </article>
      </div>
    </main>
  </div>
</template>

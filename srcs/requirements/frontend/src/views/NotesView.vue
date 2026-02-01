<script setup lang="ts">
import { ref } from 'vue';
import Listbox from '@/volt/Listbox.vue';
import Card from '@/volt/Card.vue';
import { notes, type Note } from '@/data/notes';

const selectedNote = ref<Note>(notes[0]!);
</script>

<template>
  <div class="flex h-[calc(100vh-60px)]">
    <!-- Sidebar -->
    <aside class="w-64 shrink-0 bg-surface-50 dark:bg-surface-800 border-r border-surface-200 dark:border-surface-700 p-4">
      <h2 class="text-xs font-semibold uppercase tracking-wider text-surface-500 dark:text-surface-400 mb-3">
        Notes
      </h2>
      <Listbox
        v-model="selectedNote"
        :options="notes"
        optionLabel="title"
        dataKey="id"
        pt:root:class="border-0 shadow-none bg-transparent"
      />
    </aside>

    <!-- Document -->
    <main class="flex-1 bg-surface-200 dark:bg-surface-950 overflow-auto">
      <div class="flex justify-center py-8 px-4">
        <Card pt:root:class="w-full max-w-3xl min-h-[800px]">
          <template #title>{{ selectedNote.title }}</template>
          <template #content>
            <pre class="whitespace-pre-wrap font-sans text-surface-700 dark:text-surface-300 leading-relaxed">{{ selectedNote.content }}</pre>
          </template>
        </Card>
      </div>
    </main>
  </div>
</template>

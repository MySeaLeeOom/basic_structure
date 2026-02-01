<script setup lang="ts">
import { ref, onMounted } from 'vue';
import Listbox from '@/volt/Listbox.vue';
import Card from '@/volt/Card.vue';
import Skeleton from '@/volt/Skeleton.vue';
import Button from '@/volt/Button.vue';
import SidebarLayout from '@/components/layouts/SidebarLayout.vue';
import type { Note } from '@/data/notes';

const notes = ref<Note[]>([]);
const selectedNote = ref<Note | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);

async function fetchNotes() {
  loading.value = true;
  error.value = null;
  try {
    const res = await fetch('/api/notes');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    notes.value = await res.json();
    if (!selectedNote.value && notes.value.length) selectedNote.value = notes.value[0]!;
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Load failed';
  } finally {
    loading.value = false;
  }
}

onMounted(fetchNotes);
</script>

<template>
  <SidebarLayout>
    <template #sidebar>
      <h2 class="section-title">Notes</h2>

      <!-- Loading -->
      <div v-if="loading" class="space-y-2">
        <Skeleton height="2.5rem" v-for="i in 3" :key="i" />
      </div>

      <!-- Error -->
      <div v-else-if="error" class="p-4 text-center">
        <p class="text-red-500 mb-2">{{ error }}</p>
        <Button label="Retry" @click="fetchNotes" />
      </div>

      <!-- Notes list -->
      <Listbox v-else v-model="selectedNote" :options="notes" optionLabel="title" dataKey="id" />
    </template>

    <div class="document-container">
      <div v-if="!selectedNote" class="p-8 text-center text-muted-color">Select a note</div>
      <Card v-else pt:root:class="card-document">
        <template #title>{{ selectedNote.title }}</template>
        <template #content>
          <pre class="document-body">{{ selectedNote.content }}</pre>
        </template>
      </Card>
    </div>
  </SidebarLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import Listbox from '@/volt/Listbox.vue';
import Card from '@/volt/Card.vue';
import Button from '@/volt/Button.vue';
import InputText from '@/volt/InputText.vue';
import Textarea from '@/volt/Textarea.vue';
import SidebarLayout from '@/components/layouts/SidebarLayout.vue';
import type { Note } from '@/data/notes';

const notes = ref<Note[]>([]);
const selectedNote = ref<Note | null>(null);
const error = ref<string | null>(null);
const showCreateForm = ref(false);
const newTitle = ref('');
const newContent = ref('');

function resetForm() {
  showCreateForm.value = false;
  newTitle.value = '';
  newContent.value = '';
}

async function fetchNotes() {
  error.value = null;
  try {
    const res = await fetch('/api/notes');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    notes.value = await res.json();
    if (!selectedNote.value && notes.value.length) selectedNote.value = notes.value[0]!;
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Load failed';
  }
}

async function createNote() {
  try {
    const res = await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle.value.trim(), content: newContent.value }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const note: Note = await res.json();
    notes.value.push(note);
    selectedNote.value = note;
    resetForm();
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Create failed';
  }
}

onMounted(fetchNotes);
</script>

<template>
  <SidebarLayout>
    <template #sidebar>
      <div class="flex items-center justify-between mb-4">
        <h2 class="section-title !mb-0">Notes</h2>
        <Button
          v-if="!showCreateForm"
          label="+"
          severity="secondary"
          text
          rounded
          @click="showCreateForm = true"
          pt:root:class="!text-xl !w-8 !h-8 !p-0"
        />
      </div>

      <p v-if="error" class="text-red-500 text-sm">{{ error }}</p>
      <Listbox
        :modelValue="selectedNote"
        @update:modelValue="(val: Note) => val && (selectedNote = val)"
        :options="notes"
        optionLabel="title"
        dataKey="id"
      />
    </template>

    <div class="document-container">
      <Card v-if="showCreateForm" pt:root:class="card-document">
        <template #title>New Note</template>
        <template #content>
          <div class="flex flex-col gap-4">
            <InputText v-model="newTitle" placeholder="Title" fluid />
            <Textarea v-model="newContent" placeholder="Content..." rows="8" fluid />
            <div class="flex gap-2 justify-end">
              <Button label="Cancel" severity="secondary" text @click="resetForm" />
              <Button label="Create" :disabled="!newTitle.trim()" @click="createNote" />
            </div>
          </div>
        </template>
      </Card>
      <Card v-else-if="selectedNote" pt:root:class="card-document">
        <template #title>{{ selectedNote.title }}</template>
        <template #content>
          <pre class="document-body">{{ selectedNote.content }}</pre>
        </template>
      </Card>
      <div v-else class="p-8 text-center text-muted-color">Select a note</div>
    </div>
  </SidebarLayout>
</template>

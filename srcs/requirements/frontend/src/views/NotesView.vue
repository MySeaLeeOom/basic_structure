<script setup lang="ts">
import { ref, onMounted } from 'vue';
import Listbox from '@/volt/Listbox.vue';
import Button from '@/volt/Button.vue';
import SidebarLayout from '@/components/layouts/SidebarLayout.vue';
import NoteCreateForm from '@/components/notes/NoteCreateForm.vue';
import NoteDisplay from '@/components/notes/NoteDisplay.vue';
import { useNotes } from '@/composables/useNotes';

const { notes, selectedNote, error, fetchNotes, createNote } = useNotes();
const showCreateForm = ref(false);

async function handleCreate(title: string, content: string) {
  await createNote(title, content);
  showCreateForm.value = false;
}

function handleCancel() {
  showCreateForm.value = false;
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
          text
          rounded
          @click="showCreateForm = true"
        />
      </div>

      <p v-if="error" class="error-text">{{ error }}</p>
      <Listbox
        v-model="selectedNote"
        :options="notes"
        optionLabel="title"
        dataKey="id"
      />
    </template>

    <div class="document-container">
      <NoteCreateForm
        v-if="showCreateForm"
        @create="handleCreate"
        @cancel="handleCancel"
      />
      <NoteDisplay v-else-if="selectedNote" :note="selectedNote" />
      <div v-else class="empty-state">Select a note</div>
    </div>
  </SidebarLayout>
</template>

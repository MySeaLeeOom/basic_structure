<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import Card from '@/volt/Card.vue';
import Button from '@/volt/Button.vue';
import InputText from '@/volt/InputText.vue';
import Textarea from '@/volt/Textarea.vue';
import type { Note } from '@/types';
import { useNoteStore } from '@/stores/noteStore';

// ----
import { useConfirm } from 'primevue/useconfirm';

const confirm = useConfirm();
const noteStore = useNoteStore();
const emit = defineEmits<{
  cancel: [];
}>();

const props = defineProps<{
  note: Note | null;
}>();

const title = ref<string>('');
const content = ref<string>('');
const id = ref<number | null>(null);

const currentNote = ref(props.note);

// Watch for prop changes to update local state
// We need this because we work on the note locally until SAVE
watch(() => props.note, (newNote) => {
  currentNote.value = newNote;
  title.value = newNote?.title || '';
  content.value = newNote?.content || '';
  id.value = newNote?.id || null;
}, { immediate: true });

// Check if there are unsaved changes
const hasUnsavedChanges = computed(() => {
  if (!currentNote.value) {
    return title.value.trim() !== '' || content.value.trim() !== '';
  }
  return (
    title.value !== currentNote.value.title ||
    content.value !== currentNote.value.content
  );
});

async function handleSave() {
  await noteStore.editNote(id.value, title.value, content.value);

  // If we created a new note, sync the new id value & currentNote so we can keep editing
  if (id.value === null && noteStore.selectedNote) {
    id.value = noteStore.selectedNote.id;
    currentNote.value = noteStore.selectedNote;
  }
}

function handleCancel() {
  if (hasUnsavedChanges.value) {
    confirm.require({
      header: 'Unsaved Changes',
      message: 'You have unsaved changes. Do you want to discard them?',
      icon: 'pi pi-exclamation-triangle',
      acceptProps: {
        label: 'Discard',
        severity: 'danger'
      },
      rejectProps: {
        label: 'Keep Editing',
        severity: 'secondary'
      },
      accept: () => {
        //cancel closing the edit note
        // noteStore.selectedNote = null;
        emit('cancel');
      },
      reject: () => {
        // Stay in editor
      }
    });
  } else {
    // noteStore.selectedNote = null;
    emit('cancel');
  }
}
</script>

<template>
  <Card pt:root:class="card-document">
    <template #title>New Note</template>
    <template #content>
      <div class="flex flex-col gap-4">
        <InputText v-model="title" placeholder="Title" fluid />
        <Textarea v-model="content" placeholder="Content..." rows="8" fluid />
        <div class="flex gap-2 justify-end">
          <Button label="Cancel" severity="secondary" text @click="handleCancel" />
          <Button label="Save" :disabled="!title.trim()" @click="handleSave" />
        </div>
      </div>
    </template>
  </Card>
</template>

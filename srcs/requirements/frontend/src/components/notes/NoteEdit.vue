<script setup lang="ts">
import { ref, computed } from 'vue';
import Card from '@/volt/Card.vue';
import Button from '@/volt/Button.vue';
import InputText from '@/volt/InputText.vue';
import Textarea from '@/volt/Textarea.vue';
import type { Note } from '@/types';
import { useNoteStore } from '@/stores/noteStore';

// ----
import { useConfirm } from 'primevue/useconfirm';
import VoltConfirmDialog from '@/volt/ConfirmDialog.vue';

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

// Initialize form with existing note data if present
if (currentNote.value) {
  title.value = currentNote.value.title;
  content.value = currentNote.value.content;
  id.value = currentNote.value.id;
}

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

function handleSave() {
  noteStore.editNote(id.value, title.value, content.value);
  emit('cancel'); // Close the editor after saving
}

function handleCancel() {
  if (hasUnsavedChanges.value) {
    confirm.require({
      message: 'You have unsaved changes. Do you want to discard them?',
      header: 'Unsaved Changes',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        //cancel closing the edit note
        emit('cancel');
      },
      reject: () => {
        // Stay in editor
      }
    });
  } else {
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

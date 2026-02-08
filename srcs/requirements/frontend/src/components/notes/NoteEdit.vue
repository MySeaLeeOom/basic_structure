<script setup lang="ts">
import Card from '@/volt/Card.vue';
import Button from '@/volt/Button.vue';
import InputText from '@/volt/InputText.vue';
import Textarea from '@/volt/Textarea.vue';
// import { useNoteStore } from '@/stores/noteStore';
import { useEditStore } from '@/stores/editStore';
// ----
import { useConfirm } from 'primevue/useconfirm';

const confirm = useConfirm();
// const noteStore = useNoteStore();
const editStore = useEditStore();

const emit = defineEmits<{
  cancel: [];
}>();


function handleCancel() {
  if (editStore.isDirty) {
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
      <div class="flex flex-col gap-4 h-full">
        <InputText v-model="editStore.draftTitle" placeholder="Title" fluid />
        <Textarea 
          v-model="editStore.draftContent" 
          placeholder="Content..." 
          rows="8"
          fluid 
          class="flex-1 min-h-0 resize-none"
        />
        <!-- <Textarea 
          v-model="editStore.draftContent" 
            placeholder="Content..." 
              rows="8" 
                fluid /> -->

        <div class="flex gap-2 justify-end">
          <Button label="Cancel" severity="secondary" text @click="handleCancel" />
          <Button label="Save" :disabled="!editStore.draftTitle.trim()" @click="editStore.save" />
        </div>
      </div>
    </template>
  </Card>
</template>

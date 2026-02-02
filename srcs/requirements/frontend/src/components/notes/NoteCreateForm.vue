<script setup lang="ts">
import { ref } from 'vue';
import Card from '@/volt/Card.vue';
import Button from '@/volt/Button.vue';
import InputText from '@/volt/InputText.vue';
import Textarea from '@/volt/Textarea.vue';

const emit = defineEmits<{
  create: [title: string, content: string];
  cancel: [];
}>();

const title = ref('');
const content = ref('');

function handleCreate() {
  emit('create', title.value, content.value);
}

function handleCancel() {
  emit('cancel');
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
          <Button label="Create" :disabled="!title.trim()" @click="handleCreate" />
        </div>
      </div>
    </template>
  </Card>
</template>

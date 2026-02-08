<script setup lang="ts">
import Card from '@/volt/Card.vue';
import type { Note } from '@/types';

defineProps<{
  note: Note;
}>();
</script>

<template>
  <Card pt:root:class="card-document">
    <template #title>{{ note.title }}</template>
    <template #content>
      <pre class="document-body">{{ note.content }}</pre>
    </template>
  </Card>
</template>

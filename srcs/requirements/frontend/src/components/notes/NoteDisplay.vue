<script setup lang="ts">
import Card from '@/volt/Card.vue';
import { useEditStore } from '@/stores/editStore';

const editStore = useEditStore();
</script>

<template>
  <Card pt:root:class="card-document">
    <template #title>{{ editStore.draftTitle }}</template>
    <template #content>
      <pre class="document-body flex-1 overflow-auto">{{ editStore.draftContent }}</pre>
    </template>
  </Card>
</template>

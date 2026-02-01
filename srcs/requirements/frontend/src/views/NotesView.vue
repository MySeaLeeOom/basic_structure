<script setup lang="ts">
import { ref } from 'vue';
import Listbox from '@/volt/Listbox.vue';
import Card from '@/volt/Card.vue';
import SidebarLayout from '@/components/layouts/SidebarLayout.vue';
import { notes, type Note } from '@/data/notes';

const selectedNote = ref<Note>(notes[0]!);
</script>

<template>
  <SidebarLayout>
    <template #sidebar>
      <h2 class="section-title">Notes</h2>
      <Listbox
        v-model="selectedNote"
        :options="notes"
        optionLabel="title"
        dataKey="id"
        pt:root:class="listbox-borderless"
      />
    </template>

    <div class="document-container">
      <Card pt:root:class="card-document">
        <template #title>{{ selectedNote.title }}</template>
        <template #content>
          <pre class="document-body">{{ selectedNote.content }}</pre>
        </template>
      </Card>
    </div>
  </SidebarLayout>
</template>

<template>
  <div class="side-bar">
    <body>
      <ul>
        <NoteListItem> </NoteListItem>
        <NoteListItem> </NoteListItem>
      </ul>
    </body>
  </div>
</template>

<script lang="ts" setup>
import NoteListItem from './NoteListItem.vue'
</script>

<style>
.side-bar {
  background-color: bisque;
}
</style>

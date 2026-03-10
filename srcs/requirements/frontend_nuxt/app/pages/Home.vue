<script setup lang="ts">
import SidebarLayout from '@/components/layouts/SidebarLayout.vue';
</script>

<template>
  <SidebarLayout>
    <template #sidebar>
      <h2 class="section-title">Dashboard</h2>
      <p class="text-muted-color text-sm">Navigation items here</p>
    </template>

    <div class="p-8">
      <h1 class="text-2xl font-bold mb-4">Home View</h1>
      <h2 class="text-lg">Hello Myceleum Team!</h2>
    </div>
  </SidebarLayout>
</template>


<script lang="ts" setup>
import { onMounted } from 'vue';
import Header from "./components/Header.vue"
import VoltConfirmDialog from "./volt/ConfirmDialog.vue"
import { useAuthStore } from './stores/authStore';

const authStore = useAuthStore();

onMounted(() => {
	authStore.checkAuth();
});
</script>

<template>
	<!-- Accessibility -->
	<NuxtRouteAnnouncer />
	<div class="flex flex-col h-screen overflow-hidden">
		<Header />
		<NuxtPage class="flex-1 min-h-0" />
	</div>
	<VoltConfirmDialog />
</template>

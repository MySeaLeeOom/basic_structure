<script lang="ts" setup>
import { onMounted } from 'vue';
import Header from "./components/Header.vue"
import VoltConfirmDialog from "./volt/ConfirmDialog.vue"
import VoltToast from "./volt/Toast.vue"
import { useAuthStore } from './stores/authStore';

const authStore = useAuthStore();

onMounted(() => {
	authStore.checkAuth();
});
</script>

<template>
	<!-- Accessibility -->
	<NuxtRouteAnnouncer /> 
	<VoltToast />
	<Header />
    <NuxtPage />
	<VoltConfirmDialog />
</template>

<script lang="ts" setup>
import { computed, onMounted } from 'vue';
import Header from "./components/Header.vue"
import VoltConfirmDialog from "./volt/ConfirmDialog.vue"
import { useAuthStore } from './stores/authStore';
import { useUiI18n } from './composables/useUiI18n';

const authStore = useAuthStore();
const { locale } = useUiI18n();

useHead({
	htmlAttrs: {
		lang: computed(() => locale.value),
		dir: computed(() => locale.value === 'ar' ? 'rtl' : 'ltr'),
	},
});

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

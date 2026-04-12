<script lang="ts" setup>
import { computed } from 'vue';
import Header from "./components/Header.vue"
import VoltConfirmDialog from "./volt/ConfirmDialog.vue"
import { useUiI18n } from './composables/useUiI18n';

const { locale } = useUiI18n();

useHead({
	htmlAttrs: {
		lang: computed(() => locale.value),
		dir: computed(() => locale.value === 'ar' ? 'rtl' : 'ltr'),
	},
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

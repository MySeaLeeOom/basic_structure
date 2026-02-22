<script lang="ts" setup>
import Header from "./components/Header.vue"
import VoltConfirmDialog from "./volt/ConfirmDialog.vue"
</script>

<template>
	<Header />
	<RouterView />
	<VoltConfirmDialog />
</template>

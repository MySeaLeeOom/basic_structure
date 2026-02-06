<script lang="ts" setup>
import Header from "./components/Header.vue"
import ConfirmDialog from "./volt/ConfirmDialog.vue"
</script>

<template>
	<Header />
	<RouterView />
	<ConfirmDialog />
</template>

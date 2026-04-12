<script setup lang="ts">
import { ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import Card from "@/volt/Card.vue";
import Button from "@/volt/Button.vue";
import InputText from "@/volt/InputText.vue";
import { useUiI18n } from "~/composables/useUiI18n";

const { t } = useUiI18n();
const route = useRoute();
const router = useRouter();

const token = route.query.token as string;
const newPassword = ref("");
const confirmPassword = ref("");
const loading = ref(false);
const error = ref<string | null>(null);

async function handleSubmit() {
	error.value = null;

	if (newPassword.value !== confirmPassword.value) {
		error.value = t('reset.error.mismatch');
		return;
	}

	loading.value = true;
	try {
		const res = await fetch("/api/auth/reset-password", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ token, newPassword: newPassword.value }),
		});

		const data = await res.json();

		if (!res.ok) {
			error.value = data.error ?? "Something went wrong.";
			return;
		}

		router.push({ path: "/login", query: { reset: "success" } });
	} catch {
		error.value = "Something went wrong. Please try again.";
	} finally {
		loading.value = false;
	}
}
</script>

<template>
	<div class="flex items-center justify-center h-full bg-gray-100 dark:bg-gray-900 p-4">
		<Card class="w-full max-w-md">
			<template #title>
				<div class="text-center text-2xl font-bold mb-4">{{ t('reset.title') }}</div>
			</template>
			<template #content>
				<div v-if="!token" class="text-center text-red-500 text-sm">
					Invalid reset link. Please request a new one.
				</div>

				<form v-else class="flex flex-col gap-4" @submit.prevent="handleSubmit">
					<InputText v-model="newPassword" type="password" :placeholder="t('reset.newPassword')" fluid />
					<InputText v-model="confirmPassword" type="password" :placeholder="t('reset.confirm')" fluid />
					<Button type="submit" :label="t('reset.submit')" :loading="loading" fluid />
				</form>

				<div v-if="error" class="text-red-500 text-sm mt-4 text-center">{{ error }}</div>
			</template>
		</Card>
	</div>
</template>

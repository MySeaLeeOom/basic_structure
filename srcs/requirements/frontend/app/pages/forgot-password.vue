<script setup lang="ts">
import { ref } from "vue";
import Card from "@/volt/Card.vue";
import Button from "@/volt/Button.vue";
import InputText from "@/volt/InputText.vue";
import { useUiI18n } from "~/composables/useUiI18n";

const { t } = useUiI18n();

const email = ref("");
const loading = ref(false);
const submitted = ref(false);
const error = ref<string | null>(null);

async function handleSubmit() {
	loading.value = true;
	error.value = null;
	try {
		const res = await fetch("/api/auth/forgot-password", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email: email.value }),
		});
		// Always show the generic success — even if the server returned an error,
		// we don't want to leak whether the email exists.
		submitted.value = true;
	} catch {
		submitted.value = true; // same: show generic message on network error
	} finally {
		loading.value = false;
	}
}
</script>

<template>
	<div class="flex items-center justify-center h-full bg-gray-100 dark:bg-gray-900 p-4">
		<Card class="w-full max-w-md">
			<template #title>
				<div class="text-center text-2xl font-bold mb-4">{{ t('forgot.title') }}</div>
			</template>
			<template #content>
				<div v-if="submitted" class="flex flex-col gap-4">
					<p class="text-center text-sm text-gray-600 dark:text-gray-400">
						{{ t('forgot.success') }}
					</p>
					<NuxtLink to="/login" class="text-center text-primary hover:underline text-sm">
						{{ t('login.tab.login') }}
					</NuxtLink>
				</div>

				<form v-else class="flex flex-col gap-4" @submit.prevent="handleSubmit">
					<InputText v-model="email" type="email" :placeholder="t('forgot.email')" fluid />
					<Button type="submit" :label="t('forgot.submit')" :loading="loading" fluid />
					<NuxtLink to="/login" class="text-center text-primary hover:underline text-sm">
						{{ t('login.tab.login') }}
					</NuxtLink>
				</form>

				<div v-if="error" class="text-red-500 text-sm mt-4 text-center">{{ error }}</div>
			</template>
		</Card>
	</div>
</template>

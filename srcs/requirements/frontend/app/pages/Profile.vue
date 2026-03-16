<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from '@/stores/authStore';
import { useToast } from 'primevue/usetoast';
import Password from '@/volt/Password.vue';
import InputText from '@/volt/InputText.vue';
import Button from '@/volt/Button.vue';
import Card from '@/volt/Card.vue';
import Divider from '@/volt/Divider.vue';
import FormField from '@/volt/FormField.vue';

const auth = useAuthStore();
const toast = useToast();

const profileDraft = ref({
	loginName: auth.user?.loginName || '',
	email: auth.user?.email || '',
});

const passwordDraft = ref({ new: '', confirm: '' });
const loading = ref({ loginName: false, email: false, password: false });

const updateLoginName = async () => {
	loading.value.loginName = true;
	const result = await auth.updateLoginName(profileDraft.value.loginName);
	loading.value.loginName = false;

	toast.add({
		severity: result.success ? 'success' : 'error',
		summary: result.success ? 'Identity Saved' : 'Profile Error',
		detail: result.message,
		life: 5000
	});
};

const updateEmail = async () => {
	loading.value.email = true;
	const result = await auth.updateEmail(profileDraft.value.email);
	loading.value.email = false;

	toast.add({
		severity: result.success ? 'success' : 'error',
		summary: result.success ? 'Email Saved' : 'Profile Error',
		detail: result.message,
		life: 5000
	});
};

const updatePassword = async () => {
	if (passwordDraft.value.new !== passwordDraft.value.confirm) {
		toast.add({ severity: 'error', summary: 'Mismatch', detail: 'Passwords do not match!' });
		return;
	}

	loading.value.password = true;
	const result = await auth.addPassword(passwordDraft.value.new);
	loading.value.password = false;

	toast.add({
		severity: result.success ? 'success' : 'error',
		summary: result.success ? 'Success' : 'Security Error',
		detail: result.message
	});

	if (result.success) {
		passwordDraft.value.new = '';
		passwordDraft.value.confirm = '';
	}
};
</script>

<template>
	<div class="profile-container">
		<header>
			<h1>Settings</h1>
			<p>Manage your digital presence</p>
		</header>


		<Divider />

		<main>
			<Card>
				<template #title>Public Identity</template>
				<template #subtitle>Your identifier is how other scribes see you in the Mycelium.</template>
				<template #content>
					<div class="grid gap-4">
						<FormField label="Username">
							<div class="flex gap-2">
								<InputText v-model="profileDraft.loginName" fluid class="flex-1" />
								<Button icon="pi pi-check" text :loading="loading.loginName" @click="updateLoginName"
									aria-label="Save Username" />
							</div>
						</FormField>

						<FormField label="Email Address">
							<div class="flex gap-2">
								<InputText v-model="profileDraft.email" fluid class="flex-1" />
								<Button icon="pi pi-check" text :loading="loading.email" @click="updateEmail"
									aria-label="Save Email" />
							</div>
						</FormField>
					</div>
				</template>
			</Card>

			<Divider />

			<Card>
				<template #title>Change Secret</template>
				<template #content>
					<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
						<FormField label="New Password">
							<Password v-model="passwordDraft.new" :feedback="true" toggleMask fluid />
						</FormField>
						<FormField label="Confirm">
							<Password v-model="passwordDraft.confirm" :feedback="false" toggleMask fluid />
						</FormField>
					</div>
				</template>
				<template #footer>
					<div class="flex justify-end">
						<Button label="Secure Account" severity="secondary" icon="pi pi-lock"
							:loading="loading.password" @click="updatePassword" />
					</div>
				</template>
			</Card>

			<Divider />

			<Card>
				<template #title>Danger Zone</template>
				<template #content>
					<p>Deleting your account is permanent. All scrolls and maps will be lost.</p>
				</template>
				<template #footer>
					<div class="flex justify-end">
						<Button label="Delete My Identity" severity="danger" text icon="pi pi-trash" />
					</div>
				</template>
			</Card>
		</main>
	</div>
</template>

<style scoped>
.profile-container {
	max-width: 800px;
	margin: 0 auto;
	padding: 2rem;
}
</style>

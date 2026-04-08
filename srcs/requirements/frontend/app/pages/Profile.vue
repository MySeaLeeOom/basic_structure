<script setup lang="ts">
import { ref, onMounted, reactive } from 'vue';
import * as Y from 'yjs';
import { useAuthStore } from '../stores/authStore';
import Card from '../volt/Card.vue';
import Divider from '../volt/Divider.vue';
import InputText from '../volt/InputText.vue';
import Password from '../volt/Password.vue';
import Button from '../volt/Button.vue';

const auth = useAuthStore();
const isSubmitting = ref(false);
const activeForm = ref<'login' | 'email' | 'password' | null>(null);
const successMessage = ref('');

const formLogin = ref('');
const formEmail = ref('');
const oldPassword = ref('');
const newPassword = ref('');
const confirmPassword = ref('');

const errors = reactive({
	login: '',
	email: '',
	password: ''
});

onMounted(() => {
	if (auth.user) {
		formLogin.value = '';
		formEmail.value = '';
	}
});

async function handleUpdateLogin() {
	if (!formLogin.value || formLogin.value === auth.user?.loginName) return;

	isSubmitting.value = true;
	activeForm.value = 'login';
	errors.login = '';
	successMessage.value = '';

	const result = await auth.updateLoginName(formLogin.value);

	if (!result.success) {
		errors.login = result.message; // Display error strictly under the field
	} else {
		formLogin.value = ''; // Clear the field on success
		successMessage.value = "Username updated successfully";
	}

	isSubmitting.value = false;
	activeForm.value = null;
}

async function handleUpdateEmail() {
	if (formEmail.value === auth.user?.email) return;

	isSubmitting.value = true;
	activeForm.value = 'email';
	errors.email = '';
	successMessage.value = '';

	const result = await auth.updateEmail(formEmail.value);

	if (!result.success) {
		errors.email = result.message; // Display error strictly under the field
	} else {
		successMessage.value = "Email updated successfully";
	}

	isSubmitting.value = false;
	activeForm.value = null;
}

async function handleChangePassword() {
	if (!oldPassword.value || !newPassword.value) return;

	if (newPassword.value !== confirmPassword.value) {
		errors.password = "New passwords do not match";
		return;
	}

	isSubmitting.value = true;
	activeForm.value = 'password';
	errors.password = '';
	successMessage.value = '';

	const result = await auth.changePassword(oldPassword.value, newPassword.value);

	if (!result.success) {
		errors.password = result.message;
	} else {
		oldPassword.value = '';
		newPassword.value = '';
		confirmPassword.value = '';
		successMessage.value = "Password changed successfully";
	}

	isSubmitting.value = false;
	activeForm.value = null;
}

async function handleDeleteAccount() {
	const confirmed = window.confirm("Delete your account permanently? This cannot be undone.");
	if (!confirmed) return;

	isSubmitting.value = true;
	successMessage.value = '';
	errors.login = '';
	errors.email = '';
	errors.password = '';

	const result = await auth.deleteAccount();
	if (!result.success) {
		errors.password = result.message;
		isSubmitting.value = false;
		return;
	}

	window.location.href = '/';
}

function extractPlainTextFromXml(xml: string): string {
	if (!xml) return '';
	const parser = new DOMParser();
	const parsed = parser.parseFromString(`<div>${xml}</div>`, 'text/html');
	return (parsed.body.textContent || '').replace(/\s+/g, ' ').trim();
}

function decodeStateVector(stateVector: unknown): { title: string; content: string } | null {
	if (!Array.isArray(stateVector)) return null;
	const bytes = Uint8Array.from(stateVector.filter((v) => Number.isInteger(v) && v >= 0 && v <= 255));
	if (bytes.length === 0) return null;

	try {
		const doc = new Y.Doc();
		Y.applyUpdate(doc, bytes);
		const title = doc.getText('title').toString();
		const contentXml = doc.getXmlFragment('default').toString();
		const content = extractPlainTextFromXml(contentXml);
		return { title, content };
	} catch {
		return null;
	}
}

function buildReadableExportPayload(rawData: any) {
	if (!rawData || typeof rawData !== 'object') return rawData;
	if (!Array.isArray(rawData.notes)) return rawData;

	const notes = rawData.notes.map((note: any) => {
		const decoded = decodeStateVector(note?.state_vector);
		const { state_vector, ...rest } = note || {};
		return {
			...rest,
			title: decoded?.title || rest.title || 'Untitled',
			content: decoded?.content || '',
		};
	});

	return { ...rawData, notes };
}

async function handleExportData() {
	isSubmitting.value = true;
	successMessage.value = '';
	errors.login = '';
	errors.email = '';
	errors.password = '';

	const result = await auth.exportData();
	if (!result.success) {
		errors.password = result.message || "Data export failed";
		isSubmitting.value = false;
		return;
	}

	const payloadData = buildReadableExportPayload(result.data);
	const payload = JSON.stringify(payloadData, null, 2);
	const blob = new Blob([payload], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	const now = new Date().toISOString().replace(/[:.]/g, '-');
	const anchor = document.createElement('a');
	anchor.href = url;
	anchor.download = `mycelium-notes-export-${now}.json`;
	document.body.appendChild(anchor);
	anchor.click();
	document.body.removeChild(anchor);
	URL.revokeObjectURL(url);

	successMessage.value = "Data exported successfully";
	isSubmitting.value = false;
}
</script>


<template>
	<div class="h-full overflow-y-auto p-4">
		<div class="min-h-full flex items-start justify-center py-4 md:items-center">
		<Card class="w-full max-w-sm">
			<template #title>
				<h2 class="text-xl font-bold text-center">Settings</h2>
				<p v-if="successMessage" class="text-sm text-green-500 font-normal mt-2 text-center text-wrap">{{
					successMessage }}</p>
			</template>
			<template #content>
				<div class="flex flex-col gap-6">

					<div class="flex flex-col gap-2">
						<h3 class="font-bold">Identity</h3>
						<p v-if="auth.user?.loginName">Current: <strong>{{ auth.user.loginName }}</strong></p>
						<form @submit.prevent="handleUpdateLogin" class="flex flex-col gap-2">
							<InputText v-model="formLogin" placeholder="New username" fluid />
							<Button label="Update Username" type="submit"
								:disabled="isSubmitting || !formLogin || formLogin === (auth.user?.loginName || '')"
								fluid />
							<small v-if="errors.login" class="text-red-500">{{ errors.login }}</small>
						</form>
					</div>

					<div class="flex flex-col gap-2">
						<h3 class="font-bold">Contact</h3>
						<p>Current: <strong>{{ auth.user?.email || 'none' }}</strong></p>
						<form @submit.prevent="handleUpdateEmail" class="flex flex-col gap-2">
							<InputText v-model="formEmail" placeholder="New email address" fluid />
							<Button label="Update Email" type="submit"
								:disabled="isSubmitting || formEmail === (auth.user?.email || '')" fluid />
							<small v-if="errors.email" class="text-red-500">{{ errors.email }}</small>
						</form>
					</div>

					<div class="flex flex-col gap-2">
						<h3 class="font-bold">Security</h3>
						<form @submit.prevent="handleChangePassword" class="flex flex-col gap-2">
							<Password v-model="oldPassword" placeholder="Current Password" :feedback="false" toggleMask
								fluid />
							<Password v-model="newPassword" placeholder="New Password" toggleMask fluid />
							<Password v-model="confirmPassword" placeholder="Confirm New Password" :feedback="false"
								toggleMask fluid />
							<Button label="Change Password" type="submit"
								:disabled="isSubmitting || !oldPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword"
								fluid />
							<small v-if="errors.password" class="text-red-500">{{ errors.password }}</small>
						</form>
					</div>

					<div class="flex flex-col gap-2 pt-4">
						<h3 class="font-bold text-red-500">Danger Zone</h3>
						<Button label="Export Data (JSON)" severity="secondary" fluid :disabled="isSubmitting"
							@click="handleExportData" />
						<Button label="Delete Account" severity="danger" fluid :disabled="isSubmitting"
							@click="handleDeleteAccount" />
					</div>

				</div>
			</template>
		</Card>
		</div>
	</div>
</template>

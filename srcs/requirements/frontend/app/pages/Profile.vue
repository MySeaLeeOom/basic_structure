<script setup lang="ts">
import { ref, onMounted, reactive } from 'vue';
import * as Y from 'yjs';
import { useAuthStore } from '../stores/authStore';
import Card from '../volt/Card.vue';
import Divider from '../volt/Divider.vue';
import InputText from '../volt/InputText.vue';
import Password from '../volt/Password.vue';
import Button from '../volt/Button.vue';
import { useUiI18n } from '~/composables/useUiI18n';

const auth = useAuthStore();
const { t } = useUiI18n();
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
		successMessage.value = t('profile.success.username');
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
		successMessage.value = t('profile.success.email');
	}

	isSubmitting.value = false;
	activeForm.value = null;
}

async function handleChangePassword() {
	if (!oldPassword.value || !newPassword.value) return;

	if (newPassword.value !== confirmPassword.value) {
		errors.password = t('profile.error.passwordMismatch');
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
		successMessage.value = t('profile.success.password');
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
				<h2 class="text-xl font-bold text-center">{{ t('profile.title') }}</h2>
				<p v-if="successMessage" class="text-sm text-green-500 font-normal mt-2 text-center text-wrap">{{
					successMessage }}</p>
			</template>
			<template #content>
				<div class="flex flex-col gap-6">

					<div class="flex flex-col gap-2">
						<h3 class="font-bold">{{ t('profile.section.username') }}</h3>
						<p v-if="auth.user?.loginName">{{ t('profile.currentPrefix') }} <strong>{{ auth.user.loginName }}</strong></p>
						<form @submit.prevent="handleUpdateLogin" class="flex flex-col gap-2">
							<InputText v-model="formLogin" :placeholder="t('profile.placeholder.newUsername')" fluid />
							<Button :label="t('profile.button.updateUsername')" type="submit"
								:disabled="isSubmitting || !formLogin || formLogin === (auth.user?.loginName || '')"
								fluid />
							<small v-if="errors.login" class="text-red-500">{{ errors.login }}</small>
						</form>
					</div>

					<div class="flex flex-col gap-2">
						<h3 class="font-bold">{{ t('profile.section.email') }}</h3>
						<p>{{ t('profile.currentPrefix') }} <strong>{{ auth.user?.email || t('profile.none') }}</strong></p>
						<form @submit.prevent="handleUpdateEmail" class="flex flex-col gap-2">
							<InputText v-model="formEmail" :placeholder="t('profile.placeholder.newEmail')" fluid />
							<Button :label="t('profile.button.updateEmail')" type="submit"
								:disabled="isSubmitting || formEmail === (auth.user?.email || '')" fluid />
							<small v-if="errors.email" class="text-red-500">{{ errors.email }}</small>
						</form>
					</div>

					<div class="flex flex-col gap-2">
						<h3 class="font-bold">{{ t('profile.section.security') }}</h3>
						<form @submit.prevent="handleChangePassword" class="flex flex-col gap-2">
							<Password v-model="oldPassword" :placeholder="t('profile.placeholder.currentPassword')" :feedback="false" toggleMask
								fluid />
							<Password v-model="newPassword" :placeholder="t('profile.placeholder.newPassword')" toggleMask fluid />
							<Password v-model="confirmPassword" :placeholder="t('profile.placeholder.confirmNewPassword')" :feedback="false"
								toggleMask fluid />
							<Button :label="t('profile.button.changePassword')" type="submit"
								:disabled="isSubmitting || !oldPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword"
								fluid />
							<small v-if="errors.password" class="text-red-500">{{ errors.password }}</small>
						</form>
					</div>

					<div class="flex flex-col gap-2 pt-4">
						<h3 class="font-bold text-red-500">{{ t('profile.section.danger') }}</h3>
						<Button label="Export Data (JSON)" severity="secondary" fluid :disabled="isSubmitting"
							@click="handleExportData" />
						<Button :label="t('profile.button.deleteAccount')" severity="danger" fluid :disabled="isSubmitting"
							@click="handleDeleteAccount" />
					</div>

				</div>
			</template>
		</Card>
		</div>
	</div>
</template>

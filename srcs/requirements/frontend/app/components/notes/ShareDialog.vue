<script setup lang="ts">
import { ref, watch } from 'vue';
import Dialog from '@/volt/Dialog.vue';
import Button from '@/volt/Button.vue';
import InputText from '@/volt/InputText.vue';
import SelectButton from '@/volt/SelectButton.vue';
import { useUiI18n } from '~/composables/useUiI18n';

const props = defineProps<{ noteId: string }>();
const visible = defineModel<boolean>('visible', { required: true });
const { t } = useUiI18n();

const userInput = ref('');
const resolvedUser = ref<{ id: string; username: string } | null>(null);
const resolveError = ref('');
const shareRole = ref('View');
const roleOptions = ['View', 'Edit'];
const success = ref('');

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

watch(userInput, (val) => {
	resolvedUser.value = null;
	resolveError.value = '';
	success.value = '';
	if (!val.trim()) return;
	if (debounceTimer) clearTimeout(debounceTimer);
	debounceTimer = setTimeout(() => resolveUser(val.trim()), 400);
});

async function resolveUser(identifier: string) {
	try {
		const res = await $fetch<{ user: { id: string; loginName: string } }>('/api/auth/resolve', {
			query: { identifier },
		});
		resolvedUser.value = { id: res.user.id, username: res.user.loginName };
	} catch {
		resolveError.value = t('notes.share.error.userNotFound');
	}
}

async function createShare() {
	if (!resolvedUser.value) return;
	success.value = '';
	resolveError.value = '';
	try {
		await $fetch('/api/notes/collab/', {
			method: 'POST',
			body: {
				note_id: props.noteId,
				guest_id: resolvedUser.value.id,
				role: shareRole.value,
			},
		});
		success.value = t('notes.share.success.sharedWithUser', { username: resolvedUser.value.username });
		userInput.value = '';
		resolvedUser.value = null;
	} catch (e: any) {
		if (e?.response?.status === 409) {
			resolveError.value = t('notes.share.error.alreadyHasAccess');
		} else {
			resolveError.value = e?.data?.message ?? t('notes.share.error.createFailed');
		}
	}
}

function onHide() {
	userInput.value = '';
	resolvedUser.value = null;
	resolveError.value = '';
	shareRole.value = 'View';
	success.value = '';
}
</script>

<template>
	<Dialog v-model:visible="visible" :header="t('notes.share.header')" modal :style="{ width: '26rem' }" @hide="onHide">
		<div class="flex flex-col gap-4">

			<div class="flex flex-col gap-1">
				<label class="text-sm">{{ t('notes.share.shareWithUser') }}</label>
				<InputText v-model="userInput" :placeholder="t('notes.share.userPlaceholder')" class="w-full" />
				<span v-if="resolvedUser" class="text-xs text-green-600">{{ t('notes.share.foundUser', { username: resolvedUser.username }) }}</span>
				<span v-else-if="resolveError" class="text-xs text-red-500">{{ resolveError }}</span>
			</div>

			<div class="flex flex-col gap-1">
				<label class="text-sm">{{ t('notes.share.permissionLabel') }}</label>
				<SelectButton v-model="shareRole" :options="roleOptions" :allow-empty="false" />
			</div>

			<Button :label="t('notes.share.shareButton')" :disabled="!resolvedUser" @click="createShare" />

			<span v-if="success" class="text-xs text-green-600">{{ success }}</span>
		</div>
	</Dialog>
</template>

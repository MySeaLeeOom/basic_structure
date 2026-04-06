<script setup lang="ts">
import { ref, watch } from 'vue';
import Dialog from '@/volt/Dialog.vue';
import Button from '@/volt/Button.vue';
import InputText from '@/volt/InputText.vue';
import SelectButton from '@/volt/SelectButton.vue';
import ToggleSwitch from '@/volt/ToggleSwitch.vue';

const props = defineProps<{ noteId: string }>();
const visible = defineModel<boolean>('visible', { required: true });

const isPublic = ref(true);
const userInput = ref('');
const resolvedUser = ref<{ id: string; username: string } | null>(null);
const resolveError = ref('');
const shareRole = ref('View');
const roleOptions = ['View', 'Edit'];

const generatedUrl = ref('');
const copyLabel = ref('Copy');

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

watch(userInput, (val) => {
	resolvedUser.value = null;
	resolveError.value = '';
	if (!val.trim()) return;
	if (debounceTimer) clearTimeout(debounceTimer);
	debounceTimer = setTimeout(() => resolveUser(val.trim()), 400);
});

async function resolveUser(identifier: string) {
	try {
		const res = await $fetch<{ id: string; username: string }>('/api/auth/resolve', {
			query: { identifier },
		});
		resolvedUser.value = res;
	} catch {
		resolveError.value = 'User not found';
	}
}

async function createShare() {
	generatedUrl.value = '';
	const body: Record<string, unknown> = {
		note_id: props.noteId,
		guest_id: isPublic.value ? null : resolvedUser.value?.id ?? null,
		role: shareRole.value,
	};
	try {
		const share = await $fetch<{ id: string }>('/api/notes/collab/', {
			method: 'POST',
			body,
		});
		generatedUrl.value = `${window.location.origin}/shared/${share.id}`;
	} catch (e: any) {
		resolveError.value = e?.data?.message ?? 'Failed to create share';
	}
}

async function copyUrl() {
	await navigator.clipboard.writeText(generatedUrl.value);
	copyLabel.value = 'Copied!';
	setTimeout(() => { copyLabel.value = 'Copy'; }, 2000);
}

function onHide() {
	isPublic.value = true;
	userInput.value = '';
	resolvedUser.value = null;
	resolveError.value = '';
	shareRole.value = 'View';
	generatedUrl.value = '';
	copyLabel.value = 'Copy';
}
</script>

<template>
	<Dialog v-model:visible="visible" header="Share note" modal :style="{ width: '26rem' }" @hide="onHide">
		<div class="flex flex-col gap-4">

			<div class="flex items-center justify-between">
				<span class="text-sm font-medium">Public link (anyone with the link)</span>
				<ToggleSwitch v-model="isPublic" />
			</div>

			<div v-if="!isPublic" class="flex flex-col gap-1">
				<label class="text-sm">Share with user</label>
				<InputText v-model="userInput" placeholder="Username or email" class="w-full" />
				<span v-if="resolvedUser" class="text-xs text-green-600">Found: {{ resolvedUser.username }}</span>
				<span v-else-if="resolveError" class="text-xs text-red-500">{{ resolveError }}</span>
			</div>

			<div class="flex flex-col gap-1">
				<label class="text-sm">Permission</label>
				<SelectButton v-model="shareRole" :options="roleOptions" :allow-empty="false" />
			</div>

			<Button label="Create share link" :disabled="!isPublic && !resolvedUser" @click="createShare" />

			<div v-if="generatedUrl" class="flex items-center gap-2 mt-1">
				<InputText :model-value="generatedUrl" readonly class="flex-1 text-xs" />
				<Button :label="copyLabel" size="small" severity="secondary" @click="copyUrl" />
			</div>

			<span v-if="!generatedUrl && resolveError && isPublic" class="text-xs text-red-500">{{ resolveError
				}}</span>
		</div>
	</Dialog>
</template>

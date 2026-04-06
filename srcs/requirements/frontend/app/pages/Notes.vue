<script setup lang="ts">
import { ref, computed, onMounted, onServerPrefetch } from "vue";
import { ref, computed, onMounted, onServerPrefetch } from "vue";
import Listbox from "@/volt/Listbox.vue";
import Button from "@/volt/Button.vue";
import Dialog from "@/volt/Dialog.vue";
import SidebarLayout from "@/components/layouts/SidebarLayout.vue";
import NoteEditor from "@/components/notes/NoteEditor.vue";
import { useConfirm } from "primevue/useconfirm";
import TimesIcon from "@primevue/icons/times";
import { useNoteStore } from "@/stores/noteStore";

const noteStore = useNoteStore();
const confirm = useConfirm();

const showInviteDialog = ref(false);
const inviteNoteId = ref<string | null>(null);
const selectedUsers = ref<string[]>([]);

// TODO: fetch from GET /api/users (returns [{ name: string, fullName: string }])
// TODO: fetch from GET /api/users (returns [{ name: string, fullName: string }])
const dummyUsers = [
	{ name: 'aydiler', fullName: 'Ahmet Diler' },
	{ name: 'catdev42', fullName: 'Masha Yakoven' },
{ name: 'gmullin', fullName: 'Grace Mullin' },
	{ name: 'maahoff', fullName: 'Maarten Hoff' },
	{ name: 'pvasilan', fullName: 'Pavlos Vasilantonakis' },
];

function openInvite(noteId: string) {
	inviteNoteId.value = noteId;
	selectedUsers.value = [];
	showInviteDialog.value = true;
}

function toggleUser(username: string) {
	const idx = selectedUsers.value.indexOf(username);
	if (idx === -1) {
		selectedUsers.value.push(username);
	} else {
		selectedUsers.value.splice(idx, 1);
	}
}

function sendInvite() {
	if (selectedUsers.value.length === 0 || !inviteNoteId.value) return;
	// TODO: POST /api/notes/:noteId/invite { usernames: string[] }
	// Expected response: 200 OK on success
	console.log(`Invite ${selectedUsers.value.join(', ')} to note ${inviteNoteId.value}`);
	selectedUsers.value = [];
	showInviteDialog.value = false;
	inviteNoteId.value = null;
}

// Shared notes selection (separate from own notes)
const selectedSharedNote = ref<any>(null);

// When selecting in one list, deselect the other
function selectOwnNote(note: any) {
	noteStore.selectedNote = note;
	selectedSharedNote.value = null;
}

function selectSharedNote(note: any) {
	selectedSharedNote.value = note;
	noteStore.selectedNote = null;
}

const activeNote = computed(() => noteStore.selectedNote || selectedSharedNote.value);

const showInviteDialog = ref(false);
const inviteNoteId = ref<string | null>(null);
const inviteUsername = ref("");

function openInvite(noteId: string) {
	inviteNoteId.value = noteId;
	selectedUsers.value = [];
	showInviteDialog.value = true;
}

function toggleUser(username: string) {
	const idx = selectedUsers.value.indexOf(username);
	if (idx === -1) {
		selectedUsers.value.push(username);
	} else {
		selectedUsers.value.splice(idx, 1);
	}
}

function sendInvite() {
	if (selectedUsers.value.length === 0 || !inviteNoteId.value) return;
	// TODO: call backend invite endpoint
	console.log(`Invite ${selectedUsers.value.join(', ')} to note ${inviteNoteId.value}`);
	selectedUsers.value = [];
	showInviteDialog.value = false;
	inviteNoteId.value = null;
}

// Shared notes selection (separate from own notes)
const selectedSharedNote = ref<any>(null);

// When selecting in one list, deselect the other
function selectOwnNote(note: any) {
	noteStore.selectedNote = note;
	selectedSharedNote.value = null;
}

function selectSharedNote(note: any) {
	selectedSharedNote.value = note;
	noteStore.selectedNote = null;
}

const activeNote = computed(() => noteStore.selectedNote || selectedSharedNote.value);

// SSR guard — NoteEditor creates WebSocket in setup, which crashes Node
const mounted = ref(false);
onMounted(() => { mounted.value = true; });

async function handleCreate() {
	await noteStore.createNote();
}

function confirmDelete(id: string) {
	confirm.require({
		message: 'Are you sure you want to delete this note?',
		header: 'Confirm Deletion',
		icon: 'pi pi-trash',
		acceptProps: {
			label: 'Delete',
			severity: 'danger'
		},
		rejectProps: {
			label: 'Cancel',
			severity: 'secondary'
		},
		accept: () => {
			noteStore.deleteNote(id);
		}
	});
}

onMounted(() => {
	if (noteStore.notesCount === 0) {
		noteStore.fetchNotes().then(() => {
			if (noteStore.error === 'HTTP 401') {
				navigateTo('/login');
			}
		});
	}
});

onServerPrefetch(async () => {
	const headers = useRequestHeaders(['cookie']);
	const serverCookie = headers.cookie;

	if (noteStore.notesCount === 0) {
		await noteStore.fetchNotes();
		if (noteStore.error === 'HTTP 401') {
			await navigateTo('/login');
		}
	}
});
</script>

<template>
	<SidebarLayout>
		<template #sidebar>
			<div class="flex items-center justify-between mb-1 px-2">
				<h2 class="section-title !mb-0">Notes</h2>
				<Button label="+" text rounded @click="handleCreate" />
			</div>
			<p v-if="noteStore.error" class="error-text">{{ noteStore.error }}</p>
			<div v-if="noteStore.isLoading" class="text-center text-gray-500">
				Loading notes...
			</div>
			<Listbox v-else :model-value="noteStore.selectedNote" @update:model-value="selectOwnNote"
				:options="noteStore.notes" optionLabel="title" dataKey="id"
				pt:root:class="!border-0 !shadow-none !bg-transparent"
				pt:list:class="!p-0 !gap-0.5" pt:listContainer:class="!overflow-visible !max-h-none"
				pt:option:class="!px-2 !py-1.5 !rounded-md">
				<template #option="slotProps">
					<div class="flex items-center justify-between w-full group/item gap-1">
						<span class="truncate text-sm">{{ slotProps.option.title || "Untitled" }}</span>
						<div class="flex items-center shrink-0"
							:class="noteStore.selectedNote?.id === slotProps.option.id ? '' : 'opacity-0 group-hover/item:opacity-100 transition-opacity'">
							<button
								class="w-6 h-6 rounded-full flex items-center justify-center transition-colors"
								:class="noteStore.selectedNote?.id === slotProps.option.id
									? 'text-white hover:bg-white/20'
									: 'text-surface-400 hover:text-surface-0 hover:bg-surface-600'"
								@click.stop="openInvite(slotProps.option.id)">
								<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-3.5 h-3.5">
									<path d="M11 5a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM2.046 15.253c-.058.468.172.92.57 1.175A9.953 9.953 0 0 0 8 18c1.982 0 3.83-.578 5.384-1.573.398-.254.628-.707.57-1.175a6.001 6.001 0 0 0-11.908 0ZM15.75 8.5a.75.75 0 0 0-1.5 0v2h-2a.75.75 0 0 0 0 1.5h2v2a.75.75 0 0 0 1.5 0v-2h2a.75.75 0 0 0 0-1.5h-2v-2Z" />
								</svg>
							</button>
							<button
								class="w-6 h-6 rounded-full flex items-center justify-center transition-colors"
								:class="noteStore.selectedNote?.id === slotProps.option.id
									? 'text-white hover:text-red-300 hover:bg-white/20'
									: 'text-surface-400 hover:text-red-400 hover:bg-surface-600'"
								@click.stop="confirmDelete(slotProps.option.id)">
								<TimesIcon class="w-2.5 h-2.5" />
							</button>
						</div>
					</div>
				</template>
			</Listbox>

			<!-- TODO: fetch from GET /api/notes/shared (returns same shape as GET /api/notes) -->
			<div class="flex items-center justify-between mt-4 mb-1 px-2">
				<h2 class="section-title !mb-0">Shared with me</h2>
			</div>
			<Listbox v-if="!noteStore.isLoading" :model-value="selectedSharedNote" @update:model-value="selectSharedNote"
				:options="noteStore.notes" optionLabel="title" dataKey="id"
				pt:root:class="!border-0 !shadow-none !bg-transparent"
				pt:list:class="!p-0 !gap-0.5" pt:listContainer:class="!overflow-visible !max-h-none"
				pt:option:class="!px-2 !py-1.5 !rounded-md">
				<template #option="slotProps">
					<span class="truncate text-sm">{{ slotProps.option.title || "Untitled" }}</span>
				</template>
			</Listbox>

		</template>

		<NoteEditor
			v-if="mounted && activeNote"
			:note-id="activeNote.id"
		/>
		<div v-else-if="!noteStore.isLoading && !activeNote" class="empty-state">Select a note</div>

		<Dialog v-model:visible="showInviteDialog" header="Invite to collaborate" modal :draggable="false"
			pt:root:class="w-full max-w-sm">
		<Dialog v-model:visible="showInviteDialog" header="Invite to collaborate" modal :draggable="false"
			pt:root:class="w-full max-w-sm">
			<div class="flex flex-col gap-3">
				<div v-if="selectedUsers.length" class="flex flex-wrap gap-1.5">
					<span v-for="user in selectedUsers" :key="user"
						class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-primary-500/15 text-primary-400">
						{{ user }}
						<button class="hover:text-primary-300" @click="toggleUser(user)">
							<TimesIcon class="w-2 h-2" />
						</button>
					</span>
				</div>
				<label class="text-sm text-surface-500">Select users to invite</label>
				<div class="flex flex-col rounded-md border border-surface-700 overflow-hidden">
					<button v-for="user in dummyUsers" :key="user.name"
						class="flex items-center gap-3 px-3 py-2 text-sm text-left transition-colors"
						:class="selectedUsers.includes(user.name)
							? 'bg-primary-500/15 text-primary-400'
							: 'hover:bg-surface-800 text-surface-300'"
						@click="toggleUser(user.name)">
						<span class="w-7 h-7 rounded-full bg-surface-600 flex items-center justify-center text-xs font-medium text-surface-200 shrink-0">
							{{ user.name[0].toUpperCase() }}
						</span>
						<div class="min-w-0">
							<div class="truncate">{{ user.fullName }}</div>
							<div class="text-xs text-surface-500 truncate">@{{ user.name }}</div>
						</div>
					</button>
				</div>
				<div v-if="selectedUsers.length" class="flex flex-wrap gap-1.5">
					<span v-for="user in selectedUsers" :key="user"
						class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-primary-500/15 text-primary-400">
						{{ user }}
						<button class="hover:text-primary-300" @click="toggleUser(user)">
							<TimesIcon class="w-2 h-2" />
						</button>
					</span>
				</div>
				<label class="text-sm text-surface-500">Select users to invite</label>
				<div class="flex flex-col rounded-md border border-surface-700 overflow-hidden">
					<button v-for="user in dummyUsers" :key="user.name"
						class="flex items-center gap-3 px-3 py-2 text-sm text-left transition-colors"
						:class="selectedUsers.includes(user.name)
							? 'bg-primary-500/15 text-primary-400'
							: 'hover:bg-surface-800 text-surface-300'"
						@click="toggleUser(user.name)">
						<span class="w-7 h-7 rounded-full bg-surface-600 flex items-center justify-center text-xs font-medium text-surface-200 shrink-0">
							{{ user.name[0].toUpperCase() }}
						</span>
						<div class="min-w-0">
							<div class="truncate">{{ user.fullName }}</div>
							<div class="text-xs text-surface-500 truncate">@{{ user.name }}</div>
						</div>
					</button>
				</div>
			</div>
			<template #footer>
				<Button label="Send Invite" :disabled="selectedUsers.length === 0" @click="sendInvite" />
			</template>
		</Dialog>
	</SidebarLayout>
</template>

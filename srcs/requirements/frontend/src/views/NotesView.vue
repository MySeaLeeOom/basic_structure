<script setup lang="ts">
import { ref, onMounted, onServerPrefetch } from "vue";
import Listbox from "@/volt/Listbox.vue";
import Button from "@/volt/Button.vue";
import SidebarLayout from "@/components/layouts/SidebarLayout.vue";
import NoteEditor from "@/components/notes/NoteEditor.vue";
import { useConfirm } from "primevue/useconfirm";
import TimesIcon from "@primevue/icons/times";
import { useNoteStore } from "@/stores/noteStore";

const noteStore = useNoteStore();
const confirm = useConfirm();

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
	if (noteStore.notesCount === 0)
		noteStore.fetchNotes();
});

onServerPrefetch(async () => {
	if (noteStore.notesCount === 0)
		await noteStore.fetchNotes();
});
</script>

<template>
	<SidebarLayout>
		<template #sidebar>
			<div class="flex items-center justify-between mb-4">
				<h2 class="section-title !mb-0">Notes</h2>
				<Button label="+" text rounded @click="handleCreate" />
			</div>
			<p v-if="noteStore.error" class="error-text">{{ noteStore.error }}</p>
			<div v-if="noteStore.isLoading" class="text-center text-gray-500">
				Loading notes...
			</div>
			<Listbox v-else v-model="noteStore.selectedNote" :options="noteStore.notes" optionLabel="title" dataKey="id">
				<template #option="slotProps">
					<div class="flex items-center justify-between w-full group/item">
						<span>{{ slotProps.option.title || "Untitled" }}</span>
						<Button severity="danger" text rounded size="small"
							class="opacity-0 group-hover/item:opacity-100 transition-opacity"
							@click.stop="confirmDelete(slotProps.option.id)">
							<TimesIcon class="w-2.5 h-2.5" />
						</Button>
					</div>
				</template>
			</Listbox>
		</template>

		<NoteEditor
			v-if="mounted && noteStore.selectedNote"
			:note-id="noteStore.selectedNote.id"
		/>
		<div v-else-if="!noteStore.isLoading && !noteStore.selectedNote" class="empty-state">Select a note</div>
	</SidebarLayout>
</template>

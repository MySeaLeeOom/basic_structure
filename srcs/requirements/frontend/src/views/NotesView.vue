<script setup lang="ts">
import { ref, onMounted, computed, onServerPrefetch } from "vue";
import Listbox from "@/volt/Listbox.vue";
import Button from "@/volt/Button.vue";
import SidebarLayout from "@/components/layouts/SidebarLayout.vue";
import NoteCreateForm from "@/components/notes/NoteCreateForm.vue";
import NoteDisplay from "@/components/notes/NoteDisplay.vue";

// Previous implementation using composable
// import { useNotes } from "@/composables/useNotes";
// const { notes, selectedNote, error, fetchNotes, createNote } = useNotes();

// New implementation using Pinia store
import { useNoteStore } from "@/stores/noteStore";

// Create store instance
const noteStore = useNoteStore();

// Ref to control create form visibility
const showCreateForm = ref(false);

// Function to handle note creation
async function handleCreate(title: string, content: string) {
	// Use store's create note method
	await noteStore.createNote(title, content);
	// Close create form
	showCreateForm.value = false;
}

// Function to cancel note creation
function handleCancel() {
	showCreateForm.value = false;
}

// onServerPrefetch

// Fetch notes when component mounts
onMounted(() => {
	// Use store's fetch notes method if the notes are not fetched
	if (noteStore.notesCount === 0)
		noteStore.fetchNotes();
});

// Fetch notes during server-side rendering for /notes route
onServerPrefetch(async () => {
	console.log("PREFETCHING")
	if (noteStore.notesCount === 0)
		await noteStore.fetchNotes();
});
</script>

<template>
	<SidebarLayout>
		<template #sidebar>
			<div class="flex items-center justify-between mb-4">
				<h2 class="section-title !mb-0">Notes</h2>
				<Button v-if="!showCreateForm" label="+" text rounded @click="showCreateForm = true"></button>
			</div>

			<!-- <p v-if="error" class="error-text">{{ error }}</p>
			<Listbox v-model="selectedNote" :options="notes" optionLabel="title" dataKey="id" /> -->
			<!-- Display error from store if exists -->
			<p v-if="noteStore.error" class="error-text">{{ noteStore.error }}</p>
			<!-- Loading state -->
			<div v-if="noteStore.isLoading" class="text-center text-gray-500">
				Loading notes...
			</div>
			<!-- Listbox using store's notes and selected note -->
			<Listbox v-else v-model="noteStore.selectedNote" :options="noteStore.notes" optionLabel="title" dataKey="id" />
		</template>

		<div class="document-container">
			<NoteCreateForm v-if="showCreateForm" @create="handleCreate" @cancel="handleCancel" />
			<NoteDisplay v-else-if="noteStore.selectedNote" :note="noteStore.selectedNote" />
			<div v-else-if="!noteStore.isLoading" class="empty-state">Select a note</div>
		</div>
	</SidebarLayout>
</template>

<!-- 
TODO:
- edit note functionality (so we can update a note, depends on backend call to update)
- when we select note, we can choose the edit view or Markdown preview view or both
- maybe: some functionality for if you are writing a note but select a note to view without saving... popup where you can save/discard the current note you are working on
-->

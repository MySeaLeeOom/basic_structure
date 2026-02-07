<script setup lang="ts">
import { ref, onMounted, computed, onServerPrefetch } from "vue";
import Listbox from "@/volt/Listbox.vue";
import Button from "@/volt/Button.vue";
import SidebarLayout from "@/components/layouts/SidebarLayout.vue";
import NoteCreateForm from "@/components/notes/NoteCreateForm.vue";
import NoteEdit from "@/components/notes/NoteEdit.vue";
import NoteDisplay from "@/components/notes/NoteDisplay.vue";

import { useNoteStore } from "@/stores/noteStore";

// Create store instance
const noteStore = useNoteStore();

// Ref to control create form visibility
const showEditForm = ref(false);

// // Function to handle note creation
// async function handleCreate(title: string, content: string) {
// 	// Use store's create note method
// 	await noteStore.createNote(title, content);
// 	// Close create form
// 	showEditForm.value = false;
// }


// Function to cancel note creation
function handleCancel() {
	showEditForm.value = false;
	noteStore.selectedNote = null;
	//for now, unselect note ? TODO:check
	// noteStore.selectedNote = null;
}

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
		<!-- THE SIDEBAR -->
		<template #sidebar>
			<!-- + BUTTON for new note edit -->
			<div class="flex items-center justify-between mb-4">
				<h2 class="section-title !mb-0">Notes</h2>
				<!-- TODO - maybe make a function for the click instead of commands inline -->
				<Button label="+" text rounded @click="showEditForm = true; noteStore.selectedNote = null"></button>
			</div>
			<!-- IF ERROR -->
			<p v-if="noteStore.error" class="error-text">{{ noteStore.error }}</p>
			<!-- IF LOADING -->
			<div v-if="noteStore.isLoading" class="text-center text-gray-500">
				Loading notes...
			</div>
			<!-- NOTES LIST listbox using pinia notesStore and selected note -->
			<Listbox v-else v-model="noteStore.selectedNote" :options="noteStore.notes" optionLabel="title" dataKey="id" />
		</template>

		<!-- <div class="document-container"> -->
			<!-- creation only -->
			<!-- <NoteCreateForm v-if="showCreateForm" @create="handleSave" @cancel="handleCancel" /> -->

			<!-- EDIT NOTE -->
			<NoteEdit v-if="noteStore.selectedNote || showEditForm" @cancel="handleCancel" :note="noteStore.selectedNote"/>
			<!-- PREVIEW -->
			<NoteDisplay v-if="noteStore.selectedNote" :note="noteStore.selectedNote" />
			<!-- IT NO NOTE SELECTED -->
			<div v-else-if="!noteStore.isLoading && !showEditForm  && !noteStore.selectedNote" class="empty-state">Select a note</div>
		<!-- </div> -->
	</SidebarLayout>
</template>

<!-- 
TODO:
- edit note functionality (so we can update a note, depends on backend call to update)
- when we select note, we can choose the edit view or Markdown preview view or both
- maybe: some functionality for if you are writing a note but select a note to view without saving... popup where you can save/discard the current note you are working on
-->

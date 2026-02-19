import { defineStore } from "pinia";
import { ref, computed, watch } from "vue";
import { useNoteStore } from "./noteStore";
import type { Note } from "@/types";

// computed, watch

// storage for the current note being edited

export const useEditStore = defineStore("editLive", () => {
	const noteStore = useNoteStore();
	const draftTitle = ref("");
	const draftContent = ref("");
	const draftId = ref<number | null>(null);

	// KEEP TRACK OF selectedNote
	watch(() => noteStore.selectedNote, (newNote) => {
		draftTitle.value = newNote?.title || "";
		draftContent.value = newNote?.content || "";
		draftId.value = newNote?.id || null;
	}, { immediate: true });

	// WAS IT CHANGED
	const isDirty = computed(() => {
		return draftTitle.value !== noteStore.selectedNote?.title || draftContent.value !== noteStore.selectedNote?.content;
	});

	// THE SAVE FUNCTION DURING EDIT
	async function save() {
		await noteStore.editNote(draftId.value, draftTitle.value, draftContent.value);
		if (draftId.value === null && noteStore.selectedNote) {
			draftId.value = noteStore.selectedNote.id;
		}
	}

	// WHEN CANCEL IS CLICKED, NO EDIT WINDOW
	function reset() {
		draftTitle.value = noteStore.selectedNote?.title || "";
		draftContent.value = noteStore.selectedNote?.content || "";
		draftId.value = noteStore.selectedNote?.id || null;
	}

	return { draftTitle, draftContent, draftId, isDirty, save, reset };
});

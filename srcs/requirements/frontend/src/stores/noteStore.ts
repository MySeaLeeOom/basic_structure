import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type { Note } from "@/types";

export const useNoteStore = defineStore("notes", () => {
	const notes = ref<Note[]>([]);
	const selectedNote = ref<Note | null>(null);
	const error = ref<string | null>(null);
	const isLoading = ref(false);

	// Cache to prevent unnecessary refetches
	const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
	const lastFetchTimestamp = ref(0);

	async function fetchNotes() {
		// Prevent redundant fetches
		const currentTime = Date.now();
		if (notes.value.length && currentTime - lastFetchTimestamp.value < CACHE_DURATION) {
			return;
		}

		error.value = null;
		isLoading.value = true;

		try {
			// On the server, we MUST use the full internal Docker URL.
			// On the client, we use a relative URL (which goes through the Nginx).
			const isServer = typeof window === "undefined";
			const url = isServer ? "http://notes:3003/api/notes" : "/api/notes";

			const response = await fetch(url, {
				signal: AbortSignal.timeout(5000), // Prevent hanging
			});

			if (!response.ok) throw new Error(`HTTP ${response.status}`);

			const fetchedNotes = await response.json();
			notes.value = fetchedNotes;

			// Auto-select first note if none selected (we cancel this, we will have a new empty note on load)
			// if (!selectedNote.value && notes.value.length) {
			// 	selectedNote.value = notes.value[0]!;
			// }

			// Update fetch timestamp
			lastFetchTimestamp.value = currentTime;
		} catch (catchError) {
			const errorMsg = catchError instanceof Error ? (catchError.name === "AbortError" ? "Request timed out" : catchError.message) : "Load failed";

			error.value = errorMsg;
			console.error("Failed to fetch notes:", errorMsg);
		} finally {
			isLoading.value = false;
		}
	}

	async function createNote() {
		error.value = null;
		isLoading.value = true;
		try {
			const response = await fetch("/api/notes", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({}),
			});

			if (!response.ok) throw new Error(`HTTP ${response.status}`);

			const note: Note = await response.json();
			notes.value.push(note);
			selectedNote.value = note;
		} catch (catchError) {
			const errorMsg = catchError instanceof Error ? catchError.message : "Create failed";
			error.value = errorMsg;
			console.error("Failed to create note:", errorMsg);
		} finally {
			isLoading.value = false;
		}
	}

	async function deleteNote(id: string) {
		error.value = null;
		isLoading.value = true;
		try {
			const response = await fetch(`/api/notes/${id}`, {
				method: "DELETE",
			});

			if (!response.ok) throw new Error(`HTTP ${response.status}`);

			notes.value = notes.value.filter((n) => n.id !== id);
			if (selectedNote.value?.id === id) {
				selectedNote.value = null;
			}
		} catch (catchError) {
			const errorMsg = catchError instanceof Error ? catchError.message : "Delete failed";
			error.value = errorMsg;
			console.error("Failed to delete note:", errorMsg);
		} finally {
			isLoading.value = false;
		}
	}

	const notesCount = computed(() => notes.value.length);

	function resetSelected() {
		selectedNote.value = null;
	}

	return {
		notes,
		selectedNote,
		error,
		isLoading,
		notesCount,
		fetchNotes,
		createNote,
		deleteNote,
		resetSelected,
	};
});

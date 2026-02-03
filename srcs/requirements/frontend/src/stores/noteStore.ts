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
			// On the client, we use a relative URL (which goes through the Gateway/Nginx).
			const isServer = typeof window === "undefined";
			const url = isServer ? "http://notes:8000/api/notes" : "/api/notes";

			const response = await fetch(url, {
				signal: AbortSignal.timeout(5000), // Prevent hanging
			});

			if (!response.ok) throw new Error(`HTTP ${response.status}`);

			const fetchedNotes = await response.json();
			notes.value = fetchedNotes;

			// Auto-select first note if none selected
			if (!selectedNote.value && notes.value.length) {
				selectedNote.value = notes.value[0]!;
			}

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

	async function createNote(title: string, content: string) {
		try {
			const response = await fetch("/api/notes", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ title: title.trim(), content }),
			});

			if (!response.ok) throw new Error(`HTTP ${response.status}`);

			const note: Note = await response.json();
			notes.value.push(note);
			selectedNote.value = note;
		} catch (catchError) {
			const errorMsg = catchError instanceof Error ? catchError.message : "Create failed";
			error.value = errorMsg;
			console.error("Failed to create note:", errorMsg);
		}
	}

	// Computed properties for easy access and potential RAG integration
	const notesCount = computed(() => notes.value.length);
	const getNoteTitles = computed(() => notes.value.map((note) => note.title));

	// Method to search notes (useful for RAG)
	function searchNotes(query: string) {
		const lowercaseQuery = query.toLowerCase();
		return notes.value.filter((note) => note.title.toLowerCase().includes(lowercaseQuery) || note.content.toLowerCase().includes(lowercaseQuery));
	}

	return {
		notes,
		selectedNote,
		error,
		isLoading,
		notesCount,
		getNoteTitles,
		fetchNotes,
		createNote,
		searchNotes,
	};
});

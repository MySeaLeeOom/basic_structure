import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { useDebounceFn } from "@vueuse/core";
import type { Note } from "@/types";
import { useAuthStore } from "@/stores/authStore";

export const useNoteStore = defineStore("notes", () => {
	const authStore = useAuthStore();
	const notes = ref<Note[]>([]);
	const selectedNote = ref<Note | null>(null);
	const error = ref<string | null>(null);
	const isLoading = ref(false);

	// Cache to prevent unnecessary refetches
	const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes
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
			// Ensure we have user profile before fetching notes.
			// The Auth store handles internal magic to capture the cookie
			if (!authStore.user) {
				await authStore.checkAuth();
				if (!authStore.user) {
					isLoading.value = false;
					return;
				}
			}

			// On the server, we MUST use the full internal Docker URL.
			const isServer = typeof window === "undefined";
			const url = isServer ? "https://nginx:443/api/notes" : "/api/notes";

			const headers: HeadersInit = {};
			const userCookie = authStore.sessionCookie;

			if (isServer && userCookie) {
				headers["Cookie"] = userCookie;
			}

			const response = await fetch(url, {
				method: "GET",
				headers,
				signal: AbortSignal.timeout(5000), // Prevent hanging
			});

			if (!response.ok) throw new Error(`HTTP ${response.status}`);

			const fetchedNotes = await response.json();
			notes.value = fetchedNotes;

			// Auto-select first note if none selected (we cancel this, we will have a new empty note on load?)
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
		// isLoading.value = true;
		try {
			const response = await fetch("/api/notes", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ title: "Untitled" }),
			});

			if (response.status === 401) {
				error.value = "Unauthorized: user not logged in.";
				console.error("Unauthorized:", response.status);
				return;
			}

			//for any other errors
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

			notes.value = notes.value.filter((n: Note) => n.id !== id);
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

	// Debounced save to Postgres — temporary until WS notification channel
	const _persistTitle = useDebounceFn(async (id: string, title: string) => {
		try {
			await fetch(`/api/notes/${id}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ title }),
			});
		} catch (e) {
			console.error("Failed to persist title:", e);
		}
	}, 500);

	function updateNoteTitle(id: string, title: string) {
		const note = notes.value.find((n: Note) => n.id === id);
		if (note) {
			note.title = title;
		}
		if (selectedNote.value?.id === id) {
			selectedNote.value = { ...selectedNote.value, title };
		}
		_persistTitle(id, title);
	}

	function resetSelected() {
		selectedNote.value = null;
	}

	function resetStore() {
		notes.value = [];
		selectedNote.value = null;
		error.value = null;
		isLoading.value = false;
		lastFetchTimestamp.value = 0;
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
		updateNoteTitle,
		resetStore,
	};
});

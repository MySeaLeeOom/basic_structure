import { ref } from 'vue';
import type { Note } from '@/data/notes';

export function useNotes() {
  const notes = ref<Note[]>([]);
  const selectedNote = ref<Note | null>(null);
  const error = ref<string | null>(null);

  async function fetchNotes() {
    error.value = null;
    try {
      const res = await fetch('/api/notes');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      notes.value = await res.json();
      if (!selectedNote.value && notes.value.length) {
        selectedNote.value = notes.value[0]!;
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Load failed';
    }
  }

  async function createNote(title: string, content: string) {
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), content }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const note: Note = await res.json();
      notes.value.push(note);
      selectedNote.value = note;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Create failed';
    }
  }

  return {
    notes,
    selectedNote,
    error,
    fetchNotes,
    createNote,
  };
}

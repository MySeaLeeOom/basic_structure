# Notes API Integration

**Date:** 2026-02-01
**Branch:** `vue-notes-view`

## Summary

Replaced static `placeholderNotes` with real API calls to `/api/notes`.

## Changes

| File | Change |
|------|--------|
| `src/views/NotesView.vue` | Added fetch, loading/error states, auto-select first note |
| `src/data/notes.ts` | Removed `placeholderNotes`, kept `Note` interface |

## States

- **Loading:** 3x Skeleton placeholders
- **Error:** Red message + Retry button
- **Success:** Listbox with notes

## Verified

- [x] Notes load from API on mount
- [x] First note auto-selects
- [x] Error state with retry works
- [x] Data persists across refresh

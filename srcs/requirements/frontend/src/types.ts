export interface Note {
  id: string;                    // UUID from backend
  title_preview: string | null;  // nullable — new notes have no title
  content_preview: string | null; // nullable — new notes have no content
  created_at: string;            // ISO 8601 datetime
  updated_at: string;            // ISO 8601 datetime
}

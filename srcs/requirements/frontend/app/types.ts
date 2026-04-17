export interface Note {
  id: string;
  title: string;
  owner_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SharedNote {
  share_id: string;
  note_id: string;
  note_title: string;
  access_role: string;
  owner_id: string;
  created_at: string;
}

export interface Collaborator {
  share_id: string;
  guest_id: string | null;
  access_role: string;
  created_at: string;
}

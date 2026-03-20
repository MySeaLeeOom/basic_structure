-- the container - managed by notes.
CREATE TABLE IF NOT EXISTS notes (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	title VARCHAR(255) NOT NULL DEFAULT 'Untitled', -- for simplicity here for now :)
	owner_id UUID, -- more logic when we combine with auth
	-- user_ids UUID[]
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- the content - managed by editor.
CREATE TABLE IF NOT EXISTS note_states (
	note_id UUID PRIMARY KEY REFERENCES notes(id) ON DELETE CASCADE,
	state_vector BYTEA NOT NULL,
	last_saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
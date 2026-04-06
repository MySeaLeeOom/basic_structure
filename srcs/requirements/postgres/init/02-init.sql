-- the container - managed by notes.
CREATE TABLE IF NOT EXISTS notes (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	title VARCHAR(255) NOT NULL DEFAULT 'Untitled', -- for simplicity here for now :)
	owner_id UUID, -- more logic when we combine with auth
	owner_url VARCHAR(255),
	-- user_ids UUID[]
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- table for managing shares - shared with users or public
CREATE TABLE IF NOT EXISTS share (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
	guest_id UUID,
	role VARCHAR(50) NOT NULL DEFAULT 'View',
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	CONSTRAINT unique_share UNIQUE NULLS NOT DISTINCT (note_id, guest_id)
);

-- the content - managed by editor.
CREATE TABLE IF NOT EXISTS note_states (
	note_id UUID PRIMARY KEY REFERENCES notes(id) ON DELETE CASCADE,
	state_vector BYTEA NOT NULL,
	last_saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
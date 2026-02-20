CREATE TABLE IF NOT EXISTS notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- CRDT document state (binary encoded)
    doc_state BYTEA NOT NULL,
    
    -- Metadata (non-CRDT, server-authoritative)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    owner_id UUID,  -- for future auth integration
    
    -- Optional: denormalized fields for querying
    title_preview VARCHAR(255),
    content_preview TEXT
);
CREATE TABLE note_updates (
    id BIGSERIAL PRIMARY KEY,
    note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    update_data BYTEA NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    client_id UUID,  -- which client sent this update
    
    INDEX idx_note_updates_note_id_created (note_id, created_at)
);

-- Track client sync state
CREATE TABLE client_sync_state (
    client_id UUID NOT NULL,
    note_id UUID NOT NULL,
    last_update_id BIGINT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    PRIMARY KEY (client_id, note_id)
);
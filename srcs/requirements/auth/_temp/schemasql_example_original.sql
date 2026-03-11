
-- 1. USERS TABLE (The Identity)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) NOT NULL,
    provider VARCHAR(50) NOT NULL,        -- 'github' or 'local'
    provider_id VARCHAR(255) UNIQUE,      -- The unique ID from GitHub
    role VARCHAR(50) DEFAULT 'user',      -- 'user' | 'admin'
    status VARCHAR(50) DEFAULT 'active',  -- 'active' | 'blocked' | 'suspended'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. SESSIONS TABLE (The Temporary Tickets)
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), 
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL,
    user_agent TEXT,
    ip_address VARCHAR(45),
    expires_at TIMESTAMP NOT NULL
);

-- Index for speed (Fastify will query by session ID constantly)
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);

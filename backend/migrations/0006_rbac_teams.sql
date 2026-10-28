-- Migration: 0006_rbac_teams.sql
-- Role-Based Access Control (RBAC) and Multi-User Teams

CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL DEFAULT 'pbkdf2:demo',
    role VARCHAR(30) NOT NULL DEFAULT 'ENGINEER',
    avatar_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_users_team_id ON users(team_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Seed default enterprise organization
INSERT INTO teams (id, name, slug)
VALUES ('00000000-0000-0000-0000-000000000001', 'ResPulse Enterprise Ops', 'respulse-enterprise')
ON CONFLICT (slug) DO NOTHING;

-- Seed default multi-role team members for immediate RBAC evaluation
INSERT INTO users (id, team_id, email, name, role, avatar_url, last_login_at)
VALUES 
    ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001', 'alice@respulse.internal', 'Alice Vance', 'OWNER', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150', NOW()),
    ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000001', 'bob@respulse.internal', 'Bob Chen', 'ADMIN', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', NOW()),
    ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000001', 'charlie@respulse.internal', 'Charlie Davis', 'ENGINEER', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150', NOW()),
    ('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000001', 'dana@respulse.internal', 'Dana Scully', 'VIEWER', 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150', NOW())
ON CONFLICT (email) DO NOTHING;

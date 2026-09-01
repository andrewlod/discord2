-- Migration: 003_friends_public_invites.sql
-- Add friend system, public server discovery, and server invite support.

-- Make servers discoverable in the Explore tab.
ALTER TABLE servers ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE;

-- Existing servers become discoverable so the Explore tab is useful immediately.
UPDATE servers SET is_public = TRUE WHERE is_public IS FALSE;

-- Friendships: user_id is the requester, friend_id is the recipient.
CREATE TABLE IF NOT EXISTS friendships (
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    friend_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status     VARCHAR(16) NOT NULL DEFAULT 'pending', -- 'pending' | 'accepted'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, friend_id)
);

-- Ensure only one relationship row exists per unordered pair.
CREATE UNIQUE INDEX IF NOT EXISTS idx_friendships_pair
    ON friendships (LEAST(user_id, friend_id), GREATEST(user_id, friend_id));

CREATE INDEX IF NOT EXISTS idx_friendships_friend ON friendships(friend_id);

-- Track invite usage details.
ALTER TABLE invites ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE;

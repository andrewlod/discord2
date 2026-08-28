-- Migration: 002_dm_messages.sql
-- Allow messages to belong to a DM channel (dm_channels) in addition to a
-- guild channel (channels). The original schema only referenced channels.
-- Statements are idempotent so the migration can be re-run safely.

ALTER TABLE messages ALTER COLUMN channel_id DROP NOT NULL;

ALTER TABLE messages ADD COLUMN IF NOT EXISTS dm_channel_id UUID REFERENCES dm_channels(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_messages_dm_channel ON messages(dm_channel_id, created_at DESC);

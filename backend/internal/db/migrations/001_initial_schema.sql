-- Migration: 001_initial_schema.sql
-- Create all core tables for Discord 2

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(32) UNIQUE NOT NULL,
    display_name VARCHAR(64),
    avatar_url TEXT,
    password_hash TEXT,
    google_id VARCHAR(255) UNIQUE,
    email_verified BOOLEAN DEFAULT FALSE,
    status VARCHAR(16) DEFAULT 'online',
    custom_status TEXT,
    video_quality VARCHAR(16) DEFAULT '720p',
    preferred_camera VARCHAR(255),
    preferred_microphone VARCHAR(255),
    preferred_speaker VARCHAR(255),
    noise_suppression BOOLEAN DEFAULT TRUE,
    echo_cancellation BOOLEAN DEFAULT TRUE,
    auto_gain_control BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_google_id ON users(google_id);

-- servers (guilds)
CREATE TABLE servers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon_url TEXT,
    banner_url TEXT,
    owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
    verification_level INT DEFAULT 0,
    default_notifications INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_servers_owner ON servers(owner_id);

-- server_members
CREATE TABLE server_members (
    server_id UUID REFERENCES servers(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    nickname VARCHAR(32),
    roles UUID[] DEFAULT '{}',
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (server_id, user_id)
);

CREATE INDEX idx_server_members_user ON server_members(user_id);

-- channels
CREATE TABLE channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    server_id UUID REFERENCES servers(id) ON DELETE CASCADE,
    type INT NOT NULL DEFAULT 0,
    name VARCHAR(100) NOT NULL,
    topic TEXT,
    position INT DEFAULT 0,
    parent_id UUID REFERENCES channels(id) ON DELETE SET NULL,
    nsfw BOOLEAN DEFAULT FALSE,
    rate_limit_per_user INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_channels_server ON channels(server_id);
CREATE INDEX idx_channels_parent ON channels(parent_id);

-- channel_permissions (overwrites)
CREATE TABLE channel_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
    target_type INT NOT NULL,
    target_id UUID NOT NULL,
    allow BIGINT DEFAULT 0,
    deny BIGINT DEFAULT 0
);

CREATE INDEX idx_channel_permissions_channel ON channel_permissions(channel_id);

-- messages
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
    author_id UUID REFERENCES users(id) ON DELETE SET NULL,
    content TEXT NOT NULL DEFAULT '',
    edited_at TIMESTAMPTZ,
    type INT DEFAULT 0,
    reference_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
    channel_type INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_channel_created ON messages(channel_id, created_at DESC);
CREATE INDEX idx_messages_author ON messages(author_id);
CREATE INDEX idx_messages_reference ON messages(reference_message_id);

-- message_attachments
CREATE TABLE message_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    size_bytes BIGINT NOT NULL,
    content_type VARCHAR(100),
    width INT,
    height INT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_message_attachments_message ON message_attachments(message_id);

-- message_reactions
CREATE TABLE message_reactions (
    message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    emoji VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (message_id, user_id, emoji)
);

CREATE INDEX idx_message_reactions_message ON message_reactions(message_id);

-- direct_message_channels (DMs + Group DMs)
CREATE TABLE dm_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type INT NOT NULL DEFAULT 3,
    name VARCHAR(100),
    icon_url TEXT,
    owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- dm_participants
CREATE TABLE dm_participants (
    dm_channel_id UUID REFERENCES dm_channels(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (dm_channel_id, user_id)
);

CREATE INDEX idx_dm_participants_user ON dm_participants(user_id);

-- roles
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    server_id UUID REFERENCES servers(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    color INT DEFAULT 0,
    permissions BIGINT DEFAULT 0,
    position INT DEFAULT 0,
    mentionable BOOLEAN DEFAULT FALSE,
    hoist BOOLEAN DEFAULT FALSE,
    managed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_roles_server ON roles(server_id);

-- invites
CREATE TABLE invites (
    code VARCHAR(16) PRIMARY KEY,
    server_id UUID REFERENCES servers(id) ON DELETE CASCADE,
    channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
    inviter_id UUID REFERENCES users(id) ON DELETE SET NULL,
    max_uses INT DEFAULT 0,
    max_age INT DEFAULT 0,
    temporary BOOLEAN DEFAULT FALSE,
    uses INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ
);

CREATE INDEX idx_invites_server ON invites(server_id);
CREATE INDEX idx_invites_channel ON invites(channel_id);

-- voice_states (for voice channel presence)
CREATE TABLE voice_states (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    server_id UUID REFERENCES servers(id) ON DELETE CASCADE,
    channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
    session_id UUID NOT NULL,
    self_mute BOOLEAN DEFAULT FALSE,
    self_deaf BOOLEAN DEFAULT FALSE,
    self_video BOOLEAN DEFAULT FALSE,
    self_stream BOOLEAN DEFAULT FALSE,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, server_id)
);

CREATE INDEX idx_voice_states_channel ON voice_states(channel_id);
CREATE INDEX idx_voice_states_server ON voice_states(server_id);

-- call_history
CREATE TABLE call_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID REFERENCES channels(id) ON DELETE SET NULL,
    dm_channel_id UUID REFERENCES dm_channels(id) ON DELETE SET NULL,
    initiator_id UUID REFERENCES users(id) ON DELETE SET NULL,
    type INT NOT NULL,
    livekit_room_name VARCHAR(255) NOT NULL,
    livekit_room_sid VARCHAR(255),
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    participants UUID[] DEFAULT '{}',
    max_participants INT DEFAULT 0
);

CREATE INDEX idx_call_history_initiator ON call_history(initiator_id, started_at DESC);
CREATE INDEX idx_call_history_channel ON call_history(channel_id);
CREATE INDEX idx_call_history_dm_channel ON call_history(dm_channel_id);

-- refresh_tokens
CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    user_agent TEXT,
    ip_address INET,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    revoked_at TIMESTAMPTZ
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token ON refresh_tokens(token_hash);
CREATE INDEX idx_refresh_tokens_expires ON refresh_tokens(expires_at);

-- email_verification_tokens
CREATE TABLE email_verification_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_email_verification_user ON email_verification_tokens(user_id);
CREATE INDEX idx_email_verification_token ON email_verification_tokens(token_hash);
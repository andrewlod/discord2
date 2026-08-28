export interface User {
  id: string;
  email: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
  google_id?: string;
  email_verified: boolean;
  status: 'online' | 'idle' | 'dnd' | 'invisible' | 'offline';
  custom_status?: string;
  video_quality: VideoQuality;
  preferred_camera?: string;
  preferred_microphone?: string;
  preferred_speaker?: string;
  noise_suppression: boolean;
  echo_cancellation: boolean;
  auto_gain_control: boolean;
  created_at: string;
  updated_at: string;
}

export interface Server {
  id: string;
  name: string;
  description?: string;
  icon_url?: string;
  banner_url?: string;
  owner_id: string;
  verification_level: number;
  default_notifications: number;
  created_at: string;
  updated_at: string;
  channels?: Channel[];
  members?: ServerMember[];
}

export interface ServerMember {
  server_id: string;
  user_id: string;
  user?: User;
  nickname?: string;
  roles: string[];
  joined_at: string;
}

export interface Channel {
  id: string;
  server_id: string;
  type: ChannelType;
  name: string;
  topic?: string;
  position: number;
  parent_id?: string;
  nsfw: boolean;
  rate_limit_per_user: number;
  created_at: string;
  updated_at: string;
}

export enum ChannelType {
  GUILD_TEXT = 0,
  GUILD_VOICE = 1,
  GUILD_CATEGORY = 2,
  DM = 3,
  GROUP_DM = 4,
}

export interface Message {
  id: string;
  channel_id: string;
  author_id: string;
  author?: User;
  content: string;
  edited_at?: string;
  type: MessageType;
  reference_message_id?: string;
  reference_message?: Message;
  attachments: Attachment[];
  reactions: Reaction[];
  channel_type: number;
  created_at: string;
}

export enum MessageType {
  DEFAULT = 0,
  REPLY = 1,
  CHANNEL_FOLLOW_ADD = 2,
  GUILD_STREAM = 3,
  GUILD_DISCOVERY = 4,
  GUILD_AVAILABLE = 5,
}

export interface Attachment {
  id: string;
  message_id: string;
  filename: string;
  url: string;
  size_bytes: number;
  content_type?: string;
  width?: number;
  height?: number;
  created_at: string;
}

export interface Reaction {
  message_id: string;
  user_id: string;
  emoji: string;
  user?: User;
  created_at: string;
  me?: boolean;
  count?: number;
}

export interface DMChannel {
  id: string;
  type: ChannelType.DM | ChannelType.GROUP_DM;
  name?: string;
  icon_url?: string;
  owner_id?: string;
  created_at: string;
  participants: User[];
  last_message_id?: string;
  last_message?: Message;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export interface VoiceState {
  user_id: string;
  server_id: string;
  channel_id: string;
  session_id: string;
  self_mute: boolean;
  self_deaf: boolean;
  self_video: boolean;
  self_stream: boolean;
  joined_at: string;
  user?: User;
}

export interface Call {
  id: string;
  channel_id?: string;
  dm_channel_id?: string;
  initiator_id: string;
  type: CallType;
  livekit_room_name: string;
  livekit_room_sid?: string;
  started_at: string;
  ended_at?: string;
  participants: string[];
  max_participants: number;
}

export enum CallType {
  VOICE = 1,
  VIDEO = 2,
  SCREEN_SHARE = 3,
  GO_LIVE = 4,
}

export interface LiveKitTokenResponse {
  token: string;
  ws_url: string;
  room_name: string;
}

export interface CallStartResponse {
  call: Call;
  token: string;
  ws_url: string;
  room_name: string;
}

export interface CallAcceptResponse {
  call: Call;
  token: string;
  ws_url: string;
  room_name: string;
}

export interface TokenResponse {
  token: string;
  ws_url: string;
}

export interface LiveStream {
  callId: string;
  roomName: string;
  channelId: string;
  initiatorId: string;
}

export interface CallSession {
  call: Call;
  token: string;
  wsUrl: string;
  roomName: string;
  isLive: boolean;
  isViewer: boolean;
}

export type VideoQuality = '360p' | '480p' | '720p' | '1080p';

export const VIDEO_QUALITY_PRESETS: Record<VideoQuality, { width: number; height: number; maxBitrate: number; maxFps: number }> = {
  '360p': { width: 640, height: 360, maxBitrate: 500_000, maxFps: 30 },
  '480p': { width: 854, height: 480, maxBitrate: 1_000_000, maxFps: 30 },
  '720p': { width: 1280, height: 720, maxBitrate: 2_500_000, maxFps: 30 },
  '1080p': { width: 1920, height: 1080, maxBitrate: 5_000_000, maxFps: 30 },
};

export interface ApiError {
  error: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  has_more: boolean;
  next_cursor?: string;
}

export interface WSMessage {
  op: number;
  d: Record<string, unknown>;
}

export enum WSOpCode {
  IDENTIFY = 0,
  HEARTBEAT = 1,
  MESSAGE_CREATE = 2,
  TYPING_START = 3,
  MESSAGE_ACK = 4,
  VOICE_STATE_UPDATE = 10,
  CALL_INCOMING = 11,
  CALL_ACTION = 12,
  STREAM_START = 13,
  CHANNEL_SELECT = 20,
  DM_SELECT = 21,
  READY = 0,
  MESSAGE_EVENT = 1,
  MESSAGE_DELETE = 2,
  PRESENCE_UPDATE = 3,
  TYPING_EVENT = 4,
  ERROR = 5,
  HEARTBEAT_ACK = 6,
}
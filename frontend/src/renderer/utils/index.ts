import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Call, CallSession, LiveStream } from '../types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTime(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatDate(date: Date | string): string {
  const d = new Date(date);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today.toDateString()) {
    return 'Today';
  }
  if (d.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatRelativeTime(date: Date | string): string {
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return formatDate(d);
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function getColorFromString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = hash % 360;
  return `hsl(${hue}, 70%, 45%)`;
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function parseMentions(content: string): string[] {
  const mentionRegex = /@(\w+)/g;
  const mentions: string[] = [];
  let match;
  while ((match = mentionRegex.exec(content)) !== null) {
    mentions.push(match[1]);
  }
  return mentions;
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'online': return '#3ba55c';
    case 'idle': return '#faa61a';
    case 'dnd': return '#ed4245';
    case 'invisible':
    case 'offline': return '#747f8d';
    default: return '#747f8d';
  }
}

export function getChannelIcon(type: number): string {
  switch (type) {
    case 0: return 'hash';
    case 1: return 'mic';
    case 2: return 'folder';
    case 3: return 'message-square';
    case 4: return 'users';
    default: return 'hash';
  }
}

export function isImageFile(contentType: string): boolean {
  return contentType.startsWith('image/');
}

export function isVideoFile(contentType: string): boolean {
  return contentType.startsWith('video/');
}

export function isAudioFile(contentType: string): boolean {
  return contentType.startsWith('audio/');
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export const VIDEO_QUALITY_OPTIONS = [
  { value: '360p', label: '360p', bandwidth: 'Low' },
  { value: '480p', label: '480p', bandwidth: 'Medium' },
  { value: '720p', label: '720p (HD)', bandwidth: 'High' },
  { value: '1080p', label: '1080p (Full HD)', bandwidth: 'Very High' },
] as const;

// The backend returns `type` as a string ("voice"/"video") while the frontend
// Call type uses the numeric CallType enum. Normalize incoming payloads.
export function normalizeCall(raw: any): Call {
  if (!raw) return raw;
  return {
    ...raw,
    type: raw.type === 'video' ? 2 : 1,
    started_at: raw.started_at ? new Date(raw.started_at).toISOString() : new Date().toISOString(),
  };
}

export function normalizeCallResponse(resp: any): CallSession {
  return {
    call: normalizeCall(resp.call),
    token: resp.token,
    wsUrl: resp.ws_url,
    roomName: resp.room_name,
    isLive: Boolean(resp.call?.is_live),
    isViewer: false,
  };
}

export function liveStreamFromWs(d: any): LiveStream {
  return {
    callId: d.call_id,
    roomName: d.room_name,
    channelId: d.channel_id,
    initiatorId: d.initiator_id,
  };
}

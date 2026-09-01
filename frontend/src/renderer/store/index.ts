import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useEffect, useState } from 'react';
import type { User, TokenPair, Server, Channel, Message, DMChannel, Call, VoiceState, VideoQuality, CallSession, LiveStream, FriendRelation } from '../types';
import { api } from '../services/api';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshTokens: () => Promise<void>;
  setUser: (user: User) => void;
  initialize: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,

      initialize: () => {
        const tokens = localStorage.getItem('auth_tokens');
        if (tokens) {
          try {
            const parsed = JSON.parse(tokens);
            api.setTokens(parsed);
            set({ accessToken: parsed.access_token, refreshToken: parsed.refresh_token, isAuthenticated: true });
          } catch {
            localStorage.removeItem('auth_tokens');
          }
        }
      },

      login: async (email: string, password: string) => {
        const { user, tokens } = await api.login(email, password);
        set({ user, accessToken: tokens.access_token, refreshToken: tokens.refresh_token, isAuthenticated: true });
      },

      register: async (email: string, username: string, password: string) => {
        const { user, tokens } = await api.register(email, username, password);
        set({ user, accessToken: tokens.access_token, refreshToken: tokens.refresh_token, isAuthenticated: true });
      },

      logout: async () => {
        await api.logout();
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
      },

      refreshTokens: async () => {
        const tokens = await api.refreshAccessToken();
        set({ accessToken: tokens.access_token, refreshToken: tokens.refresh_token });
      },

      setUser: (user: User) => set({ user }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

interface ServerState {
  servers: Server[];
  currentServerId: string | null;
  currentChannelId: string | null;
  fetchServers: () => Promise<void>;
  createServer: (name: string, description?: string, isPublic?: boolean) => Promise<Server>;
  selectServer: (serverId: string | null) => void;
  selectChannel: (channelId: string | null) => void;
  addServer: (server: Server) => void;
  updateServer: (serverId: string, data: Partial<Server>) => void;
  removeServer: (serverId: string) => void;
}

export const useServerStore = create<ServerState>((set, get) => ({
  servers: [],
  currentServerId: null,
  currentChannelId: null,

  fetchServers: async () => {
    const servers = await api.getServers();
    set({ servers });
  },

  createServer: async (name: string, description?: string, isPublic?: boolean) => {
    const { id } = await api.createServer(name, description, isPublic);
    const server = await api.getServer(id);
    set((state) => ({ servers: [server, ...state.servers] }));
    return server;
  },

  selectServer: (serverId) => set({ currentServerId: serverId, currentChannelId: null }),

  selectChannel: (channelId) => set({ currentChannelId: channelId }),

  addServer: (server) => set((state) => ({ servers: [server, ...state.servers] })),

  updateServer: (serverId, data) => set((state) => ({
    servers: state.servers.map(s => s.id === serverId ? { ...s, ...data } : s),
  })),

  removeServer: (serverId) => set((state) => ({
    servers: state.servers.filter(s => s.id !== serverId),
    currentServerId: state.currentServerId === serverId ? null : state.currentServerId,
  })),
}));

interface ChannelState {
  channels: Channel[];
  fetchChannels: (serverId: string) => Promise<void>;
  createChannel: (serverId: string, data: { type: number; name: string; topic?: string; parent_id?: string }) => Promise<Channel>;
  addChannel: (channel: Channel) => void;
  updateChannel: (channelId: string, data: Partial<Channel>) => void;
  removeChannel: (channelId: string) => void;
}

export const useChannelStore = create<ChannelState>((set) => ({
  channels: [],

  fetchChannels: async (serverId: string) => {
    const channels = await api.getChannels(serverId);
    set({ channels });
  },

  createChannel: async (serverId, data) => {
    const { id } = await api.createChannel(serverId, data);
    const channel = await api.getChannels(serverId).then(channels => channels.find(c => c.id === id)!);
    set((state) => ({ channels: [...state.channels, channel] }));
    return channel;
  },

  addChannel: (channel) => set((state) => ({ channels: [...state.channels, channel] })),

  updateChannel: (channelId, data) => set((state) => ({
    channels: state.channels.map(c => c.id === channelId ? { ...c, ...data } : c),
  })),

  removeChannel: (channelId) => set((state) => ({
    channels: state.channels.filter(c => c.id !== channelId),
  })),
}));

interface MessageState {
  messages: Map<string, Message[]>;
  loading: Map<string, boolean>;
  hasMore: Map<string, boolean>;
  fetchMessages: (channelId: string, before?: string) => Promise<void>;
  sendMessage: (channelId: string, content: string) => void;
  addMessage: (channelId: string, message: Message) => void;
  updateMessage: (channelId: string, messageId: string, content: string) => void;
  deleteMessage: (channelId: string, messageId: string) => void;
  addReaction: (channelId: string, messageId: string, emoji: string, userId: string) => void;
  removeReaction: (channelId: string, messageId: string, emoji: string, userId: string) => void;
  clearMessages: (channelId: string) => void;
}

export const useMessageStore = create<MessageState>((set, get) => ({
  messages: new Map(),
  loading: new Map(),
  hasMore: new Map(),

  fetchMessages: async (channelId: string, before?: string) => {
    const loading = get().loading.get(channelId);
    if (loading) return;

    set((state) => {
      const newLoading = new Map(state.loading);
      newLoading.set(channelId, true);
      return { loading: newLoading };
    });

    try {
      const messages = await api.getMessages(channelId, before);
      set((state) => {
        const newMessages = new Map(state.messages);
        const existing = newMessages.get(channelId) || [];
        const combined = before ? [...existing, ...messages] : messages;
        newMessages.set(channelId, combined);
        return { messages: newMessages, hasMore: new Map(state.hasMore).set(channelId, messages.length >= 50) };
      });
    } finally {
      set((state) => {
        const newLoading = new Map(state.loading);
        newLoading.set(channelId, false);
        return { loading: newLoading };
      });
    }
  },

  sendMessage: (channelId: string, content: string) => {
    const tempId = `temp-${Date.now()}-${Math.random()}`;
    const currentUser = useAuthStore.getState().user;
    const optimisticMessage: Message = {
      id: tempId,
      channel_id: channelId,
      author_id: currentUser?.id ?? '',
      author: currentUser
        ? {
            id: currentUser.id,
            username: currentUser.username,
            display_name: currentUser.display_name,
            avatar_url: currentUser.avatar_url,
            status: currentUser.status,
            email_verified: currentUser.email_verified,
          }
        : undefined,
      content,
      type: 0,
      attachments: [],
      reactions: [],
      channel_type: 0,
      created_at: new Date().toISOString(),
    };

    set((state) => {
      const newMessages = new Map(state.messages);
      const existing = newMessages.get(channelId) || [];
      newMessages.set(channelId, [...existing, optimisticMessage]);
      return { messages: newMessages };
    });

    api.sendMessage(channelId, content).catch(() => {
      get().deleteMessage(channelId, tempId);
    });
  },

  addMessage: (channelId: string, message: Message) => set((state) => {
    const newMessages = new Map(state.messages);
    const existing = newMessages.get(channelId) || [];
    if (!existing.find(m => m.id === message.id)) {
      newMessages.set(channelId, [...existing, message]);
    }
    return { messages: newMessages };
  }),

  updateMessage: (channelId: string, messageId: string, content: string) => set((state) => {
    const newMessages = new Map(state.messages);
    const existing = newMessages.get(channelId) || [];
    newMessages.set(channelId, existing.map(m => m.id === messageId ? { ...m, content, edited_at: new Date().toISOString() } : m));
    return { messages: newMessages };
  }),

  deleteMessage: (channelId: string, messageId: string) => set((state) => {
    const newMessages = new Map(state.messages);
    const existing = newMessages.get(channelId) || [];
    newMessages.set(channelId, existing.filter(m => m.id !== messageId));
    return { messages: newMessages };
  }),

  addReaction: (channelId: string, messageId: string, emoji: string, userId: string) => set((state) => {
    const newMessages = new Map(state.messages);
    const existing = newMessages.get(channelId) || [];
    newMessages.set(channelId, existing.map(m => {
      if (m.id !== messageId) return m;
      const hasReaction = m.reactions?.some(r => r.emoji === emoji && r.user_id === userId);
      if (hasReaction) return m;
      return { ...m, reactions: [...(m.reactions || []), { message_id: messageId, user_id: userId, emoji, created_at: new Date().toISOString(), me: false, count: 1 }] };
    }));
    return { messages: newMessages };
  }),

  removeReaction: (channelId: string, messageId: string, emoji: string, userId: string) => set((state) => {
    const newMessages = new Map(state.messages);
    const existing = newMessages.get(channelId) || [];
    newMessages.set(channelId, existing.map(m => {
      if (m.id !== messageId) return m;
      return { ...m, reactions: m.reactions?.filter(r => !(r.emoji === emoji && r.user_id === userId)) || [] };
    }));
    return { messages: newMessages };
  }),

  clearMessages: (channelId: string) => set((state) => {
    const newMessages = new Map(state.messages);
    newMessages.delete(channelId);
    return { messages: newMessages };
  }),
}));

interface DMState {
  dms: DMChannel[];
  fetchDMs: () => Promise<void>;
  createDM: (userId: string) => Promise<DMChannel>;
  addDM: (dm: DMChannel) => void;
  updateDM: (dmId: string, data: Partial<DMChannel>) => void;
}

export const useDMStore = create<DMState>((set) => ({
  dms: [],

  fetchDMs: async () => {
    const dms = await api.getDMs();
    set({ dms });
  },

  createDM: async (userId: string) => {
    const dm = await api.createDM(userId);
    set((state) => ({ dms: [dm, ...state.dms] }));
    return dm;
  },

  addDM: (dm) => set((state) => ({ dms: [dm, ...state.dms] })),

  updateDM: (dmId, data) => set((state) => ({
    dms: state.dms.map(d => d.id === dmId ? { ...d, ...data } : d),
  })),
}));

interface CallState {
  outgoingCall: CallSession | null;
  incomingCall: { call: Call; isLive: boolean } | null;
  activeCall: CallSession | null;
  liveStreams: Map<string, LiveStream>;
  localVideoQuality: VideoQuality;
  setOutgoingCall: (session: CallSession | null) => void;
  setIncomingCall: (call: { call: Call; isLive: boolean } | null) => void;
  setActiveCall: (session: CallSession | null) => void;
  addLiveStream: (stream: LiveStream) => void;
  removeLiveStream: (callId: string) => void;
  setLocalVideoQuality: (quality: VideoQuality) => void;
}

export const useCallStore = create<CallState>((set) => ({
  outgoingCall: null,
  incomingCall: null,
  activeCall: null,
  liveStreams: new Map(),
  localVideoQuality: '720p',

  setOutgoingCall: (session) => set({ outgoingCall: session }),

  setIncomingCall: (call) => set({ incomingCall: call }),

  setActiveCall: (session) => set({ activeCall: session }),

  addLiveStream: (stream) => set((state) => {
    const newStreams = new Map(state.liveStreams);
    newStreams.set(stream.callId, stream);
    return { liveStreams: newStreams };
  }),

  removeLiveStream: (callId) => set((state) => {
    const newStreams = new Map(state.liveStreams);
    newStreams.delete(callId);
    return { liveStreams: newStreams };
  }),

  setLocalVideoQuality: (quality) => set({ localVideoQuality: quality }),
}));

interface VoiceStore {
  voiceStates: Map<string, VoiceState>;
  connectedChannelId: string | null;
  setVoiceState: (state: VoiceState) => void;
  removeVoiceState: (userId: string) => void;
  setConnectedChannel: (channelId: string | null) => void;
  clearVoiceStates: (channelId: string) => void;
}

export const useVoiceStore = create<VoiceStore>((set) => ({
  voiceStates: new Map(),
  connectedChannelId: null,

  setVoiceState: (voiceState) => set((state) => {
    const newStates = new Map(state.voiceStates);
    newStates.set(voiceState.user_id, voiceState);
    return { voiceStates: newStates };
  }),

  removeVoiceState: (userId) => set((state) => {
    const newStates = new Map(state.voiceStates);
    newStates.delete(userId);
    return { voiceStates: newStates };
  }),

  setConnectedChannel: (channelId) => set({ connectedChannelId: channelId }),

  clearVoiceStates: (channelId) => set((state) => {
    const newStates = new Map(state.voiceStates);
    for (const [userId, vs] of newStates.entries()) {
      if (vs.channel_id === channelId) {
        newStates.delete(userId);
      }
    }
    return { voiceStates: newStates };
  }),
}));

interface FriendState {
  friends: FriendRelation[];
  incoming: FriendRelation[];
  outgoing: FriendRelation[];
  fetchFriends: () => Promise<void>;
  sendRequest: (target: { user_id?: string; username?: string }) => Promise<void>;
  acceptRequest: (userId: string) => Promise<void>;
  declineRequest: (userId: string) => Promise<void>;
  removeFriend: (userId: string) => Promise<void>;
}

export const useFriendStore = create<FriendState>((set, get) => ({
  friends: [],
  incoming: [],
  outgoing: [],

  fetchFriends: async () => {
    const data = await api.getFriends();
    set({ friends: data.friends, incoming: data.incoming, outgoing: data.outgoing });
  },

  sendRequest: async (target) => {
    await api.sendFriendRequest(target);
    await get().fetchFriends();
  },

  acceptRequest: async (userId) => {
    await api.acceptFriendRequest(userId);
    await get().fetchFriends();
  },

  declineRequest: async (userId) => {
    await api.declineFriendRequest(userId);
    await get().fetchFriends();
  },

  removeFriend: async (userId) => {
    await api.removeFriend(userId);
    await get().fetchFriends();
  },
}));

interface UISettingsState {
  sidebarCollapsed: boolean;
  compactMode: boolean;
  showMemberList: boolean;
  theme: 'dark' | 'light';
  toggleSidebar: () => void;
  toggleCompactMode: () => void;
  toggleMemberList: () => void;
  setTheme: (theme: 'dark' | 'light') => void;
}

export const useUISettingsStore = create<UISettingsState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      compactMode: false,
      showMemberList: true,
      theme: 'dark',

      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      toggleCompactMode: () => set((state) => ({ compactMode: !state.compactMode })),
      toggleMemberList: () => set((state) => ({ showMemberList: !state.showMemberList })),
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'ui-settings',
    }
  )
);

interface UserCacheState {
  users: Map<string, User>;
  fetchUser: (id: string) => Promise<User | null>;
  getUser: (id: string) => User | undefined;
}

export const useUserCacheStore = create<UserCacheState>((set, get) => ({
  users: new Map(),

  fetchUser: async (id: string) => {
    const cached = get().users.get(id);
    if (cached) return cached;
    try {
      const user = await api.getUser(id);
      set((state) => {
        const newUsers = new Map(state.users);
        newUsers.set(id, user);
        return { users: newUsers };
      });
      return user;
    } catch {
      return null;
    }
  },

  getUser: (id: string) => get().users.get(id),
}));

export function useUserDisplay(userId: string | undefined): string {
  const [displayName, setDisplayName] = useState(userId?.slice(0, 8) ?? '');
  const currentUser = useAuthStore((s) => s.user);

  useEffect(() => {
    if (!userId) {
      setDisplayName('');
      return;
    }
    if (currentUser?.id === userId) {
      setDisplayName(currentUser.display_name || currentUser.username);
      return;
    }

    const cached = useUserCacheStore.getState().getUser(userId);
    if (cached) {
      setDisplayName(cached.display_name || cached.username);
      return;
    }

    let cancelled = false;
    useUserCacheStore.getState().fetchUser(userId).then((user) => {
      if (!cancelled && user) {
        setDisplayName(user.display_name || user.username);
      }
    });
    return () => { cancelled = true; };
  }, [userId, currentUser]);

  return displayName;
}
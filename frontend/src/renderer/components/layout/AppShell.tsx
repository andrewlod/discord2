import { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import ChannelList from './ChannelList';
import ChatArea from '@/components/chat/ChatArea';
import MemberList from '@/components/layout/MemberList';
import { VoiceChannelView } from '@/components/voice/VoiceChannelView';
import { CallManager } from '@/components/voice/CallManager';
import { DMPanel } from '@/components/dm/DMPanel';
import { useServerStore, useChannelStore, useUISettingsStore, useAuthStore, useVoiceStore } from '@/store';
import { ws } from '@/services/websocket';
import { ChannelType } from '@/types';
import { cn } from '@/utils';

export default function AppShell() {
  const { currentServerId, currentChannelId, servers } = useServerStore();
  const { channels, fetchChannels } = useChannelStore();
  const { sidebarCollapsed, showMemberList, compactMode } = useUISettingsStore();
  const { user } = useAuthStore();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [mobileChannelListOpen, setMobileChannelListOpen] = useState(false);
  const [dmMode, setDmMode] = useState(false);

  const currentServer = servers.find(s => s.id === currentServerId);
  const currentChannel = channels.find(c => c.id === currentChannelId);

  useEffect(() => {
    const unsubscribe = ws.onMessage((msg: any) => {
      if (msg.op === 10) {
        const d = msg.d as any;
        const voiceStore = useVoiceStore.getState();
        if (d.channel_id) {
          voiceStore.setVoiceState({
            user_id: d.user_id,
            server_id: d.server_id,
            channel_id: d.channel_id,
            session_id: d.session_id,
            self_mute: d.self_mute,
            self_deaf: d.self_deaf,
            self_video: d.self_video,
            self_stream: d.self_stream,
            joined_at: new Date().toISOString(),
          });
        } else {
          voiceStore.removeVoiceState(d.user_id);
        }
      }
    });
    return unsubscribe;
  }, []);

  const handleServerSelect = (serverId: string) => {
    setDmMode(false);
    useServerStore.getState().selectServer(serverId);
    if (serverId) {
      fetchChannels(serverId);
    }
    setMobileSidebarOpen(false);
  };

  const handleDMToggle = () => {
    const next = !dmMode;
    setDmMode(next);
    if (next) {
      useServerStore.getState().selectServer(null as any);
      useServerStore.getState().selectChannel(null as any);
    }
  };

  const handleChannelSelect = (channelId: string) => {
    useServerStore.getState().selectChannel(channelId);
    setMobileChannelListOpen(false);
  };

  return (
    <div className={cn('flex h-screen w-screen bg-discord-bg overflow-hidden', compactMode && 'compact')}>
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-discord-bg-secondary text-discord-text hover:bg-discord-bg-tertiary"
        onClick={() => setMobileSidebarOpen(true)}
        aria-label="Open server list"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      <Sidebar
        servers={servers}
        currentServerId={currentServerId}
        onServerSelect={handleServerSelect}
        dmMode={dmMode}
        onToggleDM={handleDMToggle}
        collapsed={sidebarCollapsed}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
        user={user}
      />

      {currentServerId && (
        <ChannelList
          serverId={currentServerId}
          channels={channels}
          currentChannelId={currentChannelId}
          onChannelSelect={handleChannelSelect}
          mobileOpen={mobileChannelListOpen}
          onMobileClose={() => setMobileChannelListOpen(false)}
        />
      )}

      <main className={cn('flex-1 flex flex-col overflow-hidden', !currentServerId && 'justify-center items-center')}>
        {currentServerId && currentChannelId && currentChannel?.type === ChannelType.GUILD_VOICE && (
          <VoiceChannelView serverId={currentServerId} channel={currentChannel} />
        )}

        {currentServerId && currentChannelId && currentChannel?.type !== ChannelType.GUILD_VOICE && (
          <ChatArea
            serverId={currentServerId}
            channelId={currentChannelId}
            server={currentServer}
          />
        )}

        {!currentServerId && dmMode && <DMPanel />}

        {!currentServerId && !dmMode && (
          <div className="flex flex-col items-center justify-center text-discord-text-muted p-8">
            <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="mb-4 opacity-50">
              <circle cx="12" cy="12" r="10" />
              <path d="M8 14s1.5 2 4 2 4-2 4-2" />
              <line x1="9" y1="9" x2="9.01" y2="9" />
              <line x1="15" y1="9" x2="15.01" y2="9" />
            </svg>
            <h1 className="text-2xl font-semibold mb-2">Welcome to Discord 2</h1>
            <p className="text-center max-w-md">Select a server from the sidebar or create a new one to get started</p>
          </div>
        )}

        {currentServerId && !currentChannelId && (
          <div className="flex flex-col items-center justify-center text-discord-text-muted p-8">
            <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-4 opacity-50">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <h1 className="text-xl font-medium mb-2">{currentServer?.name}</h1>
            <p className="text-center max-w-md">Select a channel from the sidebar to start chatting</p>
          </div>
        )}
      </main>

      {showMemberList && currentServerId && (
        <MemberList serverId={currentServerId} />
      )}

      <CallManager />
    </div>
  );
}
import { useEffect, useRef, useState } from 'react';
import { Send, Paperclip, Mic, Video, Smile, GripVertical, MoreHorizontal } from 'lucide-react';
import { useMessageStore, useAuthStore } from '@/store';
import { api } from '@/services/api';
import { ws } from '@/services/websocket';
import MessageList from '@/components/chat/MessageList';
import MessageInput from '@/components/chat/MessageInput';
import TypingIndicator from '@/components/chat/TypingIndicator';
import { cn } from '@/utils';

interface ChatAreaProps {
  serverId: string;
  channelId: string;
  server?: { id: string; name: string; icon_url?: string };
}

export default function ChatArea({ serverId, channelId, server }: ChatAreaProps) {
  const { user } = useAuthStore();
  const { messages, fetchMessages, sendMessage, addMessage, loading, hasMore } = useMessageStore();
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const channelMessages = messages.get(channelId) || [];

  useEffect(() => {
    fetchMessages(channelId);
    ws.selectChannel(channelId, serverId);

    const unsubscribe = ws.onMessage((msg) => {
      if (msg.op === 1 && msg.d.channel_id === channelId) {
        const message = msg.d.message;
        if (message.author_id !== user?.id) {
          addMessage(channelId, message);
        }
      } else if (msg.op === 4 && msg.d.channel_id === channelId) {
        setTypingUsers(prev => [...new Set([...prev, msg.d.user_id])]);
        setTimeout(() => {
          setTypingUsers(prev => prev.filter(id => id !== msg.d.user_id));
        }, 3000);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [channelId, fetchMessages, addMessage, user?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [channelMessages]);

  const handleSend = (content: string) => {
    sendMessage(channelId, content);
  };

  const handleLoadMore = () => {
    const firstMessage = channelMessages[channelMessages.length - 1];
    if (firstMessage && hasMore.get(channelId) && !loading.get(channelId)) {
      fetchMessages(channelId, firstMessage.id);
    }
  };

  return (
    <div className="flex flex-col h-full bg-discord-bg">
      <div className="flex items-center gap-3 px-4 py-2 border-b border-discord-border bg-discord-bg-secondary">
        <div className="flex items-center gap-2">
          <span className="text-discord-accent font-medium">#</span>
          <span className="font-medium truncate">{channelId}</span>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-1">
          <button className="p-2 rounded-lg hover:bg-discord-bg-tertiary transition-colors" aria-label="Search">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" strokeWidth={2} />
              <path d="M21 21l-4.35-4.35" strokeWidth={2} />
            </svg>
          </button>
          <button className="p-2 rounded-lg hover:bg-discord-bg-tertiary transition-colors" aria-label="Pinned messages">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M12 17v5" strokeWidth={2} strokeLinecap="round" />
              <path d="M9 17v5" strokeWidth={2} strokeLinecap="round" />
              <path d="M15 17v5" strokeWidth={2} strokeLinecap="round" />
              <path d="M8 7h9a4 4 0 0 1 0 8H8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button className="p-2 rounded-lg hover:bg-discord-bg-tertiary transition-colors" aria-label="Members">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="9" cy="7" r="4" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
        onScroll={(e) => {
          const target = e.currentTarget;
          if (target.scrollTop === 0) {
            handleLoadMore();
          }
        }}
      >
        {loading.get(channelId) && channelMessages.length === 0 && (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-discord-accent border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        <MessageList messages={channelMessages} currentUserId={user?.id} />

        {typingUsers.length > 0 && <TypingIndicator users={typingUsers} />}

        <div ref={messagesEndRef} />
      </div>

      <MessageInput onSend={handleSend} channelId={channelId} />
    </div>
  );
}
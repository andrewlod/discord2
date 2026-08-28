import { useMemo } from 'react';
import Message from '@/components/chat/Message';
import { cn } from '@/utils';

interface MessageListProps {
  messages: Array<{
    id: string;
    content: string;
    author_id: string;
    author?: { id: string; username: string; display_name?: string; avatar_url?: string; color?: string };
    created_at: string;
    edited_at?: string;
    type: number;
    reference_message_id?: string;
    reference_message?: any;
    attachments: any[];
    reactions: any[];
  }>;
  currentUserId?: string;
}

export default function MessageList({ messages, currentUserId }: MessageListProps) {
  const groupedMessages = useMemo(() => {
    const groups: Array<{ date: string; messages: typeof messages }> = [];
    let currentGroup: typeof messages = [];
    let currentDate = '';

    for (const message of messages) {
      const messageDate = new Date(message.created_at).toDateString();
      if (messageDate !== currentDate) {
        if (currentGroup.length > 0) {
          groups.push({ date: currentDate, messages: currentGroup });
        }
        currentGroup = [message];
        currentDate = messageDate;
      } else {
        currentGroup.push(message);
      }
    }
    if (currentGroup.length > 0) {
      groups.push({ date: currentDate, messages: currentGroup });
    }
    return groups;
  }, [messages]);

  return (
    <div className="flex flex-col gap-4">
      {groupedMessages.map((group, groupIndex) => (
        <div key={groupIndex} className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-xs text-discord-text-muted px-2">
            <span className="flex-1 border-t border-discord-border" />
            <span className="px-2 bg-discord-bg">{formatDateHeader(group.date)}</span>
            <span className="flex-1 border-t border-discord-border" />
          </div>
          {group.messages.map((message, index) => (
            <Message
              key={message.id}
              message={message}
              currentUserId={currentUserId}
              showAvatar={index === 0 || group.messages[index - 1]?.author_id !== message.author_id}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function formatDateHeader(dateString: string): string {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}
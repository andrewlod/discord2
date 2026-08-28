import { Hash, Lock, Speaker, MoreHorizontal, Edit3, Trash2, Bell } from 'lucide-react';
import { cn, getChannelIcon } from '@/utils';

interface ChannelItemProps {
  channel: { id: string; name: string; type: number };
  isActive: boolean;
  onClick: () => void;
}

export default function ChannelItem({ channel, isActive, onClick }: ChannelItemProps) {
  const { name, type } = channel;
  const isText = type === 0;
  const isVoice = type === 1;

  return (
    <button
      className={cn(
        'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm font-medium transition-colors',
        isActive
          ? 'bg-discord-accent/10 text-discord-text'
          : 'text-discord-text-muted hover:text-discord-text hover:bg-discord-bg-tertiary'
      )}
      onClick={onClick}
      aria-current={isActive ? 'page' : undefined}
    >
      {isText && <Hash className="w-4 h-4 flex-shrink-0" />}
      {isVoice && <Speaker className="w-4 h-4 flex-shrink-0" />}
      <span className="truncate">{name}</span>
    </button>
  );
}
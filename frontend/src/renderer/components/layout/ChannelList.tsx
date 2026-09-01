import { useState } from 'react';
import { Hash, Lock, Speaker, Folder, Plus, MoreHorizontal, Edit3, Trash2, Bell, Hash as HashIcon, UserPlus } from 'lucide-react';
import { useChannelStore, useServerStore } from '@/store';
import { cn, getChannelIcon } from '@/utils';
import ChannelItem from '@/components/channel/ChannelItem';
import CreateChannelModal from '@/components/channel/CreateChannelModal';
import InviteModal from '@/components/server/InviteModal';

interface ChannelListProps {
  serverId: string;
  channels: Array<{ id: string; name: string; type: number; parent_id?: string; position: number }>;
  currentChannelId: string | null;
  onChannelSelect: (channelId: string) => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export default function ChannelList({ serverId, channels, currentChannelId, onChannelSelect, mobileOpen, onMobileClose }: ChannelListProps) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const server = useServerStore((s) => s.servers.find((sv) => sv.id === serverId));

  const categories = channels.filter(c => c.type === 2);
  const textChannels = channels.filter(c => c.type === 0 && !c.parent_id);
  const voiceChannels = channels.filter(c => c.type === 1 && !c.parent_id);

  const getCategoryChannels = (categoryId: string) =>
    channels.filter(c => c.parent_id === categoryId && c.type !== 2);

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  if (mobileOpen) {
    return (
      <div className="fixed inset-0 z-50 lg:hidden flex flex-col bg-discord-bg-secondary">
        <div className="flex items-center justify-between px-4 py-3 border-b border-discord-border">
          <h2 className="font-semibold">Channels</h2>
          <button onClick={onMobileClose} className="p-2 rounded-lg hover:bg-discord-bg-tertiary">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {categories.map(category => (
            <div key={category.id} className="space-y-1">
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-sm font-semibold text-discord-text-muted uppercase tracking-wider"
                onClick={() => toggleCategory(category.id)}
              >
                <Folder className={cn('w-4 h-4', expandedCategories.has(category.id) && 'rotate-90')} />
                {category.name}
              </button>
              {expandedCategories.has(category.id) && (
                <div className="ml-4 space-y-1">
                  {getCategoryChannels(category.id).map(channel => (
                    <ChannelItem
                      key={channel.id}
                      channel={channel}
                      isActive={currentChannelId === channel.id}
                      onClick={() => { onChannelSelect(channel.id); onMobileClose(); }}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
          {textChannels.length > 0 && (
            <div className="space-y-1">
              <div className="px-3 py-2 text-xs font-semibold text-discord-text-muted uppercase tracking-wider">Text Channels</div>
              {textChannels.map(channel => (
                <ChannelItem
                  key={channel.id}
                  channel={channel}
                  isActive={currentChannelId === channel.id}
                  onClick={() => { onChannelSelect(channel.id); onMobileClose(); }}
                />
              ))}
            </div>
          )}
          {voiceChannels.length > 0 && (
            <div className="space-y-1">
              <div className="px-3 py-2 text-xs font-semibold text-discord-text-muted uppercase tracking-wider">Voice Channels</div>
              {voiceChannels.map(channel => (
                <ChannelItem
                  key={channel.id}
                  channel={channel}
                  isActive={currentChannelId === channel.id}
                  onClick={() => { onChannelSelect(channel.id); onMobileClose(); }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <aside className="w-56 flex-shrink-0 bg-discord-bg-secondary border-r border-discord-border flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-discord-border">
        <span className="text-xs font-semibold text-discord-text-muted uppercase tracking-wider">Text Channels</span>
        <div className="flex items-center gap-1">
          <button
            className="p-1.5 rounded-lg hover:bg-discord-bg-tertiary transition-colors"
            onClick={() => setShowInviteModal(true)}
            aria-label="Invite people"
            title="Invite people"
          >
            <UserPlus className="w-4 h-4 text-discord-text-muted" />
          </button>
          <button
            className="p-1.5 rounded-lg hover:bg-discord-bg-tertiary transition-colors"
            onClick={() => setShowCreateModal(true)}
            aria-label="Create channel"
          >
            <Plus className="w-4 h-4 text-discord-text-muted" />
          </button>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-4" role="navigation" aria-label="Channels">
        {categories.map(category => (
          <div key={category.id} className="space-y-1">
            <button
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-discord-text-muted uppercase tracking-wider hover:text-discord-text"
              onClick={() => toggleCategory(category.id)}
            >
              <Folder className={cn('w-4 h-4', expandedCategories.has(category.id) && 'rotate-90')} />
              {category.name}
            </button>
            {expandedCategories.has(category.id) && (
              <div className="ml-4 space-y-1">
                {getCategoryChannels(category.id).map(channel => (
                  <ChannelItem
                    key={channel.id}
                    channel={channel}
                    isActive={currentChannelId === channel.id}
                    onClick={() => onChannelSelect(channel.id)}
                  />
                ))}
              </div>
            )}
          </div>
        ))}

        {textChannels.length > 0 && (
          <div className="space-y-1">
            <div className="px-3 py-2 text-xs font-semibold text-discord-text-muted uppercase tracking-wider">Text Channels</div>
            {textChannels.map(channel => (
              <ChannelItem
                key={channel.id}
                channel={channel}
                isActive={currentChannelId === channel.id}
                onClick={() => onChannelSelect(channel.id)}
              />
            ))}
          </div>
        )}

        <div className="pt-4 border-t border-discord-border">
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-xs font-semibold text-discord-text-muted uppercase tracking-wider">Voice Channels</span>
            <button
              className="p-1.5 rounded-lg hover:bg-discord-bg-tertiary transition-colors"
              onClick={() => setShowCreateModal(true)}
              aria-label="Create voice channel"
            >
              <Plus className="w-4 h-4 text-discord-text-muted" />
            </button>
          </div>
          <div className="space-y-1">
            {voiceChannels.map(channel => (
              <ChannelItem
                key={channel.id}
                channel={channel}
                isActive={currentChannelId === channel.id}
                onClick={() => onChannelSelect(channel.id)}
              />
            ))}
          </div>
        </div>
      </nav>

      {showCreateModal && (
        <CreateChannelModal serverId={serverId} onClose={() => setShowCreateModal(false)} />
      )}

      {showInviteModal && (
        <InviteModal
          serverId={serverId}
          serverName={server?.name || 'Server'}
          onClose={() => setShowInviteModal(false)}
        />
      )}
    </aside>
  );
}

import { X } from 'lucide-react';
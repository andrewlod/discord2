import { useState } from 'react';
import { X, Hash, Speaker, Folder } from 'lucide-react';
import { cn } from '@/utils';
import { useChannelStore } from '@/store';

interface CreateChannelModalProps {
  serverId: string;
  onClose: () => void;
}

export default function CreateChannelModal({ serverId, onClose }: CreateChannelModalProps) {
  const [type, setType] = useState<'text' | 'voice' | 'category'>('text');
  const [name, setName] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      const typeMap = { text: 0, voice: 1, category: 2 };
      await useChannelStore.getState().createChannel(serverId, {
        type: typeMap[type],
        name: name.trim(),
      });
      onClose();
    } catch (error) {
      console.error('Failed to create channel:', error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md bg-discord-bg-secondary rounded-lg border border-discord-border overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-discord-border">
          <h2 className="text-lg font-semibold">Create Channel</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-discord-bg-tertiary transition-colors">
            <X className="w-5 h-5 text-discord-text-muted" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium mb-3">Channel Type</label>
            <div className="flex gap-3">
              {[
                { value: 'text', icon: Hash, label: 'Text Channel', desc: 'For text messages' },
                { value: 'voice', icon: Speaker, label: 'Voice Channel', desc: 'For voice chat' },
                { value: 'category', icon: Folder, label: 'Category', desc: 'Group channels' },
              ].map(({ value, icon: Icon, label, desc }) => (
                <button
                  key={value}
                  type="button"
                  className={cn(
                    'flex-1 flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-colors',
                    type === value
                      ? 'border-discord-accent bg-discord-accent/10'
                      : 'border-discord-border hover:border-discord-text-muted'
                  )}
                  onClick={() => setType(value as any)}
                >
                  <Icon className={cn('w-5 h-5', type === value ? 'text-discord-accent' : 'text-discord-text-muted')} />
                  <span className="font-medium text-sm">{label}</span>
                  <span className="text-xs text-discord-text-muted text-center">{desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="channel-name" className="block text-sm font-medium mb-1">
              Channel Name
            </label>
            <input
              id="channel-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={type === 'category' ? 'Category Name' : type === 'voice' ? 'Voice Channel' : 'text-channel'}
              maxLength={100}
              className="input lowercase"
              autoFocus
            />
            <p className="text-xs text-discord-text-muted mt-1">
              {name.length}/100 characters
            </p>
          </div>

          {type !== 'category' && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is-private"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                className="w-4 h-4 rounded border-discord-border bg-discord-bg-tertiary text-discord-accent focus:ring-discord-accent"
              />
              <label htmlFor="is-private" className="text-sm text-discord-text">
                Private channel (role restricted)
              </label>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={!name.trim()} className="btn-primary">
              Create Channel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
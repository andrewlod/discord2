import { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { cn } from '@/utils';
import { useServerStore } from '@/store';

interface CreateServerModalProps {
  onClose: () => void;
}

export default function CreateServerModal({ onClose }: CreateServerModalProps) {
  const [mode, setMode] = useState<'create' | 'join' | 'template'>('create');
  const [name, setName] = useState('');
  const [isPrivate, setIsPrivate] = useState(true);
  const createServer = useServerStore((state) => state.createServer);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      await createServer(name.trim());
      onClose();
    } catch (error) {
      console.error('Failed to create server:', error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md bg-discord-bg-secondary rounded-lg border border-discord-border overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-discord-border">
          <h2 className="text-lg font-semibold">Create a Server</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-discord-bg-tertiary transition-colors">
            <X className="w-5 h-5 text-discord-text-muted" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex gap-4">
            <button
              type="button"
              className={cn(
                'flex-1 flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-colors',
                mode === 'create'
                  ? 'border-discord-accent bg-discord-accent/10'
                  : 'border-discord-border hover:border-discord-text-muted'
              )}
              onClick={() => setMode('create')}
            >
              <div className="w-12 h-12 rounded-full bg-discord-accent/20 flex items-center justify-center">
                <Plus className="w-6 h-6 text-discord-accent" />
              </div>
              <span className="font-medium text-sm">Create My Own</span>
              <span className="text-xs text-discord-text-muted">For me and my friends</span>
            </button>

            <button
              type="button"
              className={cn(
                'flex-1 flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-colors',
                mode === 'template'
                  ? 'border-discord-accent bg-discord-accent/10'
                  : 'border-discord-border hover:border-discord-text-muted'
              )}
              onClick={() => setMode('template')}
            >
              <div className="w-12 h-12 rounded-full bg-discord-green/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-discord-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                </svg>
              </div>
              <span className="font-medium text-sm">Template</span>
              <span className="text-xs text-discord-text-muted">Gaming, Study Group, etc.</span>
            </button>
          </div>

          {mode === 'create' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="server-name" className="block text-sm font-medium mb-1">
                  Server Name
                </label>
                <input
                  id="server-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="My Server"
                  maxLength={100}
                  className="input"
                  autoFocus
                />
                <p className="text-xs text-discord-text-muted mt-1">
                  {name.length}/100 characters
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is-private"
                  checked={isPrivate}
                  onChange={(e) => setIsPrivate(e.target.checked)}
                  className="w-4 h-4 rounded border-discord-border bg-discord-bg-tertiary text-discord-accent focus:ring-discord-accent"
                />
                <label htmlFor="is-private" className="text-sm text-discord-text">
                  Private server (invite only)
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!name.trim()}
                  className="btn-primary"
                >
                  Create Server
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
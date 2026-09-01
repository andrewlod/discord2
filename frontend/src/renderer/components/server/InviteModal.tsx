import { useState } from 'react';
import { X, Copy, Check } from 'lucide-react';
import { api } from '@/services/api';

interface InviteModalProps {
  serverId: string;
  serverName: string;
  onClose: () => void;
}

export default function InviteModal({ serverId, serverName, onClose }: InviteModalProps) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.createInvite(serverId, { max_age: 0, max_uses: 0 });
      setCode(res.code);
      setCopied(false);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to create invite');
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md bg-discord-bg-secondary rounded-lg border border-discord-border overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-discord-border">
          <h2 className="text-lg font-semibold">Invite friends to {serverName}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-discord-bg-tertiary transition-colors">
            <X className="w-5 h-5 text-discord-text-muted" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {!code ? (
            <button onClick={generate} disabled={loading} className="btn-primary w-full disabled:opacity-50">
              {loading ? 'Generating…' : 'Generate an invite link'}
            </button>
          ) : (
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-discord-text-muted uppercase tracking-wider">
                Invite Code
              </label>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={code}
                  className="input flex-1 font-mono"
                  onFocus={(e) => e.currentTarget.select()}
                />
                <button
                  onClick={copy}
                  className="p-2 rounded-lg bg-discord-bg-tertiary hover:bg-discord-bg text-discord-text"
                  title="Copy"
                >
                  {copied ? <Check className="w-4 h-4 text-discord-green" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-discord-text-muted">
                Share this code — friends can join via Explore Public Servers → "Have an invite?".
              </p>
              <button onClick={generate} className="text-sm text-discord-accent hover:underline">
                Generate a new link
              </button>
            </div>
          )}
          {error && <p className="text-xs text-discord-red">{error}</p>}
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { X, Search, Users, Plus, Check } from 'lucide-react';
import { api } from '@/services/api';
import { useServerStore } from '@/store';
import { getInitials, getColorFromString, cn } from '@/utils';
import type { PublicServer } from '@/types';

interface ExplorePublicServersProps {
  onClose: () => void;
  onAddFriend?: () => void;
}

export default function ExplorePublicServers({ onClose, onAddFriend }: ExplorePublicServersProps) {
  const [servers, setServers] = useState<PublicServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [joined, setJoined] = useState<Set<string>>(new Set());
  const [inviteCode, setInviteCode] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);

  const fetchServers = useServerStore((s) => s.fetchServers);

  useEffect(() => {
    api.exploreServers()
      .then(setServers)
      .catch(() => setServers([]))
      .finally(() => setLoading(false));
  }, []);

  const joinWithCode = async () => {
    const code = inviteCode.trim();
    if (!code) return;
    setInviteLoading(true);
    setInviteError('');
    try {
      await api.joinInvite(code);
      await fetchServers();
      setInviteCode('');
      onClose();
    } catch (e: any) {
      setInviteError(e?.response?.data?.error || 'Invalid or expired invite');
    } finally {
      setInviteLoading(false);
    }
  };

  const joinServer = async (server: PublicServer) => {
    try {
      await api.joinServer(server.id);
    } catch {
      return;
    }
    setJoined((prev) => new Set(prev).add(server.id));
    await fetchServers();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl bg-discord-bg-secondary rounded-lg border border-discord-border overflow-hidden flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-discord-border">
          <h2 className="text-lg font-semibold">Explore Public Servers</h2>
          <div className="flex items-center gap-2">
            {onAddFriend && (
              <button
                onClick={onAddFriend}
                className="text-sm px-3 py-1.5 rounded-lg bg-discord-accent/20 text-discord-accent hover:bg-discord-accent/30 transition-colors"
              >
                Add Friend
              </button>
            )}
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-discord-bg-tertiary transition-colors">
              <X className="w-5 h-5 text-discord-text-muted" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto">
          <div className="rounded-lg bg-discord-bg-tertiary p-4 border border-discord-border">
            <label className="block text-sm font-medium mb-2">Have an invite? Join a private server</label>
            <div className="flex gap-2">
              <div className="flex-1 flex items-center gap-2 bg-discord-bg px-3 rounded-lg border border-discord-border">
                <Search className="w-4 h-4 text-discord-text-muted" />
                <input
                  className="bg-transparent text-discord-text py-2 w-full outline-none text-sm"
                  placeholder="Enter invite code"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && joinWithCode()}
                />
              </div>
              <button
                onClick={joinWithCode}
                disabled={inviteLoading || !inviteCode.trim()}
                className="btn-primary disabled:opacity-50"
              >
                Join
              </button>
            </div>
            {inviteError && <p className="text-xs text-discord-red mt-2">{inviteError}</p>}
          </div>

          <div>
            <h3 className="text-sm font-semibold text-discord-text-muted mb-3 uppercase tracking-wide">Discoverable Servers</h3>
            {loading ? (
              <p className="text-sm text-discord-text-muted">Loading…</p>
            ) : servers.length === 0 ? (
              <p className="text-sm text-discord-text-muted">No public servers to join right now.</p>
            ) : (
              <div className="space-y-2">
                {servers.map((server) => {
                  const isJoined = joined.has(server.id);
                  return (
                    <div
                      key={server.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-discord-bg-tertiary border border-discord-border"
                    >
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0"
                        style={{ backgroundColor: getColorFromString(server.id) }}
                      >
                        {server.icon_url ? (
                          <img src={server.icon_url} alt="" className="w-full h-full rounded-full" />
                        ) : (
                          getInitials(server.name)
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{server.name}</p>
                        <p className="text-xs text-discord-text-muted flex items-center gap-1">
                          <Users className="w-3 h-3" /> {server.member_count} members
                        </p>
                        {server.description && (
                          <p className="text-xs text-discord-text-muted truncate mt-0.5">{server.description}</p>
                        )}
                      </div>
                      <button
                        onClick={() => joinServer(server)}
                        disabled={isJoined}
                        className={cn(
                          'flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                          isJoined
                            ? 'bg-discord-green/20 text-discord-green cursor-default'
                            : 'bg-discord-accent text-white hover:bg-[#4752c4]'
                        )}
                      >
                        {isJoined ? (<><Check className="w-4 h-4" /> Joined</>) : (<><Plus className="w-4 h-4" /> Join</>)}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

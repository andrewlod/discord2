import { useState, useEffect } from 'react';
import { X, UserPlus, Check, X as XIcon, Trash2, UserCheck } from 'lucide-react';
import { useFriendStore, useDMStore } from '@/store';
import { getInitials, getColorFromString } from '@/utils';
import type { User } from '@/types';

interface FriendsPanelProps {
  onClose: () => void;
}

type Tab = 'friends' | 'requests' | 'add';

export default function FriendsPanel({ onClose }: FriendsPanelProps) {
  const { friends, incoming, outgoing, fetchFriends, sendRequest, acceptRequest, declineRequest, removeFriend } = useFriendStore();
  const createDM = useDMStore((s) => s.createDM);
  const [tab, setTab] = useState<Tab>('friends');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchFriends().catch(() => {});
  }, [fetchFriends]);

  const submitRequest = async () => {
    const name = username.trim();
    if (!name) return;
    setError('');
    setMessage('');
    try {
      await sendRequest({ username: name });
      setMessage(`Friend request sent to ${name}`);
      setUsername('');
      setTab('requests');
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to send request');
    }
  };

  const avatar = (u: User) => (
    <div
      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0"
      style={{ backgroundColor: getColorFromString(u.id) }}
    >
      {u.avatar_url ? (
        <img src={u.avatar_url} alt="" className="w-full h-full rounded-full" />
      ) : (
        getInitials(u.display_name || u.username)
      )}
    </div>
  );

  const startDM = async (u: User) => {
    try {
      await createDM(u.id);
    } catch {
      /* ignore */
    }
  };

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'friends', label: 'Friends', count: friends.length },
    { key: 'requests', label: 'Requests', count: incoming.length },
    { key: 'add', label: 'Add Friend' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl bg-discord-bg-secondary rounded-lg border border-discord-border overflow-hidden flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-discord-border">
          <h2 className="text-lg font-semibold">Friends</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-discord-bg-tertiary transition-colors">
            <X className="w-5 h-5 text-discord-text-muted" />
          </button>
        </div>

        <div className="flex gap-1 px-4 pt-3 border-b border-discord-border">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                tab === t.key
                  ? 'text-discord-text bg-discord-bg-tertiary'
                  : 'text-discord-text-muted hover:text-discord-text'
              }`}
            >
              {t.label}
              {t.count ? ` (${t.count})` : ''}
            </button>
          ))}
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {tab === 'add' && (
            <div className="space-y-4">
              <p className="text-sm text-discord-text-muted">
                Add a friend by their username. They'll get a request they can accept.
              </p>
              <div className="flex gap-2">
                <input
                  className="input flex-1"
                  placeholder="Username (e.g. cooluser)"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submitRequest()}
                />
                <button onClick={submitRequest} disabled={!username.trim()} className="btn-primary disabled:opacity-50 flex items-center gap-1">
                  <UserPlus className="w-4 h-4" /> Send
                </button>
              </div>
              {error && <p className="text-xs text-discord-red">{error}</p>}
              {message && <p className="text-xs text-discord-green">{message}</p>}
            </div>
          )}

          {tab === 'friends' && (
            <div className="space-y-2">
              {friends.length === 0 ? (
                <p className="text-sm text-discord-text-muted">You have no friends yet. Add some!</p>
              ) : (
                friends.map((f) => (
                  <div key={f.user.id} className="flex items-center gap-3 p-3 rounded-lg bg-discord-bg-tertiary border border-discord-border">
                    {avatar(f.user)}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{f.user.display_name || f.user.username}</p>
                      <p className="text-xs text-discord-text-muted">@{f.user.username}</p>
                    </div>
                    <button
                      onClick={() => startDM(f.user)}
                      className="text-sm px-3 py-1.5 rounded-lg bg-discord-accent/20 text-discord-accent hover:bg-discord-accent/30"
                    >
                      Message
                    </button>
                    <button
                      onClick={() => removeFriend(f.user.id)}
                      title="Remove friend"
                      className="p-2 rounded-lg text-discord-text-muted hover:bg-discord-bg hover:text-discord-red"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {tab === 'requests' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-xs font-semibold text-discord-text-muted uppercase tracking-wide mb-2">
                  Incoming ({incoming.length})
                </h3>
                {incoming.length === 0 ? (
                  <p className="text-sm text-discord-text-muted">No incoming requests.</p>
                ) : (
                  incoming.map((f) => (
                    <div key={f.user.id} className="flex items-center gap-3 p-3 rounded-lg bg-discord-bg-tertiary border border-discord-border mb-2">
                      {avatar(f.user)}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{f.user.display_name || f.user.username}</p>
                        <p className="text-xs text-discord-text-muted">@{f.user.username}</p>
                      </div>
                      <button
                        onClick={() => acceptRequest(f.user.id)}
                        className="p-2 rounded-lg bg-discord-green/20 text-discord-green hover:bg-discord-green/30"
                        title="Accept"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => declineRequest(f.user.id)}
                        className="p-2 rounded-lg text-discord-text-muted hover:bg-discord-bg hover:text-discord-red"
                        title="Decline"
                      >
                        <XIcon className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div>
                <h3 className="text-xs font-semibold text-discord-text-muted uppercase tracking-wide mb-2">
                  Outgoing ({outgoing.length})
                </h3>
                {outgoing.length === 0 ? (
                  <p className="text-sm text-discord-text-muted">No pending requests.</p>
                ) : (
                  outgoing.map((f) => (
                    <div key={f.user.id} className="flex items-center gap-3 p-3 rounded-lg bg-discord-bg-tertiary border border-discord-border mb-2">
                      {avatar(f.user)}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{f.user.display_name || f.user.username}</p>
                        <p className="text-xs text-discord-text-muted flex items-center gap-1">
                          <UserCheck className="w-3 h-3" /> Pending
                        </p>
                      </div>
                      <button
                        onClick={() => removeFriend(f.user.id)}
                        className="p-2 rounded-lg text-discord-text-muted hover:bg-discord-bg hover:text-discord-red"
                        title="Cancel request"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { Phone, Video, Search, Plus } from 'lucide-react';
import { useDMStore, useAuthStore, useCallStore } from '@/store';
import { api } from '@/services/api';
import { normalizeCallResponse } from '@/utils';
import type { User } from '@/types';

export const DMPanel: React.FC = () => {
  const { dms, fetchDMs, createDM } = useDMStore();
  const currentUser = useAuthStore((s) => s.user);
  const setOutgoingCall = useCallStore((s) => s.setOutgoingCall);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    fetchDMs().catch(() => {});
  }, [fetchDMs]);

  const selected = dms.find((d) => d.id === selectedId) || null;

  const otherUser = (dm: (typeof dms)[number]) =>
    dm.participants.find((p) => p.id !== currentUser?.id) || dm.participants[0];

  const startCall = async (targetUserId: string, type: 'voice' | 'video') => {
    try {
      const res = await api.startOneToOneCall(targetUserId, type);
      setOutgoingCall(normalizeCallResponse(res));
    } catch (e) {
      console.error('start call failed', e);
    }
  };

  const runSearch = async (q: string) => {
    setQuery(q);
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const users = await api.searchUsers(q);
      setResults(users || []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const startDMWith = async (user: User) => {
    const dm = await createDM(user.id);
    setSelectedId(dm.id);
    setQuery('');
    setResults([]);
  };

  return (
    <div className="flex h-full w-full">
      <div className="w-64 flex-shrink-0 border-r border-discord-border bg-discord-bg-secondary flex flex-col">
        <div className="p-3 border-b border-discord-border">
          <div className="flex items-center gap-2 text-discord-text-muted">
            <Search className="w-4 h-4" />
            <input
              className="bg-discord-bg-tertiary text-discord-text rounded px-2 py-1 text-sm w-full outline-none"
              placeholder="Find or start a conversation"
              value={query}
              onChange={(e) => runSearch(e.target.value)}
            />
          </div>
          {query && (
            <div className="mt-2 space-y-1">
              {searching && <p className="text-xs text-discord-text-muted">Searching…</p>}
              {!searching && results.length === 0 && (
                <p className="text-xs text-discord-text-muted">No users found.</p>
              )}
              {results.map((u) => (
                <button
                  key={u.id}
                  className="w-full flex items-center gap-2 px-2 py-1 rounded hover:bg-discord-bg-tertiary text-discord-text text-sm"
                  onClick={() => startDMWith(u)}
                >
                  <Plus className="w-4 h-4" />
                  {u.display_name || u.username}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {dms.map((dm) => {
            const u = otherUser(dm);
            return (
              <button
                key={dm.id}
                className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left ${
                  selectedId === dm.id
                    ? 'bg-discord-accent/20 text-discord-text'
                    : 'text-discord-text-muted hover:bg-discord-bg-tertiary'
                }`}
                onClick={() => setSelectedId(dm.id)}
              >
                <div className="w-8 h-8 rounded-full bg-discord-accent flex items-center justify-center text-white text-xs font-semibold">
                  {(u?.display_name || u?.username || '?').slice(0, 2).toUpperCase()}
                </div>
                <span className="truncate text-sm">{u?.display_name || u?.username}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-discord-bg">
        {selected ? (
          <div className="text-center">
            <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-discord-accent flex items-center justify-center text-white text-3xl font-semibold">
              {(otherUser(selected)?.display_name || otherUser(selected)?.username || '?').slice(0, 2).toUpperCase()}
            </div>
            <h2 className="text-discord-text text-xl font-semibold mb-1">
              {otherUser(selected)?.display_name || otherUser(selected)?.username}
            </h2>
            <p className="text-discord-text-muted mb-6">Direct Message</p>
            <div className="flex items-center justify-center gap-3">
              <button
                className="flex items-center gap-2 bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600"
                onClick={() => startCall(otherUser(selected).id, 'voice')}
              >
                <Phone className="w-5 h-5" /> Voice Call
              </button>
              <button
                className="flex items-center gap-2 bg-discord-accent text-white px-4 py-2 rounded-lg hover:bg-[#4752c4]"
                onClick={() => startCall(otherUser(selected).id, 'video')}
              >
                <Video className="w-5 h-5" /> Video Call
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center text-discord-text-muted">
            <p>Select a conversation to start a call, or search for a user above.</p>
          </div>
        )}
      </div>
    </div>
  );
};

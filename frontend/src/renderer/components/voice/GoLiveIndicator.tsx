import React, { useState } from 'react';
import { Radio } from 'lucide-react';
import { useCallStore, useUserDisplay } from '../../store';
import { api } from '../../services/api';
import type { Call } from '../../types';

function StreamLabel({ initiatorId }: { initiatorId: string }) {
  const displayName = useUserDisplay(initiatorId);
  return (
    <p className="text-discord-text-muted text-xs truncate max-w-[160px]">{displayName}</p>
  );
}

export const GoLiveIndicator: React.FC = () => {
  const { liveStreams, removeLiveStream, setActiveCall } = useCallStore();
  const [busyId, setBusyId] = useState<string | null>(null);

  const watch = async (callId: string, roomName: string, channelId: string, initiatorId: string) => {
    setBusyId(callId);
    try {
      const res = await api.getLiveToken(callId);
      const call: Call = {
        id: callId,
        channel_id: channelId,
        initiator_id: initiatorId,
        type: 2,
        livekit_room_name: roomName,
        participants: [],
        max_participants: 0,
        started_at: new Date().toISOString(),
      };
      setActiveCall({
        call,
        token: res.token,
        wsUrl: res.ws_url,
        roomName,
        isLive: true,
        isViewer: true,
      });
    } catch (e) {
      console.error('watch live failed', e);
    } finally {
      setBusyId(null);
    }
  };

  const streams = Array.from(liveStreams.values());
  if (streams.length === 0) return null;

  return (
    <div className="fixed bottom-4 left-4 z-[800] space-y-2">
      {streams.map((s) => (
        <div
          key={s.callId}
          className="flex items-center gap-3 bg-discord-bg-secondary border border-discord-border rounded-lg px-3 py-2 shadow-lg"
        >
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-discord-red opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-discord-red" />
          </span>
          <div className="flex-1">
            <p className="text-discord-text text-sm font-medium">Live now</p>
            <StreamLabel initiatorId={s.initiatorId} />
          </div>
          <button
            className="flex items-center gap-1 bg-discord-red text-white text-sm px-2 py-1 rounded hover:bg-red-600 disabled:opacity-50"
            onClick={() => watch(s.callId, s.roomName, s.channelId, s.initiatorId)}
            disabled={busyId === s.callId}
          >
            <Radio className="w-4 h-4" />
            Watch
          </button>
          <button
            className="text-discord-text-muted hover:text-discord-text text-sm px-1"
            onClick={() => removeLiveStream(s.callId)}
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
};

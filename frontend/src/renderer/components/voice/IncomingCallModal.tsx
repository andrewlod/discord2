import React, { useState } from 'react';
import { Phone, PhoneOff, Video } from 'lucide-react';
import type { Call } from '../../types';
import { useCallStore, useUserDisplay } from '../../store';
import { api } from '../../services/api';
import { getInitials } from '../../utils';

interface IncomingCallModalProps {
  incoming: { call: Call; isLive: boolean };
}

function CallerDisplay({ callId, callerId, isVideo }: { callId: string; callerId: string; isVideo: boolean }) {
  const callerLabel = useUserDisplay(callerId);
  const { setIncomingCall, setActiveCall } = useCallStore();
  const [busy, setBusy] = useState(false);

  const accept = async () => {
    setBusy(true);
    try {
      const res = await api.acceptCall(callId);
      setActiveCall({
        call: res.call,
        token: res.token,
        wsUrl: res.ws_url,
        roomName: res.room_name,
        isLive: false,
        isViewer: false,
      });
      setIncomingCall(null);
    } catch (e) {
      console.error('accept call failed', e);
    } finally {
      setBusy(false);
    }
  };

  const decline = async () => {
    setBusy(true);
    try {
      await api.declineCall(callId);
    } catch {
      /* ignore */
    } finally {
      setIncomingCall(null);
    }
  };

  return (
    <>
      <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-discord-accent flex items-center justify-center text-white text-2xl font-semibold animate-pulse">
        {getInitials(callerLabel)}
      </div>
      <h3 className="text-discord-text font-semibold text-lg">
        Incoming {isVideo ? 'Video ' : ''}Call
      </h3>
      <p className="text-discord-text-muted mb-6">
        {callerLabel} is {isVideo ? 'video ' : ''}calling…
      </p>
      <div className="flex items-center justify-center gap-4">
        <button
          className="w-14 h-14 rounded-full bg-discord-red text-white flex items-center justify-center hover:bg-red-600 disabled:opacity-50"
          onClick={decline}
          disabled={busy}
          aria-label="Decline"
        >
          <PhoneOff className="w-6 h-6" />
        </button>
        <button
          className="w-14 h-14 rounded-full bg-green-500 text-white flex items-center justify-center hover:bg-green-600 disabled:opacity-50"
          onClick={accept}
          disabled={busy}
          aria-label="Accept"
        >
          {isVideo ? <Video className="w-6 h-6" /> : <Phone className="w-6 h-6" />}
        </button>
      </div>
    </>
  );
}

export const IncomingCallModal: React.FC<IncomingCallModalProps> = ({ incoming }) => {
  const isVideo = incoming.call.type === 2;

  return (
    <div className="fixed inset-0 z-[950] flex items-center justify-center bg-black/70">
      <div className="bg-discord-bg-secondary rounded-lg border border-discord-border w-full max-w-sm p-6 text-center">
        <CallerDisplay callId={incoming.call.id} callerId={incoming.call.initiator_id} isVideo={isVideo} />
      </div>
    </div>
  );
};

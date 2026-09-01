import React, { useState } from 'react';
import { PhoneOff } from 'lucide-react';
import type { CallSession } from '../../types';
import { useCallStore, useUserDisplay } from '../../store';
import { api } from '../../services/api';
import { getInitials } from '../../utils';

interface OutgoingCallModalProps {
  outgoing: CallSession;
}

function TargetDisplay({ callId, targetId, isVideo }: { callId: string; targetId: string; isVideo: boolean }) {
  const targetLabel = useUserDisplay(targetId);
  const { setOutgoingCall } = useCallStore();
  const [busy, setBusy] = useState(false);

  const cancel = async () => {
    setBusy(true);
    try {
      await api.endCall(callId);
    } catch {
      /* ignore */
    } finally {
      setOutgoingCall(null);
    }
  };

  return (
    <>
      <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-discord-accent flex items-center justify-center text-white text-2xl font-semibold animate-pulse">
        {getInitials(targetLabel || '?')}
      </div>
      <h3 className="text-discord-text font-semibold text-lg">
        {isVideo ? 'Video ' : 'Voice '}Calling…
      </h3>
      <p className="text-discord-text-muted mb-6">Ringing {targetLabel}…</p>
      <button
        className="w-14 h-14 mx-auto rounded-full bg-discord-red text-white flex items-center justify-center hover:bg-red-600 disabled:opacity-50"
        onClick={cancel}
        disabled={busy}
        aria-label="Cancel call"
      >
        <PhoneOff className="w-6 h-6" />
      </button>
    </>
  );
}

export const OutgoingCallModal: React.FC<OutgoingCallModalProps> = ({ outgoing }) => {
  const isVideo = outgoing.call.type === 2;
  const targetId = outgoing.call.participants.find((p) => p !== outgoing.call.initiator_id) || outgoing.call.channel_id || '';

  return (
    <div className="fixed inset-0 z-[950] flex items-center justify-center bg-black/70">
      <div className="bg-discord-bg-secondary rounded-lg border border-discord-border w-full max-w-sm p-6 text-center">
        <TargetDisplay callId={outgoing.call.id} targetId={targetId} isVideo={isVideo} />
      </div>
    </div>
  );
};

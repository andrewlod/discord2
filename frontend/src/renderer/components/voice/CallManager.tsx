import React, { useEffect, lazy, Suspense } from 'react';
import { ws } from '@/services/websocket';
import { WSOpCode } from '@/types';
import { useCallStore } from '@/store';
import { api } from '@/services/api';
import { normalizeCall, liveStreamFromWs } from '@/utils';
import { IncomingCallModal } from './IncomingCallModal';
import { OutgoingCallModal } from './OutgoingCallModal';
import { GoLiveIndicator } from './GoLiveIndicator';
const CallRoom = lazy(() => import('./CallRoom').then((m) => ({ default: m.CallRoom })));

export const CallManager: React.FC = () => {
  const outgoingCall = useCallStore((s) => s.outgoingCall);
  const incomingCall = useCallStore((s) => s.incomingCall);
  const activeCall = useCallStore((s) => s.activeCall);

  useEffect(() => {
    const unsub = ws.onMessage((msg: any) => {
      const store = useCallStore.getState();
      if (msg.op === WSOpCode.CALL_INCOMING) {
        store.setIncomingCall({ call: normalizeCall(msg.d), isLive: false });
      } else if (msg.op === WSOpCode.CALL_ACTION) {
        const d = msg.d || {};
        if (d.action === 'accept') {
          if (store.outgoingCall && store.outgoingCall.call.id === d.call_id) {
            store.setActiveCall(store.outgoingCall);
            store.setOutgoingCall(null);
          }
        } else if (d.action === 'decline' || d.action === 'end') {
          if (store.outgoingCall && store.outgoingCall.call.id === d.call_id) store.setOutgoingCall(null);
          if (store.activeCall && store.activeCall.call.id === d.call_id) store.setActiveCall(null);
          if (store.incomingCall && store.incomingCall.call.id === d.call_id) store.setIncomingCall(null);
        }
      } else if (msg.op === WSOpCode.STREAM_START) {
        const d = msg.d || {};
        if (d.ended) {
          store.removeLiveStream(d.call_id);
        } else {
          store.addLiveStream(liveStreamFromWs(d));
        }
      }
    });
    return unsub;
  }, []);

  const handleLeave = async () => {
    const store = useCallStore.getState();
    const call = store.activeCall;
    if (!call) return;
    try {
      if (call.isLive && !call.isViewer) {
        await api.endLive(call.call.id);
      }
    } catch {
      /* ignore */
    } finally {
      store.setActiveCall(null);
    }
  };

  return (
    <>
      {incomingCall && <IncomingCallModal incoming={incomingCall} />}
      {outgoingCall && <OutgoingCallModal outgoing={outgoingCall} />}
      {activeCall && (
        <Suspense fallback={null}>
          <CallRoom session={activeCall} onLeave={handleLeave} />
        </Suspense>
      )}
      <GoLiveIndicator />
    </>
  );
};

import React, { useEffect, useMemo, useState, lazy, Suspense } from 'react';
import { Channel } from '../../types';
import { ws } from '../../services/websocket';
import { api } from '../../services/api';
import { useVoiceStore, useCallStore, useUserDisplay } from '../../store';
import { useAuthStore } from '../../store';
const VoiceRoom = lazy(() => import('./VoiceRoom').then((m) => ({ default: m.VoiceRoom })));
import { normalizeCallResponse } from '../../utils';
import './VoiceChannelView.css';

interface VoiceChannelViewProps {
  serverId: string;
  channel: Channel;
}

interface Participant {
  user_id: string;
  self_mute: boolean;
  self_deaf: boolean;
  self_video: boolean;
  self_stream: boolean;
}

function VoiceParticipant({ p, isCurrentUser }: { p: Participant; isCurrentUser: boolean }) {
  const displayName = useUserDisplay(p.user_id);
  return (
    <div className="voice-participant">
      <div className="voice-participant-avatar">
        {p.self_video || p.self_stream ? (
          <div className="voice-video-placeholder">VIDEO</div>
        ) : (
          <div className="voice-avatar-circle">
            {displayName.slice(0, 2).toUpperCase()}
          </div>
        )}
      </div>
      <div className="voice-participant-info">
        <span className="voice-participant-name">
          {isCurrentUser ? 'You' : displayName}
        </span>
        <span className="voice-participant-status">
          {p.self_mute ? 'Muted' : 'Speaking'}
          {p.self_stream ? ' • Streaming' : ''}
        </span>
      </div>
    </div>
  );
}

export const VoiceChannelView: React.FC<VoiceChannelViewProps> = ({ serverId, channel }) => {
  const voiceStates = useVoiceStore((s) => s.voiceStates);
  const connectedChannelId = useVoiceStore((s) => s.connectedChannelId);
  const setConnectedChannel = useVoiceStore((s) => s.setConnectedChannel);
  const currentUser = useAuthStore((s) => s.user);
  const setActiveCall = useCallStore((s) => s.setActiveCall);
  const activeCall = useCallStore((s) => s.activeCall);

  const [token, setToken] = useState<string | null>(null);
  const [wsUrl, setWsUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const inChannel = connectedChannelId === channel.id;

  useEffect(() => {
    ws.selectChannel(channel.id, serverId);

    let cancelled = false;
    api
      .getVoiceStates()
      .then((states) => {
        if (cancelled) return;
        const setVoiceState = useVoiceStore.getState().setVoiceState;
        for (const state of states) {
          if (state.channel_id === channel.id) {
            setVoiceState(state);
          }
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [channel.id, serverId]);

  const participants = useMemo<Participant[]>(() => {
    const result: Participant[] = [];
    voiceStates.forEach((state) => {
      if (state.channel_id === channel.id) {
        result.push({
          user_id: state.user_id,
          self_mute: state.self_mute,
          self_deaf: state.self_deaf,
          self_video: state.self_video,
          self_stream: state.self_stream,
        });
      }
    });
    return result;
  }, [voiceStates, channel.id]);

  const handleJoin = async () => {
    setError(null);
    try {
      const res = await api.getVoiceToken(channel.id);
      ws.updateVoiceState(channel.id, serverId);
      setConnectedChannel(channel.id);
      setToken(res.token);
      setWsUrl(res.ws_url);
    } catch (e: any) {
      setConnectedChannel(null);
      setError(e?.response?.data?.error || 'Failed to join voice channel');
    }
  };

  const handleLeave = () => {
    ws.updateVoiceState(null, serverId);
    setConnectedChannel(null);
    setToken(null);
    setWsUrl(null);
  };

  const handleStartGroupCall = async () => {
    try {
      const res = await api.startGroupCall(channel.id, 'video');
      setActiveCall(normalizeCallResponse(res));
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to start call');
    }
  };

  const handleGoLive = async () => {
    try {
      const res = await api.startLive(channel.id);
      setActiveCall(normalizeCallResponse(res));
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to go live');
    }
  };

  if (inChannel && token && wsUrl && !activeCall) {
    return (
      <Suspense fallback={null}>
        <VoiceRoom token={token} url={wsUrl} onLeave={handleLeave} />
      </Suspense>
    );
  }

  return (
    <div className="voice-channel-view">
      <div className="voice-channel-header">
        <div className="voice-channel-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M11.383 3.07904C11.009 2.92504 10.579 3.01004 10.293 3.29604L6 8.00204H3C2.45 8.00204 2 8.45304 2 9.00204V15.002C2 15.552 2.45 16.002 3 16.002H6L10.293 20.71C10.579 20.996 11.009 21.082 11.383 20.927C11.757 20.772 12 20.407 12 20.002V4.00204C12 3.59904 11.757 3.23204 11.383 3.07904ZM14 5.00195V7.00195C16.757 7.00195 19 9.24595 19 12.002C19 14.759 17.757 17.002 15 17.002V19.002C18.86 19.002 22 15.863 22 12.002C22 8.14295 18.86 5.00195 15 5.00195Z" />
          </svg>
          <span>{channel.name}</span>
        </div>
      </div>

      <div className="voice-channel-body">
        {participants.length === 0 ? (
          <div className="voice-empty">No one is in this voice channel yet.</div>
        ) : (
          <div className="voice-participants">
            {participants.map((p) => (
              <VoiceParticipant key={p.user_id} p={p} isCurrentUser={p.user_id === currentUser?.id} />
            ))}
          </div>
        )}
        {error && <div className="voice-error">{error}</div>}
      </div>

      <div className="voice-channel-footer">
        {inChannel ? (
          <button className="voice-leave-btn" onClick={handleLeave}>
            Disconnect
          </button>
        ) : (
          <button className="voice-join-btn" onClick={handleJoin}>
            Join Voice
          </button>
        )}
        <div className="voice-call-actions">
          <button className="voice-call-btn" onClick={handleStartGroupCall} disabled={!!activeCall}>
            Start Call
          </button>
          <button className="voice-live-btn" onClick={handleGoLive} disabled={!!activeCall}>
            Go Live
          </button>
        </div>
        <div className="voice-note">
          Voice transport uses LiveKit. Set LIVEKIT_API_KEY, LIVEKIT_API_SECRET and LIVEKIT_WS_URL on the backend to enable audio.
        </div>
      </div>
    </div>
  );
};

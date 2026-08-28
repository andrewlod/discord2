import React from 'react';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  GridLayout,
  ParticipantTile,
  ParticipantLoop,
  useParticipants,
  useTracks,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import '@livekit/components-styles';
import type { CallSession } from '../../types';
import { CallType } from '../../types';
import { CallToolbar } from './CallToolbar';

interface CallRoomProps {
  session: CallSession;
  onLeave: () => void;
}

export const CallRoom: React.FC<CallRoomProps> = ({ session, onLeave }) => {
  const isVideo = session.call.type === CallType.VIDEO;
  const title = session.isViewer
    ? 'Watching Live'
    : session.isLive
    ? 'Go Live'
    : isVideo
    ? 'Video Call'
    : 'Voice Call';

  return (
    <div className="fixed inset-0 z-[900] bg-discord-bg flex flex-col">
      <div className="h-12 flex items-center px-4 border-b border-discord-border">
        <span className="font-semibold text-discord-text">{title}</span>
      </div>
      <LiveKitRoom
        token={session.token}
        serverUrl={session.wsUrl}
        connect
        audio
        video={false}
        style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}
      >
        <RoomBody isViewer={session.isViewer} autoShare={session.isLive && !session.isViewer} onLeave={onLeave} />
      </LiveKitRoom>
    </div>
  );
};

function RoomBody({ isViewer, autoShare, onLeave }: { isViewer: boolean; autoShare: boolean; onLeave: () => void }) {
  const participants = useParticipants();
  const tracks = useTracks([Track.Source.Camera, Track.Source.ScreenShare], { onlySubscribed: false });

  return (
    <>
      <RoomAudioRenderer />
      <div className="flex-1 overflow-auto p-4">
        {participants.length === 0 ? (
          <div className="h-full flex items-center justify-center text-discord-text-muted">Connecting…</div>
        ) : (
          <GridLayout tracks={tracks}>
            <ParticipantLoop participants={participants}>
              <ParticipantTile />
            </ParticipantLoop>
          </GridLayout>
        )}
      </div>
      <CallToolbar isViewer={isViewer} autoShare={autoShare} onLeave={onLeave} />
    </>
  );
}

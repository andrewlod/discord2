import React from 'react';
import {
  LiveKitRoom,
  GridLayout,
  ParticipantLoop,
  ParticipantTile,
  RoomAudioRenderer,
  ControlBar,
  useParticipants,
  useTracks,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import '@livekit/components-styles';

interface VoiceRoomProps {
  token: string;
  url: string;
  onLeave: () => void;
}

export const VoiceRoom: React.FC<VoiceRoomProps> = ({ token, url, onLeave }) => {
  return (
    <div className="voice-room">
      <LiveKitRoom
        token={token}
        serverUrl={url}
        connect={true}
        audio={true}
        video={false}
        style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
      >
        <RoomContent onLeave={onLeave} />
      </LiveKitRoom>
    </div>
  );
};

function RoomContent({ onLeave }: { onLeave: () => void }) {
  const participants = useParticipants();
  const tracks = useTracks([Track.Source.Camera, Track.Source.ScreenShare], {
    onlySubscribed: false,
  });

  return (
    <>
      <RoomAudioRenderer />
      <div className="voice-room-grid">
        <GridLayout tracks={tracks}>
          <ParticipantLoop participants={participants}>
            <ParticipantTile />
          </ParticipantLoop>
        </GridLayout>
      </div>
      <div className="voice-room-controls">
        <ControlBar
          variation="minimal"
          controls={{
            microphone: true,
            camera: false,
            screenShare: false,
            chat: false,
            settings: false,
            leave: false,
          }}
        />
        <button className="voice-leave-btn" onClick={onLeave}>
          Disconnect
        </button>
      </div>
    </>
  );
}

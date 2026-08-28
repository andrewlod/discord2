import React, { useEffect, useRef, useState } from 'react';
import { Track } from 'livekit-client';
import { useLocalParticipant } from '@livekit/components-react';
import { Mic, MicOff, Video, VideoOff, MonitorUp, PhoneOff } from 'lucide-react';
import { ScreenSharePicker } from './ScreenSharePicker';

interface CallToolbarProps {
  isViewer: boolean;
  autoShare: boolean;
  onLeave: () => void;
}

export const CallToolbar: React.FC<CallToolbarProps> = ({ isViewer, autoShare, onLeave }) => {
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled, isScreenShareEnabled } = useLocalParticipant();
  const [pickerOpen, setPickerOpen] = useState(false);
  const shareStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (autoShare && !isScreenShareEnabled) {
      setPickerOpen(true);
    }
  }, [autoShare, isScreenShareEnabled]);

  const startShare = async (source: { id: string; name: string } | null) => {
    setPickerOpen(false);
    try {
      let stream: MediaStream;
      const apiAny = (window as any).api;
      if (source && source.id && apiAny?.screen) {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: source.id },
          } as any,
          audio: false,
        });
      } else {
        stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      }
      shareStreamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      await localParticipant.publishTrack(track, { source: Track.Source.ScreenShare });
      track.onended = () => stopShare();
    } catch (e) {
      console.error('[screen] share failed', e);
    }
  };

  const stopShare = async () => {
    const pub = localParticipant.getTrackPublication(Track.Source.ScreenShare);
    if (pub?.track) {
      await localParticipant.unpublishTrack(pub.track);
    }
    shareStreamRef.current?.getTracks().forEach((t) => t.stop());
    shareStreamRef.current = null;
  };

  const toggleShare = () => {
    if (isScreenShareEnabled) {
      stopShare();
    } else {
      setPickerOpen(true);
    }
  };

  return (
    <div className="h-16 flex items-center justify-center gap-3 border-t border-discord-border bg-discord-bg-secondary px-4">
      <button
        className={`p-3 rounded-full transition-colors ${
          isMicrophoneEnabled ? 'bg-discord-bg-tertiary text-discord-text' : 'bg-discord-red text-white'
        }`}
        onClick={() => localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}
        aria-label={isMicrophoneEnabled ? 'Mute' : 'Unmute'}
        disabled={isViewer}
      >
        {isMicrophoneEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
      </button>

      <button
        className={`p-3 rounded-full transition-colors ${
          isCameraEnabled ? 'bg-discord-bg-tertiary text-discord-text' : 'bg-discord-red text-white'
        }`}
        onClick={() => localParticipant.setCameraEnabled(!isCameraEnabled)}
        aria-label={isCameraEnabled ? 'Turn camera off' : 'Turn camera on'}
        disabled={isViewer}
      >
        {isCameraEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
      </button>

      <button
        className={`p-3 rounded-full transition-colors ${
          isScreenShareEnabled ? 'bg-discord-accent text-white' : 'bg-discord-bg-tertiary text-discord-text'
        }`}
        onClick={toggleShare}
        disabled={isViewer}
        aria-label={isScreenShareEnabled ? 'Stop sharing' : 'Share screen'}
      >
        <MonitorUp className="w-5 h-5" />
      </button>

      <button
        className="p-3 rounded-full bg-discord-red text-white hover:bg-red-600 transition-colors"
        onClick={onLeave}
        aria-label="Leave call"
      >
        <PhoneOff className="w-5 h-5" />
      </button>

      {pickerOpen && <ScreenSharePicker onPick={startShare} onCancel={() => setPickerOpen(false)} />}
    </div>
  );
};

import React, { useEffect, useState } from 'react';

export interface ScreenShareChoice {
  id?: string;
  name: string;
  track?: MediaStreamTrack;
}

interface DesktopSource {
  id: string;
  name: string;
  thumbnail: string;
  displayId: string;
}

interface ScreenSharePickerProps {
  onPick: (choice: ScreenShareChoice) => void;
  onCancel: () => void;
}

export const ScreenSharePicker: React.FC<ScreenSharePickerProps> = ({ onPick, onCancel }) => {
  const [sources, setSources] = useState<DesktopSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const hasApi = !!(window as any).api?.screen?.getSources;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        if (hasApi) {
          const srcs = await (window as any).api.screen.getSources(['screen', 'window']);
          if (!cancelled) setSources(srcs as DesktopSource[]);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to list screen sources');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [hasApi]);

  const shareEntireScreen = async () => {
    setError(null);
    setLoading(true);
    try {
      if (hasApi) {
        const screens = await (window as any).api.screen.getSources(['screen']);
        const first = Array.isArray(screens) ? screens[0] : undefined;
        if (first) {
          onPick({ id: first.id, name: first.name });
          return;
        }
      }
      if (!navigator.mediaDevices?.getDisplayMedia) {
        setError('Screen capture is not supported in this environment.');
        return;
      }
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const track = stream.getVideoTracks()[0];
      if (!track) throw new Error('No screen track captured');
      onPick({ name: 'Entire Screen', track });
    } catch (e: any) {
      // User cancelling the picker is expected; only surface real errors.
      if (e?.name !== 'NotAllowedError' && e?.name !== 'AbortError') {
        setError(e?.message || 'Screen capture failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70" onClick={onCancel}>
      <div
        className="bg-discord-bg-secondary rounded-lg border border-discord-border w-full max-w-2xl p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-discord-text font-semibold">Share Your Screen</h3>
          <button className="text-discord-text-muted hover:text-discord-text" onClick={onCancel} aria-label="Close">
            ✕
          </button>
        </div>

        {loading && <div className="text-discord-text-muted py-6 text-center">Loading sources…</div>}

        {!loading && error && (
          <div className="text-discord-red text-sm py-2">{error}</div>
        )}

        {!loading && !error && sources.length === 0 && (
          <div className="text-discord-text-muted py-6 text-center">
            No desktop sources were found.{' '}
            {hasApi
              ? 'Your system may not allow screen capture in this session (e.g. RDP/VM).'
              : 'Running outside the desktop app — you can still share your whole screen below.'}{' '}
            <button className="text-discord-accent underline" onClick={shareEntireScreen}>
              Share entire screen
            </button>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3 max-h-96 overflow-y-auto">
          {sources.map((s) => (
            <button
              key={s.id}
              className="flex flex-col items-center gap-2 p-2 rounded-lg hover:bg-discord-bg-tertiary border border-transparent hover:border-discord-accent"
              onClick={() => onPick({ id: s.id, name: s.name })}
            >
              {s.thumbnail ? (
                <img src={s.thumbnail} alt={s.name} className="w-full h-24 object-cover rounded" />
              ) : (
                <div className="w-full h-24 bg-discord-bg-tertiary rounded" />
              )}
              <span className="text-xs text-discord-text truncate w-full text-center">{s.name}</span>
            </button>
          ))}
        </div>

        {!loading && sources.length > 0 && (
          <div className="mt-3 text-center">
            <button className="text-discord-accent underline text-sm" onClick={shareEntireScreen}>
              Or share entire screen
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

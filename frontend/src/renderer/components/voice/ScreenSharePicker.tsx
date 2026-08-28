import React, { useEffect, useState } from 'react';

interface DesktopSource {
  id: string;
  name: string;
  thumbnail: string;
  displayId: string;
}

interface ScreenSharePickerProps {
  onPick: (source: { id: string; name: string } | null) => void;
  onCancel: () => void;
}

export const ScreenSharePicker: React.FC<ScreenSharePickerProps> = ({ onPick, onCancel }) => {
  const [sources, setSources] = useState<DesktopSource[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const apiAny = (window as any).api;
        if (apiAny?.screen?.getSources) {
          const srcs = await apiAny.screen.getSources(['screen', 'window']);
          if (!cancelled) setSources(srcs as DesktopSource[]);
        }
      } catch (e) {
        console.error('[screen] failed to load sources', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const shareEntireScreen = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const track = stream.getVideoTracks()[0];
      onPick({ id: (track as any).id || '', name: 'Entire Screen' });
    } catch {
      /* user cancelled */
    }
  };

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70"
      onClick={onCancel}
    >
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

        {!loading && sources.length === 0 && (
          <div className="text-discord-text-muted py-6 text-center">
            No desktop sources available.{' '}
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
      </div>
    </div>
  );
};

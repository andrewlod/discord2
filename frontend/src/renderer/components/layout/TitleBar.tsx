import { Minus, Square, X } from 'lucide-react';
import type { CSSProperties } from 'react';

export default function TitleBar() {
  const win = (window as any).api?.window;
  const isElectron = !!win;

  const dragStyle: CSSProperties = { WebkitAppRegion: 'drag' } as unknown as CSSProperties;
  const noDragStyle: CSSProperties = { WebkitAppRegion: 'no-drag' } as unknown as CSSProperties;

  return (
    <div
      className="h-8 flex-shrink-0 flex items-center justify-between bg-discord-bg-tertiary select-none border-b border-discord-border"
      style={dragStyle}
      onDoubleClick={() => win?.maximize()}
    >
      <div className="px-3 text-xs text-discord-text-muted font-semibold tracking-wide">Discord 2</div>
      {isElectron && (
        <div className="flex items-center" style={noDragStyle}>
          <button
            type="button"
            onClick={() => win.minimize()}
            className="w-11 h-8 flex items-center justify-center text-discord-text-muted hover:bg-discord-bg-secondary transition-colors"
            aria-label="Minimize"
          >
            <Minus className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => win.maximize()}
            className="w-11 h-8 flex items-center justify-center text-discord-text-muted hover:bg-discord-bg-secondary transition-colors"
            aria-label="Maximize"
          >
            <Square className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => win.close()}
            className="w-11 h-8 flex items-center justify-center text-discord-text-muted hover:bg-discord-red hover:text-white transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

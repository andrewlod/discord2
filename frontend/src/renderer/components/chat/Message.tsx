import { useState, useRef, useEffect } from 'react';
import { MoreHorizontal, Edit3, Trash2, Copy, Flag, Link, Reply, RotateCcw } from 'lucide-react';
import { cn, formatTime, getInitials, getColorFromString, formatRelativeTime } from '@/utils';

interface MessageProps {
  message: {
    id: string;
    content: string;
    author_id: string;
    author?: { id: string; username: string; display_name?: string; avatar_url?: string; color?: string };
    created_at: string;
    edited_at?: string;
    type: number;
    reference_message_id?: string;
    reference_message?: any;
    attachments: any[];
    reactions: any[];
  };
  currentUserId?: string;
  showAvatar: boolean;
}

export default function Message({ message, currentUserId, showAvatar }: MessageProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isOwn = message.author_id === currentUserId;
  const author = message.author;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const authorColor = author?.color || getColorFromString(author?.id || '');
  const authorName = author?.display_name || author?.username || 'Unknown';

  return (
    <div className={cn('flex gap-3 px-2', showAvatar && 'group')}>
      {showAvatar && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-discord-accent flex items-center justify-center text-white font-medium text-sm overflow-hidden">
          {author?.avatar_url ? (
            <img src={author.avatar_url} alt="" className="w-full h-full object-cover" />
          ) : (
            getInitials(authorName)
          )}
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="font-semibold text-sm" style={{ color: authorColor }}>
            {authorName}
          </span>
          {message.edited_at && (
            <span className="text-xs text-discord-text-muted">(edited)</span>
          )}
          <time className="text-xs text-discord-text-muted" dateTime={message.created_at}>
            {formatTime(message.created_at)}
          </time>
          {isOwn && (
            <span className="flex-1" />
          )}
        </div>

        <div className={cn('mt-0.5', showAvatar ? 'ml-10' : '')}>
          <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>

          {message.reference_message && (
            <div className="mt-2 p-2 bg-discord-bg-tertiary rounded border-l-2 border-discord-accent max-w-md">
              <p className="text-xs font-medium text-discord-text-muted">Replying to {message.reference_message.author?.username || 'Unknown'}</p>
              <p className="text-sm text-discord-text-muted truncate">{message.reference_message.content}</p>
            </div>
          )}

          {message.attachments.length > 0 && (
            <div className="mt-2 grid gap-2 grid-cols-2">
              {message.attachments.map((attachment: any) => (
                <div key={attachment.id} className="relative bg-discord-bg-tertiary rounded overflow-hidden">
                  {attachment.content_type?.startsWith('image/') ? (
                    <img src={attachment.url} alt={attachment.filename} className="w-full h-auto max-h-64 object-cover" />
                  ) : (
                    <div className="p-3 flex items-center gap-2">
                      <svg className="w-6 h-6 text-discord-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M14 2v6h6" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M16 13H8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M16 17H8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M10 9H8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{attachment.filename}</p>
                        <p className="text-xs text-discord-text-muted">{formatFileSize(attachment.size_bytes)}</p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {message.reactions.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {Object.entries(
                message.reactions.reduce((acc: any, r: any) => {
                  acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                  return acc;
                }, {})
              ).map(([emoji, count]) => (
                <button
                  key={emoji}
                  className={cn(
                    'flex items-center gap-1 px-2 py-0.5 rounded-full text-sm transition-colors',
                    'bg-discord-bg-tertiary hover:bg-discord-bg-secondary'
                  )}
                >
                  <span>{emoji}</span>
                  <span className="text-discord-text-muted">{count}</span>
                </button>
              ))}
              <button
                className="flex items-center gap-1 px-2 py-0.5 rounded-full text-sm text-discord-text-muted hover:text-discord-text hover:bg-discord-bg-tertiary"
                onClick={() => setShowReactions(!showReactions)}
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="relative" ref={menuRef}>
          <button
            className="p-1.5 rounded-lg hover:bg-discord-bg-tertiary transition-colors text-discord-text-muted"
            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
            aria-label="Message options"
            aria-expanded={showMenu}
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {showMenu && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-discord-bg-secondary border border-discord-border rounded-lg shadow-lg overflow-hidden z-50">
              <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-discord-text hover:bg-discord-bg-tertiary">
                <Reply className="w-4 h-4" /> Reply
              </button>
              <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-discord-text hover:bg-discord-bg-tertiary">
                <RotateCcw className="w-4 h-4" /> React
              </button>
              <hr className="border-discord-border my-1" />
              {isOwn && (
                <>
                  <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-discord-text hover:bg-discord-bg-tertiary">
                    <Edit3 className="w-4 h-4" /> Edit
                  </button>
                  <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-discord-text hover:bg-discord-bg-tertiary">
                    <Copy className="w-4 h-4" /> Copy Link
                  </button>
                  <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-discord-text hover:bg-discord-bg-tertiary">
                    <Link className="w-4 h-4" /> Copy Message Link
                  </button>
                  <hr className="border-discord-border my-1" />
                  <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-discord-red hover:bg-discord-bg-tertiary">
                    <Trash2 className="w-4 h-4" /> Delete
                  </button>
                </>
              )}
              {!isOwn && (
                <>
                  <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-discord-text hover:bg-discord-bg-tertiary">
                    <Copy className="w-4 h-4" /> Copy Link
                  </button>
                  <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-discord-text hover:bg-discord-bg-tertiary">
                    <Link className="w-4 h-4" /> Copy Message Link
                  </button>
                  <hr className="border-discord-border my-1" />
                  <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-discord-red hover:bg-discord-bg-tertiary">
                    <Flag className="w-4 h-4" /> Report
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
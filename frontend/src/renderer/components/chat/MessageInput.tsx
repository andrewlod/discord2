import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { Send, Paperclip, Mic, Video, Smile, GripVertical, MoreHorizontal, Bold, Italic, Strikethrough, Code, Code2, Quote, List, ListOrdered } from 'lucide-react';
import { cn } from '@/utils';

interface MessageInputProps {
  onSend: (content: string) => void;
  channelId: string;
}

export default function MessageInput({ onSend, channelId }: MessageInputProps) {
  const [content, setContent] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachments, setShowAttachments] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (content.trim()) {
        onSend(content.trim());
        setContent('');
        textareaRef.current?.focus();
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const files = e.clipboardData.files;
    if (files.length > 0) {
      e.preventDefault();
      // Handle file upload
      console.log('Files pasted:', files);
    }
  };

  const adjustHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const height = Math.min(textareaRef.current.scrollHeight, 160);
      textareaRef.current.style.height = `${height}px`;
    }
  };

  useEffect(() => {
    adjustHeight();
  }, [content]);

  return (
    <div className="bg-discord-bg-secondary border-t border-discord-border">
      <div className="flex items-end gap-2 p-3">
        <div className="relative flex-1">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder="Message #channel"
            className={cn(
              'w-full px-4 py-2.5 bg-discord-bg-tertiary border border-discord-border rounded-lg text-discord-text placeholder-discord-text-muted',
              'resize-none focus:outline-none focus:border-discord-accent focus:ring-1 focus:ring-discord-accent',
              'font-medium text-sm leading-relaxed'
            )}
            style={{ minHeight: '44px', maxHeight: '160px' }}
            rows={1}
            spellCheck={true}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
          />

          {content && (
            <div className="absolute bottom-full left-0 mb-1 flex gap-1 px-2 opacity-0 transition-opacity group-hover:opacity-100">
              {[
                { icon: Bold, command: '**', label: 'Bold' },
                { icon: Italic, command: '*', label: 'Italic' },
                { icon: Strikethrough, command: '~~', label: 'Strikethrough' },
                { icon: Code, command: '`', label: 'Inline Code' },
                { icon: Code2, command: '```', label: 'Code Block' },
                { icon: Quote, command: '> ', label: 'Quote' },
                { icon: List, command: '- ', label: 'Bullet List' },
                { icon: ListOrdered, command: '1. ', label: 'Numbered List' },
              ].map(({ icon: Icon, command, label }) => (
                <button
                  key={label}
                  type="button"
                  className="p-1.5 rounded hover:bg-discord-bg-tertiary text-discord-text-muted hover:text-discord-text transition-colors"
                  onClick={(e) => {
                    e.preventDefault();
                    const start = textareaRef.current?.selectionStart || 0;
                    const end = textareaRef.current?.selectionEnd || 0;
                    const before = content.slice(0, start);
                    const selected = content.slice(start, end);
                    const after = content.slice(end);
                    const wrapped = `${command}${selected}${command}`;
                    setContent(before + wrapped + after);
                    setTimeout(() => {
                      textareaRef.current?.focus();
                      if (textareaRef.current) {
                        textareaRef.current.selectionStart = start + command.length;
                        textareaRef.current.selectionEnd = start + command.length + selected.length;
                      }
                    }, 0);
                  }}
                  title={label}
                >
                  <Icon className="w-4 h-4" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            className="p-2 rounded-lg hover:bg-discord-bg-tertiary transition-colors text-discord-text-muted"
            onClick={() => setShowAttachments(!showAttachments)}
            aria-label="Attach files"
          >
            <Paperclip className="w-5 h-5" />
          </button>

          <button
            type="button"
            className="p-2 rounded-lg hover:bg-discord-bg-tertiary transition-colors text-discord-text-muted"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            aria-label="Add emoji"
          >
            <Smile className="w-5 h-5" />
          </button>

          <button
            type="button"
            className="p-2 rounded-lg hover:bg-discord-bg-tertiary transition-colors text-discord-text-muted"
            aria-label="Gift Nitro"
          >
            <Gift className="w-5 h-5" />
          </button>

          <button
            type="button"
            disabled={!content.trim()}
            onClick={() => { onSend(content.trim()); setContent(''); }}
            className={cn(
              'p-2 rounded-lg transition-colors flex-shrink-0',
              content.trim()
                ? 'bg-discord-accent text-white hover:bg-discord-accent-hover'
                : 'text-discord-text-muted cursor-not-allowed'
            )}
            aria-label="Send message"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>

      {showEmojiPicker && (
        <div className="absolute bottom-full left-3 right-3 mb-2 bg-discord-bg-secondary border border-discord-border rounded-lg shadow-lg p-4 z-10">
          <div className="flex gap-1 mb-2 overflow-x-auto pb-2">
            {['😀', '😂', '😍', '😭', '😡', '👍', '👎', '🎉', '🔥', '✨', '💯', '🤔', '😴', '🤯', '🥳', '😎'].map(emoji => (
              <button
                key={emoji}
                type="button"
                className="p-2 text-2xl hover:bg-discord-bg-tertiary rounded"
                onClick={() => setContent(content + emoji)}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

import { Gift } from 'lucide-react';
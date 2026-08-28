interface TypingIndicatorProps {
  users: string[];
}

export default function TypingIndicator({ users }: TypingIndicatorProps) {
  if (users.length === 0) return null;

  const text = users.length === 1
    ? `${users[0]} is typing...`
    : users.length === 2
    ? `${users[0]} and ${users[1]} are typing...`
    : `${users[0]} and ${users.length - 1} others are typing...`;

  return (
    <div className="flex items-center gap-2 px-2 py-1 text-xs text-discord-text-muted">
      <span className="flex items-center gap-1">
        <span className="w-1.5 h-1.5 bg-discord-text-muted rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-1.5 h-1.5 bg-discord-text-muted rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-1.5 h-1.5 bg-discord-text-muted rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </span>
      <span>{text}</span>
    </div>
  );
}
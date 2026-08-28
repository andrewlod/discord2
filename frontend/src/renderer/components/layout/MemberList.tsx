import { Search, User, Bot, Crown, Shield } from 'lucide-react';
import { cn, getInitials, getColorFromString, getStatusColor } from '@/utils';

interface MemberListProps {
  serverId: string;
}

export default function MemberList({ serverId }: MemberListProps) {
  // Mock members for now - would come from store in real implementation
  const members = [
    { id: '1', username: 'User1', display_name: 'User One', avatar_url: undefined, status: 'online', roles: ['admin'] },
    { id: '2', username: 'User2', display_name: 'User Two', avatar_url: undefined, status: 'idle', roles: ['mod'] },
    { id: '3', username: 'User3', display_name: 'User Three', avatar_url: undefined, status: 'dnd', roles: [] },
    { id: '4', username: 'User4', display_name: 'User Four', avatar_url: undefined, status: 'offline', roles: [] },
    { id: '5', username: 'Bot1', display_name: 'Cool Bot', avatar_url: undefined, status: 'online', roles: ['bot'] },
  ];

  return (
    <aside className="w-56 flex-shrink-0 bg-discord-bg-secondary border-l border-discord-border flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-discord-border">
        <span className="text-xs font-semibold text-discord-text-muted uppercase tracking-wider">Members</span>
        <span className="text-xs text-discord-text-muted">{members.length}</span>
      </div>

      <div className="px-3 py-2">
        <input
          type="text"
          placeholder="Search members..."
          className="w-full px-3 py-1.5 bg-discord-bg-tertiary border border-discord-border rounded-md text-sm text-discord-text placeholder-discord-text-muted focus:outline-none focus:border-discord-accent"
        />
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-1" role="navigation" aria-label="Member list">
        {members.map(member => {
          const isBot = member.roles.includes('bot');
          const isAdmin = member.roles.includes('admin');
          const isMod = member.roles.includes('mod');
          const color = getColorFromString(member.id);

          return (
            <button
              key={member.id}
              className={cn(
                'w-full flex items-center gap-3 px-2 py-1.5 rounded-md text-sm transition-colors hover:bg-discord-bg-tertiary',
                'text-discord-text'
              )}
            >
              <div className="relative flex-shrink-0">
                <div className={cn('w-8 h-8 rounded-full flex items-center justify-center font-medium text-sm', isBot ? 'bg-discord-purple' : '')} style={{ backgroundColor: isBot ? undefined : color }}>
                  {member.avatar_url ? (
                    <img src={member.avatar_url} alt="" className="w-full h-full rounded-full" />
                  ) : (
                    getInitials(member.display_name || member.username)
                  )}
                </div>
                <div className={cn(
                  'absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-discord-bg-secondary',
                  getStatusColor(member.status)
                )} />
                {isBot && (
                  <div className="absolute top-0 left-0 w-2.5 h-2.5 rounded-full border-2 border-discord-bg-secondary bg-discord-purple" />
                )}
              </div>
              <div className="flex-1 min-w-0 flex items-center gap-1">
                <span className="font-medium truncate">{member.display_name || member.username}</span>
                {isAdmin && <Crown className="w-3.5 h-3.5 text-yellow-500" />}
                {isMod && !isAdmin && <Shield className="w-3.5 h-3.5 text-blue-500" />}
                {isBot && <Bot className="w-3.5 h-3.5 text-purple-500" />}
              </div>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
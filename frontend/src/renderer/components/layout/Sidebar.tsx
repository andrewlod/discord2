import { useState } from 'react';
import { Plus, X, LogOut, Settings, User, Search, Bell, HelpCircle, ChevronDown, ChevronUp, MessageSquare } from 'lucide-react';
import { useServerStore, useAuthStore, useUISettingsStore } from '@/store';
import { cn, getInitials, getColorFromString } from '@/utils';
import ServerIcon from '@/components/server/ServerIcon';
import CreateServerModal from '@/components/server/CreateServerModal';

interface SidebarProps {
  servers: Array<{ id: string; name: string; icon_url?: string }>;
  currentServerId: string | null;
  onServerSelect: (serverId: string) => void;
  dmMode: boolean;
  onToggleDM: () => void;
  collapsed: boolean;
  mobileOpen: boolean;
  onMobileClose: () => void;
  user: any;
}

export default function Sidebar({ servers, currentServerId, onServerSelect, dmMode, onToggleDM, collapsed, mobileOpen, onMobileClose, user }: SidebarProps) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const { toggleSidebar } = useUISettingsStore();
  const { logout } = useAuthStore();

  if (!mobileOpen && collapsed) {
    return (
      <aside className="w-12 flex-shrink-0 bg-discord-bg-tertiary border-r border-discord-border flex flex-col">
        <div className="flex h-12 items-center justify-center border-b border-discord-border">
          <button
            className="p-2 rounded-lg hover:bg-discord-bg-secondary transition-colors"
            onClick={toggleSidebar}
            aria-label="Expand sidebar"
          >
            <ChevronRight className="w-5 h-5 text-discord-text-muted" />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto px-1 py-2 space-y-1" role="navigation" aria-label="Servers">
          <button
            className={cn(
              'w-10 h-10 rounded-lg flex items-center justify-center mx-auto transition-all',
              dmMode
                ? 'bg-discord-accent/20 ring-2 ring-discord-accent text-discord-text'
                : 'hover:bg-discord-bg-secondary text-discord-text-muted'
            )}
            onClick={onToggleDM}
            aria-label="Direct Messages"
            aria-current={dmMode ? 'page' : undefined}
          >
            <MessageSquare className="w-5 h-5" />
          </button>
          {servers.map((server) => (
            <button
              key={server.id}
              className={cn(
                'w-10 h-10 rounded-lg flex items-center justify-center mx-auto transition-all',
                currentServerId === server.id
                  ? 'bg-discord-accent/20 ring-2 ring-discord-accent'
                  : 'hover:bg-discord-bg-secondary'
              )}
              onClick={() => onServerSelect(server.id)}
              aria-label={server.name}
              aria-current={currentServerId === server.id ? 'page' : undefined}
            >
              <ServerIcon server={server} size={40} />
            </button>
          ))}
        </nav>
        <div className="p-1 border-t border-discord-border">
          <button
            className={cn('w-10 h-10 rounded-lg flex items-center justify-center mx-auto transition-colors', 'hover:bg-discord-bg-secondary')}
            onClick={() => setShowCreateModal(true)}
            aria-label="Add a server"
          >
            <Plus className="w-5 h-5 text-discord-text-muted" />
          </button>
        </div>
        {showCreateModal && (
          <CreateServerModal onClose={() => setShowCreateModal(false)} />
        )}
      </aside>
    );
  }

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'fixed lg:relative z-50 flex flex-col bg-discord-bg-tertiary border-r border-discord-border transition-width duration-200',
          collapsed ? 'w-12' : 'w-72',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
        role="navigation"
        aria-label="Server list"
      >
        <div className="flex h-12 items-center justify-between px-3 border-b border-discord-border">
          {collapsed ? (
            <button
              className="p-2 rounded-lg hover:bg-discord-bg-secondary transition-colors"
              onClick={toggleSidebar}
              aria-label="Expand sidebar"
            >
              <ChevronRight className="w-5 h-5 text-discord-text-muted" />
            </button>
          ) : (
            <>
              <button
                className="p-2 rounded-lg hover:bg-discord-bg-secondary transition-colors"
                onClick={toggleSidebar}
                aria-label="Collapse sidebar"
              >
                <ChevronLeft className="w-5 h-5 text-discord-text-muted" />
              </button>
              <button
                className="p-2 rounded-lg hover:bg-discord-bg-secondary transition-colors"
                onClick={() => setShowCreateModal(true)}
                aria-label="Add a server"
              >
                <Plus className="w-5 h-5 text-discord-text" />
              </button>
            </>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-1" role="list" aria-label="Servers">
          <button
            role="listitem"
            className={cn(
              'w-full rounded-lg flex items-center gap-3 px-2 py-1.5 transition-colors',
              dmMode
                ? 'bg-discord-accent/20 text-discord-text ring-1 ring-discord-accent'
                : 'text-discord-text-muted hover:text-discord-text hover:bg-discord-bg-secondary'
            )}
            onClick={() => { onToggleDM(); onMobileClose(); }}
            aria-current={dmMode ? 'page' : undefined}
          >
            <span className="w-10 h-10 rounded-full bg-discord-bg-tertiary flex items-center justify-center">
              <MessageSquare className="w-5 h-5" />
            </span>
            {!collapsed && (
              <span className="flex-1 truncate font-medium text-sm">Direct Messages</span>
            )}
          </button>

          {servers.map((server) => (
            <button
              key={server.id}
              role="listitem"
              className={cn(
                'w-full rounded-lg flex items-center gap-3 px-2 py-1.5 transition-colors',
                currentServerId === server.id
                  ? 'bg-discord-accent/10 text-discord-text'
                  : 'text-discord-text-muted hover:text-discord-text hover:bg-discord-bg-secondary'
              )}
              onClick={() => { onServerSelect(server.id); onMobileClose(); }}
              aria-current={currentServerId === server.id ? 'page' : undefined}
            >
              <ServerIcon server={server} size={40} />
              {!collapsed && (
                <span className="flex-1 truncate font-medium text-sm">{server.name}</span>
              )}
            </button>
          ))}
        </nav>

        {!collapsed && (
          <div className="p-2 border-t border-discord-border space-y-1">
            <button
              className={cn('w-full rounded-lg flex items-center gap-3 px-2 py-1.5 transition-colors', 'text-discord-text-muted hover:text-discord-text hover:bg-discord-bg-secondary')}
              onClick={() => { setShowCreateModal(true); onMobileClose(); }}
            >
              <Plus className="w-5 h-5" />
              <span className="font-medium text-sm">Add a Server</span>
            </button>
            <button
              className={cn('w-full rounded-lg flex items-center gap-3 px-2 py-1.5 transition-colors', 'text-discord-text-muted hover:text-discord-text hover:bg-discord-bg-secondary')}
              onClick={() => { setShowCreateModal(true); onMobileClose(); }}
            >
              <Search className="w-5 h-5" />
              <span className="font-medium text-sm">Explore Public Servers</span>
            </button>
          </div>
        )}

        {!collapsed && (
          <div className="p-2 border-t border-discord-border">
            <div className="flex items-center gap-3 px-2 py-1.5">
              <div className="relative">
                <div className="w-8 h-8 rounded-full bg-discord-accent flex items-center justify-center text-white font-medium text-sm">
                  {user?.avatar_url ? (
                    <img src={user.avatar_url} alt="" className="w-full h-full rounded-full" />
                  ) : (
                    getInitials(user?.username || user?.display_name || 'User')
                  )}
                </div>
                <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-discord-bg-tertiary bg-green-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{user?.display_name || user?.username}</p>
                <p className="text-xs text-discord-text-muted truncate">@{user?.username}</p>
              </div>
              <button
                className="p-1.5 rounded-lg hover:bg-discord-bg-secondary transition-colors text-discord-text-muted"
                onClick={() => setShowUserMenu(!showUserMenu)}
                aria-expanded={showUserMenu}
                aria-haspopup="true"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>

            {showUserMenu && (
              <div className="mt-1 rounded-lg bg-discord-bg-secondary border border-discord-border overflow-hidden">
                <button
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-discord-text hover:bg-discord-bg-tertiary"
                  onClick={() => { setShowUserMenu(false); }}
                >
                  <User className="w-4 h-4" />
                  Profile
                </button>
                <button
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-discord-text hover:bg-discord-bg-tertiary"
                  onClick={() => { setShowUserMenu(false); }}
                >
                  <Settings className="w-4 h-4" />
                  User Settings
                </button>
                <hr className="border-discord-border my-1" />
                <button
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-discord-red hover:bg-discord-bg-tertiary"
                  onClick={logout}
                >
                  <LogOut className="w-4 h-4" />
                  Log Out
                </button>
              </div>
            )}
          </div>
        )}
      </aside>

      {showCreateModal && (
        <CreateServerModal onClose={() => setShowCreateModal(false)} />
      )}
    </>
  );
}

import { ChevronLeft, ChevronRight } from 'lucide-react';
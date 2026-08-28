import { useState } from 'react';
import { User, Key, Bell, Palette, Mic, Video, Monitor, Shield, LogOut } from 'lucide-react';
import { useAuthStore, useUISettingsStore } from '@/store';
import { api } from '@/services/api';
import { cn, VIDEO_QUALITY_OPTIONS } from '@/utils';
import { VIDEO_QUALITY_PRESETS } from '@/types';

const settingsSections = [
  { id: 'profile', label: 'My Account', icon: User },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'voice', label: 'Voice & Video', icon: Mic },
];

export default function Settings() {
  const { user, updateMe, logout } = useAuthStore();
  const { theme, setTheme, compactMode, toggleCompactMode } = useUISettingsStore();
  const [activeSection, setActiveSection] = useState('profile');
  const [videoQuality, setVideoQuality] = useState(user?.video_quality || '720p');
  const [noiseSuppression, setNoiseSuppression] = useState(user?.noise_suppression ?? true);
  const [echoCancellation, setEchoCancellation] = useState(user?.echo_cancellation ?? true);
  const [autoGainControl, setAutoGainControl] = useState(user?.auto_gain_control ?? true);

  const handleVideoQualityChange = async (quality: string) => {
    setVideoQuality(quality);
    try {
      await api.updateMe({ video_quality: quality });
    } catch (e) {
      console.error('Failed to update video quality:', e);
    }
  };

  const handleNoiseSuppressionChange = async (enabled: boolean) => {
    setNoiseSuppression(enabled);
    try {
      await api.updateMe({ noise_suppression: enabled });
    } catch (e) {
      console.error('Failed to update noise suppression:', e);
    }
  };

  const handleEchoCancellationChange = async (enabled: boolean) => {
    setEchoCancellation(enabled);
    try {
      await api.updateMe({ echo_cancellation: enabled });
    } catch (e) {
      console.error('Failed to update echo cancellation:', e);
    }
  };

  const handleAutoGainControlChange = async (enabled: boolean) => {
    setAutoGainControl(enabled);
    try {
      await api.updateMe({ auto_gain_control: enabled });
    } catch (e) {
      console.error('Failed to update auto gain control:', e);
    }
  };

  const renderSection = () => {
    switch (activeSection) {
      case 'profile':
        return (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold">My Account</h2>
            <div className="card p-6 space-y-4">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-24 h-24 rounded-full bg-discord-accent flex items-center justify-center text-white font-bold text-2xl overflow-hidden">
                    {user?.avatar_url ? (
                      <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      user?.display_name || user?.username?.charAt(0).toUpperCase()
                    )}
                  </div>
                  <button className="absolute bottom-0 right-0 p-1.5 bg-discord-accent text-white rounded-full hover:bg-discord-accent-hover transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5a2.121 2.121 0 0 1 3 3z" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{user?.display_name || user?.username}</h3>
                  <p className="text-discord-text-muted">@{user?.username}</p>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium mb-1">Email</label>
                  <input type="email" value={user?.email} readOnly className="input bg-discord-bg-tertiary" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Display Name</label>
                  <input type="text" defaultValue={user?.display_name || ''} className="input" />
                </div>
              </div>
            </div>
          </div>
        );

      case 'security':
        return (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold">Security</h2>
            <div className="card p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Two-Factor Authentication</h3>
                  <p className="text-sm text-discord-text-muted">Add an extra layer of security to your account</p>
                </div>
                <button className="btn-secondary">Enable</button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Password</h3>
                  <p className="text-sm text-discord-text-muted">Change your password</p>
                </div>
                <button className="btn-secondary">Change</button>
              </div>
            </div>
          </div>
        );

      case 'notifications':
        return (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold">Notifications</h2>
            <div className="card p-6 space-y-4">
              <label className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Enable Notifications</h3>
                  <p className="text-sm text-discord-text-muted">Receive desktop notifications</p>
                </div>
                <input type="checkbox" defaultChecked className="w-5 h-5 rounded border-discord-border bg-discord-bg-tertiary text-discord-accent focus:ring-discord-accent" />
              </label>
              <label className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Message Notifications</h3>
                  <p className="text-sm text-discord-text-muted">Notify for all messages</p>
                </div>
                <input type="checkbox" className="w-5 h-5 rounded border-discord-border bg-discord-bg-tertiary text-discord-accent focus:ring-discord-accent" />
              </label>
            </div>
          </div>
        );

      case 'appearance':
        return (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold">Appearance</h2>
            <div className="card p-6 space-y-4">
              <div>
                <h3 className="font-medium mb-3">Theme</h3>
                <div className="flex gap-4">
                  {['dark', 'light'].map(t => (
                    <button
                      key={t}
                      onClick={() => setTheme(t as any)}
                      className={cn(
                        'flex-1 p-4 rounded-lg border-2 transition-colors flex flex-col items-center gap-2',
                        theme === t ? 'border-discord-accent bg-discord-accent/10' : 'border-discord-border hover:border-discord-text-muted'
                      )}
                    >
                      <span className="text-lg capitalize">{t}</span>
                      <span className="text-xs text-discord-text-muted">Mode</span>
                    </button>
                  ))}
                </div>
              </div>
              <label className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Compact Mode</h3>
                  <p className="text-sm text-discord-text-muted">Reduce spacing between messages</p>
                </div>
                <input
                  type="checkbox"
                  checked={compactMode}
                  onChange={toggleCompactMode}
                  className="w-5 h-5 rounded border-discord-border bg-discord-bg-tertiary text-discord-accent focus:ring-discord-accent"
                />
              </label>
            </div>
          </div>
        );

      case 'voice':
        return (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold">Voice & Video</h2>
            <div className="card p-6 space-y-6">
              <div>
                <h3 className="font-medium mb-3">Video Quality</h3>
                <div className="flex flex-wrap gap-2">
                  {VIDEO_QUALITY_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => handleVideoQualityChange(opt.value)}
                      className={cn(
                        'px-4 py-2 rounded-lg border-2 text-sm font-medium transition-colors',
                        videoQuality === opt.value
                          ? 'border-discord-accent bg-discord-accent/10 text-discord-accent'
                          : 'border-discord-border text-discord-text hover:border-discord-text-muted'
                      )}
                    >
                      <div className="font-medium">{opt.label}</div>
                      <div className="text-xs text-discord-text-muted">{opt.bandwidth} bandwidth</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t border-discord-border pt-6">
                <h3 className="font-medium mb-3">Audio Processing</h3>
                <div className="space-y-4">
                  <label className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Noise Suppression</h4>
                      <p className="text-sm text-discord-text-muted">Remove background noise</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={noiseSuppression}
                      onChange={(e) => handleNoiseSuppressionChange(e.target.checked)}
                      className="w-5 h-5 rounded border-discord-border bg-discord-bg-tertiary text-discord-accent focus:ring-discord-accent"
                    />
                  </label>
                  <label className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Echo Cancellation</h4>
                      <p className="text-sm text-discord-text-muted">Remove echo from your microphone</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={echoCancellation}
                      onChange={(e) => handleEchoCancellationChange(e.target.checked)}
                      className="w-5 h-5 rounded border-discord-border bg-discord-bg-tertiary text-discord-accent focus:ring-discord-accent"
                    />
                  </label>
                  <label className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Automatic Gain Control</h4>
                      <p className="text-sm text-discord-text-muted">Automatically adjust microphone volume</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={autoGainControl}
                      onChange={(e) => handleAutoGainControlChange(e.target.checked)}
                      className="w-5 h-5 rounded border-discord-border bg-discord-bg-tertiary text-discord-accent focus:ring-discord-accent"
                    />
                  </label>
                </div>
              </div>

              <div className="border-t border-discord-border pt-6">
                <h3 className="font-medium mb-3">Input/Output Devices</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium mb-1">Input Device</label>
                    <select className="input">
                      <option>Default - Microphone</option>
                      <option>Microphone (Built-in)</option>
                      <option>Headset Microphone</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Output Device</label>
                    <select className="input">
                      <option>Default - Speakers</option>
                      <option>Speakers (Built-in)</option>
                      <option>Headphones</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto">
      <div className="flex gap-6">
        <nav className="w-48 flex-shrink-0 bg-discord-bg-secondary rounded-lg border border-discord-border p-4 space-y-1">
          {settingsSections.map(section => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                activeSection === section.id
                  ? 'bg-discord-accent/10 text-discord-accent'
                  : 'text-discord-text-muted hover:text-discord-text hover:bg-discord-bg-tertiary'
              )}
            >
              <section.icon className="w-5 h-5" />
              {section.label}
            </button>
          ))}
        </nav>

        <div className="flex-1 min-w-0">
          {renderSection()}

          <div className="mt-8 pt-6 border-t border-discord-border">
            <button
              onClick={logout}
              className="btn-danger flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Log Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
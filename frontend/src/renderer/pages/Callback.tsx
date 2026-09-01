import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

export default function Callback() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');

    if (accessToken && refreshToken) {
      window.history.replaceState({}, '', '/');
    }
  }, []);

  return (
    <div className="h-full flex items-center justify-center bg-discord-bg">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-10 h-10 text-discord-accent animate-spin" />
        <p className="text-discord-text-muted">Completing sign in...</p>
      </div>
    </div>
  );
}
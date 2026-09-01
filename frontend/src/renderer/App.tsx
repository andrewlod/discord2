import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuthStore, useServerStore } from './store';
import { api } from './services/api';
import { ws } from './services/websocket';
import Layout from './components/layout/AppShell';
import TitleBar from './components/layout/TitleBar';
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import Settings from './pages/Settings';
import Callback from './pages/Callback';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (isAuthenticated) {
      useServerStore.getState().fetchServers().catch(console.error);
    }
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function App() {
  useEffect(() => {
    const handleAuthCallback = async () => {
      const params = new URLSearchParams(window.location.search);
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');

      if (accessToken && refreshToken) {
        api.setTokens({ access_token: accessToken, refresh_token: refreshToken, expires_in: 900 });
        const user = await api.getMe();
        useAuthStore.getState().setUser(user);
        window.history.replaceState({}, '', '/');
      }
    };

    handleAuthCallback();
  }, []);

  useEffect(() => {
    const tryConnect = () => {
      const { isAuthenticated, accessToken } = useAuthStore.getState();
      if (isAuthenticated && accessToken) {
        ws.connect(accessToken).catch(console.error);
      }
    };

    tryConnect();
    const unsubscribe = useAuthStore.subscribe(tryConnect);

    return () => {
      unsubscribe();
      ws.disconnect();
    };
  }, []);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-discord-bg">
      <TitleBar />
      <div className="flex-1 min-h-0">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/auth/callback" element={<Callback />} />
          <Route
            path="/*"
            element={
              <PrivateRoute>
                <Layout />
              </PrivateRoute>
            }
          >
            <Route index element={<Home />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </div>
    </div>
  );
}

export default App;
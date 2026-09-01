import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, User, Eye, EyeOff, Chrome } from 'lucide-react';
import { useAuthStore } from '@/store';
import { api } from '@/services/api';
import { cn } from '@/utils';

export default function Register() {
  const navigate = useNavigate();
  const { register } = useAuthStore();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await register(email, username, password);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = api.getGoogleAuthUrl();
  };

  return (
    <div className="h-full flex items-center justify-center bg-discord-bg p-4">
      <div className="w-full max-w-md bg-discord-bg-secondary rounded-lg border border-discord-border p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold">Create an Account</h1>
          <p className="text-discord-text-muted mt-1">Join Discord 2 today</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-discord-red/10 border border-discord-red/20 rounded-lg text-sm text-discord-red">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-discord-text-muted" />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="input pl-10"
                required
                autoComplete="email"
              />
            </div>
          </div>

          <div>
            <label htmlFor="username" className="block text-sm font-medium mb-1">Username</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-discord-text-muted" />
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="username"
                className="input pl-10 lowercase"
                required
                minLength={2}
                maxLength={32}
                autoComplete="username"
              />
            </div>
            <p className="text-xs text-discord-text-muted mt-1">2-32 characters, alphanumeric only</p>
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-discord-text-muted" />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="input pl-10 pr-10"
                required
                minLength={8}
                maxLength={128}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-discord-text-muted hover:text-discord-text"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            <p className="text-xs text-discord-text-muted mt-1">At least 8 characters</p>
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-discord-border" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-discord-bg-secondary text-discord-text-muted">Or continue with</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          className="btn-secondary w-full py-2.5 flex items-center justify-center gap-2"
        >
          <Chrome className="w-5 h-5" />
          Continue with Google
        </button>

        <p className="text-center text-sm text-discord-text-muted mt-6">
          Already have an account? <Link to="/login" className="text-discord-accent hover:underline font-medium">Login</Link>
        </p>
      </div>
    </div>
  );
}
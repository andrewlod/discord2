import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import type { TokenPair, User, Server, Channel, Message, DMChannel, LiveKitTokenResponse, CallStartResponse, CallAcceptResponse, TokenResponse } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8080';

class ApiService {
  private client: AxiosInstance;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private refreshPromise: Promise<TokenPair> | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: `${API_URL}/api/v1`,
      headers: {
        'Content-Type': 'application/json',
      },
      withCredentials: true,
    });

    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        if (this.accessToken && config.headers) {
          config.headers.Authorization = `Bearer ${this.accessToken}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

        if (error.response?.status === 401 && !originalRequest._retry && this.refreshToken) {
          originalRequest._retry = true;

          try {
            const tokens = await this.refreshAccessToken();
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${tokens.access_token}`;
            }
            return this.client(originalRequest);
          } catch {
            this.clearTokens();
            window.location.href = '/login';
            return Promise.reject(error);
          }
        }

        return Promise.reject(error);
      }
    );

    this.loadTokens();
  }

  private loadTokens() {
    const stored = localStorage.getItem('auth_tokens');
    if (stored) {
      try {
        const tokens = JSON.parse(stored);
        this.accessToken = tokens.access_token;
        this.refreshToken = tokens.refresh_token;
      } catch {
        this.clearTokens();
      }
    }
  }

  private saveTokens(tokens: TokenPair) {
    this.accessToken = tokens.access_token;
    this.refreshToken = tokens.refresh_token;
    localStorage.setItem('auth_tokens', JSON.stringify(tokens));
  }

  private clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
    localStorage.removeItem('auth_tokens');
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  getRefreshToken(): string | null {
    return this.refreshToken;
  }

  isAuthenticated(): boolean {
    return !!this.accessToken;
  }

  setTokens(tokens: TokenPair) {
    this.saveTokens(tokens);
  }

  async refreshAccessToken(): Promise<TokenPair> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    if (!this.refreshToken) {
      throw new Error('No refresh token');
    }

    this.refreshPromise = (async () => {
      const response = await axios.post(`${API_URL}/api/v1/auth/refresh`, {
        refresh_token: this.refreshToken,
      });
      const tokens = response.data.tokens;
      this.saveTokens(tokens);
      return tokens;
    })();

    try {
      return await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  async register(email: string, username: string, password: string): Promise<{ user: User; tokens: TokenPair }> {
    const response = await this.client.post('/auth/register', { email, username, password });
    this.saveTokens(response.data.tokens);
    return response.data;
  }

  async login(email: string, password: string): Promise<{ user: User; tokens: TokenPair }> {
    const response = await this.client.post('/auth/login', { email, password });
    this.saveTokens(response.data.tokens);
    return response.data;
  }

  async logout(): Promise<void> {
    if (this.refreshToken) {
      await this.client.post('/auth/logout', { refresh_token: this.refreshToken });
    }
    this.clearTokens();
  }

  async getMe(): Promise<User> {
    const response = await this.client.get('/auth/me');
    return response.data;
  }

  async updateMe(data: Partial<User>): Promise<User> {
    const response = await this.client.patch('/auth/me', data);
    return response.data;
  }

  getGoogleAuthUrl(): string {
    return `${API_URL}/api/v1/auth/google`;
  }

  async searchUsers(query: string): Promise<User[]> {
    const response = await this.client.get('/users/search', { params: { q: query } });
    return response.data;
  }

  async getServers(): Promise<Server[]> {
    const response = await this.client.get('/servers');
    return response.data;
  }

  async createServer(name: string, description?: string): Promise<{ id: string }> {
    const response = await this.client.post('/servers', { name, description });
    return response.data;
  }

  async getServer(id: string): Promise<Server> {
    const response = await this.client.get(`/servers/${id}`);
    return response.data;
  }

  async getChannels(serverId: string): Promise<Channel[]> {
    const response = await this.client.get(`/servers/${serverId}/channels`);
    return response.data;
  }

  async createChannel(serverId: string, data: { type: number; name: string; topic?: string; parent_id?: string }): Promise<{ id: string }> {
    const response = await this.client.post(`/servers/${serverId}/channels`, data);
    return response.data;
  }

  async getMessages(channelId: string, before?: string, limit = 50): Promise<Message[]> {
    const params = new URLSearchParams();
    if (before) params.append('before', before);
    params.append('limit', limit.toString());
    const response = await this.client.get(`/channels/${channelId}/messages?${params}`);
    return response.data;
  }

  async sendMessage(channelId: string, content: string): Promise<Message> {
    const response = await this.client.post(`/channels/${channelId}/messages`, { content });
    return response.data;
  }

  async getDMs(): Promise<DMChannel[]> {
    const response = await this.client.get('/dms');
    return response.data;
  }

  async createDM(userId: string): Promise<DMChannel> {
    const response = await this.client.post('/dms', { user_id: userId });
    return response.data;
  }

  async getDMMessages(dmId: string, before?: string, limit = 50): Promise<Message[]> {
    const params = new URLSearchParams();
    if (before) params.append('before', before);
    params.append('limit', limit.toString());
    const response = await this.client.get(`/dms/${dmId}/messages?${params}`);
    return response.data;
  }

  async sendDMMessage(dmId: string, content: string): Promise<Message> {
    const response = await this.client.post(`/dms/${dmId}/messages`, { content });
    return response.data;
  }

  async getVoiceToken(channelId: string): Promise<LiveKitTokenResponse> {
    const response = await this.client.post('/voice/token', { channel_id: channelId });
    return response.data;
  }

  async getVoiceStates(): Promise<any[]> {
    const response = await this.client.get('/voice/states');
    return response.data;
  }

  async startOneToOneCall(targetUserId: string, type: 'voice' | 'video'): Promise<CallStartResponse> {
    const response = await this.client.post('/calls/1:1/start', { target_user_id: targetUserId, type });
    return response.data;
  }

  async startGroupCall(channelId: string, type: 'voice' | 'video'): Promise<CallStartResponse> {
    const response = await this.client.post('/calls/group/start', { channel_id: channelId, type });
    return response.data;
  }

  async acceptCall(callId: string): Promise<CallAcceptResponse> {
    const response = await this.client.post(`/calls/${callId}/accept`);
    return response.data;
  }

  async declineCall(callId: string): Promise<void> {
    await this.client.post(`/calls/${callId}/decline`);
  }

  async endCall(callId: string): Promise<void> {
    await this.client.post(`/calls/${callId}/end`);
  }

  async getCallToken(callId: string): Promise<TokenResponse> {
    const response = await this.client.get(`/calls/${callId}/token`);
    return response.data;
  }

  async startLive(channelId: string): Promise<CallStartResponse> {
    const response = await this.client.post('/live/start', { channel_id: channelId });
    return response.data;
  }

  async endLive(callId: string): Promise<void> {
    await this.client.post(`/live/${callId}/end`);
  }

  async getLiveToken(callId: string): Promise<TokenResponse> {
    const response = await this.client.get(`/live/${callId}/token`);
    return response.data;
  }

  getWsUrl(): string {
    return WS_URL;
  }
}

export const api = new ApiService();
export default api;
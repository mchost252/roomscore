// COPIED FROM: frontend/src/utils/api.js
// ADAPTED FOR: React Native with AsyncStorage

import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import config from '../config/api';

const api = axios.create({
  baseURL: config.apiUrl,
  timeout: 10000,
});

// Request interceptor - add auth token
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - handle errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Clear token on unauthorized
      await AsyncStorage.removeItem('token');
    }
    return Promise.reject(error);
  }
);

// Auth API
export const auth = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  
  register: (email: string, username: string, password: string) =>
    api.post('/auth/register', { email, username, password }),
  
  me: (token?: string) => {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    return api.get('/auth/me', { headers });
  },
  
  refresh: (refreshToken: string) =>
    api.post('/auth/refresh', { refreshToken }),
};

// Rooms API
export const rooms = {
  list: () => api.get('/rooms'),
  
  get: (id: string) => api.get(`/rooms/${id}`),
  
  create: (data: any) => api.post('/rooms', data),
  
  join: (joinCode: string) => api.post('/rooms/join', { joinCode }),
  
  leave: (id: string) => api.delete(`/rooms/${id}/leave`),
  
  leaderboard: (id: string) => api.get(`/rooms/${id}/leaderboard`),
  
  chat: (id: string) => api.get(`/rooms/${id}/chat`),
  
  sendMessage: (id: string, message: string) =>
    api.post(`/rooms/${id}/chat`, { content: message }),
};

// Tasks API
export const tasks = {
  complete: (roomId: string, taskId: string) =>
    api.post(`/rooms/${roomId}/tasks/${taskId}/complete`),
  
  uncomplete: (roomId: string, taskId: string) =>
    api.delete(`/rooms/${roomId}/tasks/${taskId}/uncomplete`),
};

// Friends API
export const friends = {
  list: () => api.get('/friends'),
  
  sendRequest: (userId: string) => api.post('/friends/request', { userId }),
  
  acceptRequest: (requestId: string) => api.put(`/friends/${requestId}/accept`),
  
  rejectRequest: (requestId: string) => api.delete(`/friends/${requestId}/reject`),
  
  remove: (friendId: string) => api.delete(`/friends/${friendId}`),
};

// Direct Messages API
export const directMessages = {
  conversations: () => api.get('/direct-messages/conversations'),
  
  getMessages: (userId: string) => api.get(`/direct-messages/${userId}`),
  
  send: (userId: string, content: string, replyToId?: string) =>
    api.post('/direct-messages', { toUserId: userId, content, replyToId }),
  
  markRead: (messageId: string) => api.put(`/direct-messages/${messageId}/read`),
  
  delete: (messageId: string) => api.delete(`/direct-messages/${messageId}`),
};

// Notifications API
export const notifications = {
  list: () => api.get('/notifications'),
  
  unreadCount: () => api.get('/notifications/unread/count'),
  
  markRead: (id: string) => api.put(`/notifications/${id}/read`),
  
  markAllRead: () => api.put('/notifications/read-all'),
  
  delete: (id: string) => api.delete(`/notifications/${id}`),
};

export default api;

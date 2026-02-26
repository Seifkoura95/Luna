import axios from 'axios';
import { getToken } from './auth';

const API_URL = import.meta.env.VITE_API_URL || 'https://cherryub-mock.preview.emergentagent.com/api';

const api = axios.create({
  baseURL: API_URL,
});

// Add auth token to all requests
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
import axios from 'axios';

export const API_BASE_URL = 'http://localhost:5050/api';
export const SOCKET_BASE_URL = 'http://localhost:5050';

const supportApi = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

supportApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('novakart_support_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

export default supportApi;

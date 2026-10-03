import axios from 'axios';

const envApiUrl = import.meta.env?.VITE_API_BASE_URL || (typeof window !== 'undefined' && window.location.hostname.includes('vercel.app') ? 'https://novakart.onrender.com' : null);
const hostname = typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : 'localhost';

let apiHost = envApiUrl || (hostname !== 'localhost' && !hostname.startsWith('192.') && !hostname.startsWith('172.') ? 'https://novakart.onrender.com' : `http://${hostname}:5050`);
if (!envApiUrl && hostname.includes('loca.lt')) {
  apiHost = 'https://cruel-llamas-build.loca.lt';
}

export const API_BASE_URL = `${apiHost}/api`;
export const SOCKET_BASE_URL = apiHost;

const api = axios.create({
  baseURL: API_BASE_URL
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('novakart_customer_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const formatINR = (amount) => {
  if (amount === undefined || amount === null) return '₹0';
  return '₹' + Number(amount).toLocaleString('en-IN');
};

export default api;

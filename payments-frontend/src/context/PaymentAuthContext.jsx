import React, { createContext, useContext, useState, useEffect } from 'react';
import paymentApi, { SOCKET_BASE_URL } from '../services/paymentApi';
import { io } from 'socket.io-client';

const PaymentAuthContext = createContext();

export function PaymentAuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('novakart_finance_token') || localStorage.getItem('admin_token') || null);
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('novakart_finance_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);
  const [livePayments, setLivePayments] = useState([]);

  useEffect(() => {
    let isMounted = true;

    const verifyAuth = async () => {
      if (!token) {
        if (isMounted) setLoading(false);
        return;
      }

      try {
        const { data } = await paymentApi.get('/auth/me');
        if (isMounted) {
          if (data?.user && (data.user.role === 'finance' || data.user.role === 'admin')) {
            setUser(data.user);
            localStorage.setItem('novakart_finance_user', JSON.stringify(data.user));
          } else {
            logout();
          }
        }
      } catch (err) {
        console.warn('Treasury auth verification notice:', err.message);
        // If we already had a cached user object with valid finance/admin role, keep them logged in
        if (user && (user.role === 'finance' || user.role === 'admin')) {
          // Keep cached session
        } else {
          logout();
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    verifyAuth();

    return () => {
      isMounted = false;
    };
  }, [token]);

  // Connect to Socket.IO for real-time transactions stream
  useEffect(() => {
    let socket = null;
    try {
      socket = io(SOCKET_BASE_URL, {
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 2000
      });

      socket.on('connect', () => {
        console.log('⚡ Connected to Treasury Socket.IO Stream');
        socket.emit('join_treasury_channel');
      });

      socket.on('ORDER_PAYMENT_CAPTURED', (eventData) => {
        console.log('💸 Live Payment Captured:', eventData);
        setLivePayments(prev => [eventData, ...prev]);
      });

      socket.on('PAYOUT_DISBURSED', (eventData) => {
        console.log('🏦 Live Payout Disbursed:', eventData);
        setLivePayments(prev => [eventData, ...prev]);
      });
    } catch (err) {
      console.warn('Socket.io stream connection issue:', err.message);
    }

    return () => {
      if (socket) socket.disconnect();
    };
  }, []);

  const login = async (email, password) => {
    const { data } = await paymentApi.post('/auth/login', { email, password });
    if (data.user?.role !== 'finance' && data.user?.role !== 'admin') {
      throw new Error('Access Denied: Only Treasury and Finance Officers can enter this portal.');
    }
    localStorage.setItem('novakart_finance_token', data.token);
    localStorage.setItem('novakart_finance_user', JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
    return data;
  };

  const logout = () => {
    localStorage.removeItem('novakart_finance_token');
    localStorage.removeItem('novakart_finance_user');
    setToken(null);
    setUser(null);
  };

  return (
    <PaymentAuthContext.Provider value={{ user, token, loading, login, logout, livePayments }}>
      {children}
    </PaymentAuthContext.Provider>
  );
}

export const usePaymentAuth = () => useContext(PaymentAuthContext);


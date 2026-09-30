import React, { createContext, useContext, useState, useEffect } from 'react';
import supportApi, { SOCKET_BASE_URL } from '../services/supportApi';
import { io } from 'socket.io-client';

const SupportAuthContext = createContext();

export function SupportAuthProvider({ children }) {
  const [worker, setWorker] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('novakart_support_token'));
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState(null);
  const [liveTicketAlert, setLiveTicketAlert] = useState(null);

  // Validate existing token
  useEffect(() => {
    if (token) {
      supportApi.get('/auth/me')
        .then(({ data }) => {
          if (data.user && (data.user.role === 'support_agent' || data.user.role === 'admin')) {
            setWorker({
              _id: data.user._id,
              name: data.user.name,
              email: data.user.email,
              role: data.user.role,
              workerId: data.user.workerId || 'WRK-01',
              specialty: data.user.specialty || 'General Resolution',
              supportDutyStatus: data.user.supportDutyStatus || 'ONLINE',
              avatar: data.user.avatar
            });
          } else {
            logout();
          }
        })
        .catch(() => logout())
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token]);

  // Connect to Socket.IO
  useEffect(() => {
    const s = io(SOCKET_BASE_URL);
    setSocket(s);

    s.on('connect', () => {
      console.log('🎧 Connected to Support Help Center Socket Engine');
      s.emit('join_admin_channel');
    });

    s.on('TICKET_CREATED', (data) => {
      setLiveTicketAlert({
        type: 'NEW_TICKET',
        message: `New Inbound Ticket #${data.ticketNumber || ''}: ${data.subject || 'Customer Inquiry'}`,
        timestamp: new Date()
      });
    });

    s.on('TICKET_MESSAGE', (data) => {
      setLiveTicketAlert({
        type: 'MESSAGE',
        message: `New customer message on Ticket #${data.ticketNumber || ''}`,
        timestamp: new Date()
      });
    });

    return () => s.disconnect();
  }, []);

  const login = async (email, password) => {
    const { data } = await supportApi.post('/support/auth/login', { email, password });
    if (!data.success || !data.worker) {
      throw new Error(data.message || 'Worker login failed');
    }
    localStorage.setItem('novakart_support_token', data.token);
    setToken(data.token);
    setWorker(data.worker);
    return data;
  };

  const updateDutyStatus = async (status) => {
    try {
      const { data } = await supportApi.put('/support/worker/duty-status', { status });
      if (data.success) {
        setWorker(prev => ({ ...prev, supportDutyStatus: status }));
        return data;
      }
    } catch (err) {
      console.error('Failed to update duty status:', err);
      throw err;
    }
  };

  const logout = () => {
    localStorage.removeItem('novakart_support_token');
    setToken(null);
    setWorker(null);
  };

  return (
    <SupportAuthContext.Provider value={{
      worker,
      token,
      loading,
      login,
      logout,
      updateDutyStatus,
      socket,
      liveTicketAlert,
      clearAlert: () => setLiveTicketAlert(null)
    }}>
      {children}
    </SupportAuthContext.Provider>
  );
}

export const useSupportAuth = () => useContext(SupportAuthContext);

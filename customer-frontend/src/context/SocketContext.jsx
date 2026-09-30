import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { SOCKET_BASE_URL } from '../services/api';
import { useAuth } from './AuthContext';

const SocketContext = createContext();

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [liveAlerts, setLiveAlerts] = useState([]);

  useEffect(() => {
    const s = io(SOCKET_BASE_URL, {
      transports: ['websocket', 'polling']
    });

    s.on('connect', () => {
      console.log('[Customer Socket Connected]:', s.id);
      if (user?.id || user?._id) {
        s.emit('join_user_room', user.id || user._id);
      }
    });

    s.on('order_status_update', (data) => {
      setLiveAlerts((prev) => [data, ...prev]);
    });

    s.on('delivery_agent_assigned', (data) => {
      setLiveAlerts((prev) => [data, ...prev]);
    });

    s.on('delivery_otp_received', (data) => {
      setLiveAlerts((prev) => [{ ...data, type: 'DELIVERY_OTP' }, ...prev]);
    });

    s.on('doorstep_return_otp_generated', (data) => {
      setLiveAlerts((prev) => [{ ...data, type: 'RETURN_OTP' }, ...prev]);
    });

    s.on('delivery_attempt_failed', (data) => {
      setLiveAlerts((prev) => [{ ...data, type: 'DELIVERY_FAILED' }, ...prev]);
    });

    setSocket(s);

    return () => {
      s.disconnect();
    };
  }, [user]);

  return (
    <SocketContext.Provider value={{ socket, liveAlerts }}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => useContext(SocketContext);

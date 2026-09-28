import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [initializationError, setInitializationError] = useState('');

  useEffect(() => {
    let active = true;

    const restoreSession = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        if (active) setLoading(false);
        return;
      }

      try {
        const { data } = await api.get('/auth/me');
        if (active) setUser(data.user);
      } catch (error) {
        if (!active) return;
        if (error.response?.status === 401) {
          localStorage.removeItem('token');
        } else {
          setInitializationError(
            error.response?.data?.message || 'Could not verify your session. Check the API connection and try again.'
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    restoreSession();
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('token', data.token);
    setUser(data.user);
    setInitializationError('');
    return data;
  }, []);

  const register = useCallback(async (payload) => {
    const { data } = await api.post('/auth/register', payload);
    return data;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setUser(null);
    setInitializationError('');
  }, []);

  const value = useMemo(
    () => ({ user, loading, initializationError, login, register, logout }),
    [user, loading, initializationError, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider.');
  }
  return context;
}

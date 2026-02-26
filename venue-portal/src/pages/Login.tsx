import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { setToken, setUser } from '../utils/auth';

const API_URL = import.meta.env.VITE_API_URL || 'https://cherryub-mock.preview.emergentagent.com/api';

interface LoginProps {
  onLogin: () => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await axios.post(`${API_URL}/auth/login`, {
        email,
        password,
      });

      const { user, token } = response.data;
      
      if (!['venue_staff', 'venue_manager', 'admin'].includes(user.role)) {
        setError('Access denied. Venue staff only.');
        setLoading(false);
        return;
      }

      setToken(token);
      setUser(user);
      onLogin();
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Login failed');
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h1 style={styles.title}>LUNA GROUP</h1>
          <p style={styles.subtitle}>Venue Portal</p>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={styles.input}
              placeholder="venue@example.com"
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={styles.input}
              placeholder="Enter password"
            />
          </div>

          {error && <div style={styles.error}>{error}</div>}

          <button type="submit" disabled={loading} style={styles.button}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div style={styles.footer}>
          <p style={styles.footerText}>
            Demo Account: venue@eclipse.com / venue123
          </p>
        </div>
      </div>
    </div>
  );
}

const styles: any = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #0a0a0a 0%, #1a0a0f 100%)',
    padding: '20px',
  },
  card: {
    background: '#1a1a1a',
    borderRadius: '16px',
    padding: '40px',
    maxWidth: '450px',
    width: '100%',
    boxShadow: '0 8px 32px rgba(227, 24, 55, 0.2)',
    border: '1px solid #2a2a2a',
  },
  header: {
    textAlign: 'center',
    marginBottom: '32px',
  },
  title: {
    fontSize: '32px',
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: '2px',
    marginBottom: '8px',
  },
  subtitle: {
    fontSize: '14px',
    color: '#999999',
    letterSpacing: '4px',
    textTransform: 'uppercase',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    fontSize: '13px',
    fontWeight: '500',
    color: '#cccccc',
    letterSpacing: '0.5px',
  },
  input: {
    background: '#0a0a0a',
    border: '1px solid #333333',
    borderRadius: '8px',
    padding: '14px 16px',
    fontSize: '15px',
    color: '#ffffff',
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  button: {
    background: '#E31837',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    padding: '16px',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
    marginTop: '8px',
  },
  error: {
    background: '#3a0a0f',
    border: '1px solid #E31837',
    borderRadius: '8px',
    padding: '12px',
    fontSize: '14px',
    color: '#ff6b6b',
  },
  footer: {
    marginTop: '24px',
    textAlign: 'center',
  },
  footerText: {
    fontSize: '12px',
    color: '#666666',
  },
};

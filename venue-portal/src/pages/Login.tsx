import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { motion } from 'framer-motion';
import { Eye, EyeOff, LogIn, AlertCircle } from 'lucide-react';
import { setToken, setUser } from '../utils/auth';

const API_URL = import.meta.env.VITE_API_URL || 'https://birthday-rewards-1.preview.emergentagent.com/api';

interface LoginProps {
  onLogin: () => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
        setError('Access denied. Venue staff credentials required.');
        setLoading(false);
        return;
      }

      setToken(token);
      setUser(user);
      onLogin();
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Invalid credentials. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Noise overlay */}
      <div className="noise-overlay" />
      
      {/* Background glow effects */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[150px]" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-secondary/5 rounded-full blur-[150px]" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative"
      >
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="inline-block"
          >
            <h1 className="font-heading font-black text-4xl text-white tracking-tight">LUNA</h1>
            <div className="flex items-center justify-center gap-2 mt-1">
              <div className="h-px w-8 bg-gradient-to-r from-transparent to-primary" />
              <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground font-medium">Venue Portal</span>
              <div className="h-px w-8 bg-gradient-to-l from-transparent to-primary" />
            </div>
          </motion.div>
        </div>

        {/* Login Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="bg-card border border-border/50 rounded-sm p-8 shadow-2xl relative overflow-hidden"
        >
          {/* Card top accent */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                data-testid="login-email"
                placeholder="venue@example.com"
                className="w-full px-4 py-3.5 bg-surface border border-border rounded-sm text-white placeholder:text-neutral-600 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  data-testid="login-password"
                  placeholder="Enter your password"
                  className="w-full px-4 py-3.5 pr-12 bg-surface border border-border rounded-sm text-white placeholder:text-neutral-600 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 p-3 bg-primary/10 border border-primary/30 rounded-sm"
              >
                <AlertCircle className="w-4 h-4 text-primary flex-shrink-0" />
                <p className="text-sm text-primary">{error}</p>
              </motion.div>
            )}

            <button
              type="submit"
              disabled={loading}
              data-testid="login-submit"
              className="w-full flex items-center justify-center gap-2 py-4 bg-primary text-white font-bold uppercase tracking-widest text-xs rounded-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_0_20px_rgba(227,24,55,0.3)] hover:shadow-[0_0_30px_rgba(227,24,55,0.4)]"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  Sign In
                </>
              )}
            </button>
          </form>
        </motion.div>

        {/* Demo credentials */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="mt-6 text-center"
        >
          <p className="text-xs text-muted-foreground">
            Demo: <span className="text-white font-mono">venue@eclipse.com</span> / <span className="text-white font-mono">venue123</span>
          </p>
        </motion.div>

        {/* Footer */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="mt-8 text-center"
        >
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
            Luna Group Hospitality &copy; 2026
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}

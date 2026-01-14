import React, { useState, useEffect } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Box,
  TextField,
  Button,
  Typography,
  Alert,
  Link,
  InputAdornment,
  IconButton,
} from '@mui/material';
import { Visibility, VisibilityOff, Login as LoginIcon } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';

// Floating particle component for constellation effect
const FloatingParticle = ({ delay, duration, size, left, top, color }) => (
  <Box
    sx={{
      position: 'absolute',
      width: size,
      height: size,
      borderRadius: '50%',
      background: color,
      left: `${left}%`,
      top: `${top}%`,
      boxShadow: `0 0 ${parseInt(size) * 2}px ${color}`,
      animation: `float ${duration}s ease-in-out infinite`,
      animationDelay: `${delay}s`,
      opacity: 0.8,
      '@keyframes float': {
        '0%, 100%': {
          transform: 'translateY(0px) scale(1)',
          opacity: 0.8,
        },
        '50%': {
          transform: 'translateY(-20px) scale(1.2)',
          opacity: 1,
        },
      },
    }}
  />
);

// Connection line between particles
const ConnectionLine = ({ x1, y1, x2, y2, delay }) => (
  <Box
    component="svg"
    sx={{
      position: 'absolute',
      width: '100%',
      height: '100%',
      top: 0,
      left: 0,
      pointerEvents: 'none',
      opacity: 0.3,
    }}
  >
    <line
      x1={`${x1}%`}
      y1={`${y1}%`}
      x2={`${x2}%`}
      y2={`${y2}%`}
      stroke="url(#lineGradient)"
      strokeWidth="1"
      style={{
        animation: `pulse 3s ease-in-out infinite`,
        animationDelay: `${delay}s`,
      }}
    />
    <defs>
      <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#60A5FA" />
        <stop offset="100%" stopColor="#F59E0B" />
      </linearGradient>
    </defs>
  </Box>
);

const LoginPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(formData.email, formData.password);

    if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.message);
    }

    setLoading(false);
  };

  // Particle positions for constellation effect
  const particles = [
    { left: 10, top: 20, size: '8px', color: '#60A5FA', delay: 0, duration: 4 },
    { left: 85, top: 15, size: '10px', color: '#F59E0B', delay: 1, duration: 5 },
    { left: 15, top: 70, size: '6px', color: '#60A5FA', delay: 0.5, duration: 4.5 },
    { left: 90, top: 75, size: '8px', color: '#F59E0B', delay: 1.5, duration: 4 },
    { left: 50, top: 10, size: '5px', color: '#60A5FA', delay: 2, duration: 5 },
    { left: 5, top: 45, size: '7px', color: '#60A5FA', delay: 0.8, duration: 4.2 },
    { left: 95, top: 50, size: '6px', color: '#F59E0B', delay: 1.2, duration: 4.8 },
    { left: 30, top: 85, size: '5px', color: '#60A5FA', delay: 2.5, duration: 5 },
    { left: 70, top: 90, size: '7px', color: '#F59E0B', delay: 0.3, duration: 4.3 },
  ];

  const connections = [
    { x1: 10, y1: 20, x2: 50, y2: 10, delay: 0 },
    { x1: 50, y1: 10, x2: 85, y2: 15, delay: 0.5 },
    { x1: 5, y1: 45, x2: 15, y2: 70, delay: 1 },
    { x1: 90, y1: 75, x2: 95, y2: 50, delay: 1.5 },
    { x1: 30, y1: 85, x2: 70, y2: 90, delay: 2 },
  ];

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        // Deep space gradient background matching logo
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
        px: 2,
      }}
    >
      {/* Animated background gradient overlay */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at 30% 20%, rgba(96, 165, 250, 0.15) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(245, 158, 11, 0.1) 0%, transparent 50%)',
          animation: 'gradientShift 10s ease-in-out infinite',
          '@keyframes gradientShift': {
            '0%, 100%': { opacity: 1 },
            '50%': { opacity: 0.7 },
          },
        }}
      />

      {/* Floating particles */}
      {particles.map((p, i) => (
        <FloatingParticle key={i} {...p} />
      ))}

      {/* Connection lines */}
      {connections.map((c, i) => (
        <ConnectionLine key={i} {...c} />
      ))}

      {/* Main glassmorphism card */}
      <Box
        sx={{
          position: 'relative',
          zIndex: 10,
          width: '100%',
          maxWidth: 420,
          transform: mounted ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.95)',
          opacity: mounted ? 1 : 0,
          transition: 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* Glassmorphism card */}
        <Box
          sx={{
            background: 'rgba(30, 41, 59, 0.7)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderRadius: 4,
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), inset 0 1px 1px rgba(255, 255, 255, 0.1)',
            p: 4,
          }}
        >
          {/* Logo and title */}
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            {/* App Icon */}
            <Box
              component="img"
              src="/icon-192x192.png"
              alt="Krios"
              sx={{
                width: 80,
                height: 80,
                borderRadius: 3,
                mb: 2,
                boxShadow: '0 10px 40px rgba(96, 165, 250, 0.3)',
                animation: 'iconGlow 3s ease-in-out infinite',
                '@keyframes iconGlow': {
                  '0%, 100%': {
                    boxShadow: '0 10px 40px rgba(96, 165, 250, 0.3)',
                  },
                  '50%': {
                    boxShadow: '0 10px 60px rgba(96, 165, 250, 0.5), 0 0 30px rgba(245, 158, 11, 0.3)',
                  },
                },
              }}
            />
            <Typography
              variant="h4"
              sx={{
                fontWeight: 700,
                background: 'linear-gradient(135deg, #60A5FA 0%, #F59E0B 100%)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                mb: 1,
              }}
            >
              Welcome Back
            </Typography>
            <Typography
              variant="body1"
              sx={{ color: 'rgba(255, 255, 255, 0.6)' }}
            >
              Sign in to continue your journey
            </Typography>
          </Box>

          {/* Error alert */}
          {error && (
            <Alert
              severity="error"
              sx={{
                mb: 3,
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#fca5a5',
                '& .MuiAlert-icon': { color: '#f87171' },
              }}
            >
              {error}
            </Alert>
          )}

          {/* Login form */}
          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="Email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              required
              autoComplete="email"
              sx={{
                mb: 2.5,
                '& .MuiOutlinedInput-root': {
                  color: 'white',
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: 2,
                  '& fieldset': {
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                  },
                  '&:hover fieldset': {
                    borderColor: 'rgba(96, 165, 250, 0.5)',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#60A5FA',
                  },
                },
                '& .MuiInputLabel-root': {
                  color: 'rgba(255, 255, 255, 0.5)',
                  '&.Mui-focused': {
                    color: '#60A5FA',
                  },
                },
              }}
            />

            <TextField
              fullWidth
              label="Password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              value={formData.password}
              onChange={handleChange}
              required
              autoComplete="current-password"
              sx={{
                mb: 3,
                '& .MuiOutlinedInput-root': {
                  color: 'white',
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: 2,
                  '& fieldset': {
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                  },
                  '&:hover fieldset': {
                    borderColor: 'rgba(96, 165, 250, 0.5)',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#60A5FA',
                  },
                },
                '& .MuiInputLabel-root': {
                  color: 'rgba(255, 255, 255, 0.5)',
                  '&.Mui-focused': {
                    color: '#60A5FA',
                  },
                },
              }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                      sx={{ color: 'rgba(255, 255, 255, 0.5)' }}
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <Button
              fullWidth
              type="submit"
              variant="contained"
              size="large"
              disabled={loading}
              startIcon={!loading && <LoginIcon />}
              sx={{
                py: 1.5,
                borderRadius: 2,
                fontSize: '1rem',
                fontWeight: 600,
                textTransform: 'none',
                background: 'linear-gradient(135deg, #60A5FA 0%, #3B82F6 100%)',
                boxShadow: '0 10px 30px -10px rgba(96, 165, 250, 0.5)',
                transition: 'all 0.3s ease',
                '&:hover': {
                  background: 'linear-gradient(135deg, #93C5FD 0%, #60A5FA 100%)',
                  boxShadow: '0 15px 40px -10px rgba(96, 165, 250, 0.6)',
                  transform: 'translateY(-2px)',
                },
                '&:disabled': {
                  background: 'rgba(96, 165, 250, 0.3)',
                },
              }}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>

            {/* Sign up link */}
            <Box sx={{ textAlign: 'center', mt: 3 }}>
              <Typography
                variant="body2"
                sx={{ color: 'rgba(255, 255, 255, 0.5)' }}
              >
                Don't have an account?{' '}
                <Link
                  component={RouterLink}
                  to="/signup"
                  sx={{
                    color: '#60A5FA',
                    fontWeight: 600,
                    textDecoration: 'none',
                    '&:hover': {
                      color: '#93C5FD',
                      textDecoration: 'underline',
                    },
                  }}
                >
                  Sign Up
                </Link>
              </Typography>
            </Box>
          </form>
        </Box>

        {/* Bottom glow effect */}
        <Box
          sx={{
            position: 'absolute',
            bottom: -20,
            left: '50%',
            transform: 'translateX(-50%)',
            width: '80%',
            height: 40,
            background: 'radial-gradient(ellipse, rgba(96, 165, 250, 0.3) 0%, transparent 70%)',
            filter: 'blur(20px)',
          }}
        />
      </Box>

      {/* Global animation styles */}
      <style>
        {`
          @keyframes pulse {
            0%, 100% { opacity: 0.3; }
            50% { opacity: 0.6; }
          }
        `}
      </style>
    </Box>
  );
};

export default LoginPage;

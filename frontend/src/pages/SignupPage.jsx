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
import { Visibility, VisibilityOff, PersonAdd } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import OnboardingModal from '../components/OnboardingModal';

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
      stroke="url(#lineGradientSignup)"
      strokeWidth="1"
      style={{
        animation: `pulse 3s ease-in-out infinite`,
        animationDelay: `${delay}s`,
      }}
    />
    <defs>
      <linearGradient id="lineGradientSignup" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#60A5FA" />
        <stop offset="100%" stopColor="#F59E0B" />
      </linearGradient>
    </defs>
  </Box>
);

const SignupPage = () => {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
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

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (formData.username.length < 3) {
      setError('Username must be at least 3 characters');
      return;
    }

    setLoading(true);

    const result = await register(formData.email, formData.password, formData.username);

    if (result.success) {
      localStorage.setItem('isNewUser', 'true');
      setShowOnboarding(true);
    } else {
      setError(result.message);
    }

    setLoading(false);
  };

  const handleOnboardingClose = () => {
    setShowOnboarding(false);
    localStorage.removeItem('isNewUser');
    navigate('/dashboard');
  };

  // Particle positions for constellation effect
  const particles = [
    { left: 8, top: 15, size: '8px', color: '#60A5FA', delay: 0, duration: 4 },
    { left: 88, top: 12, size: '10px', color: '#F59E0B', delay: 1, duration: 5 },
    { left: 12, top: 75, size: '6px', color: '#60A5FA', delay: 0.5, duration: 4.5 },
    { left: 92, top: 80, size: '8px', color: '#F59E0B', delay: 1.5, duration: 4 },
    { left: 50, top: 5, size: '5px', color: '#60A5FA', delay: 2, duration: 5 },
    { left: 3, top: 50, size: '7px', color: '#60A5FA', delay: 0.8, duration: 4.2 },
    { left: 97, top: 45, size: '6px', color: '#F59E0B', delay: 1.2, duration: 4.8 },
    { left: 25, top: 92, size: '5px', color: '#60A5FA', delay: 2.5, duration: 5 },
    { left: 75, top: 95, size: '7px', color: '#F59E0B', delay: 0.3, duration: 4.3 },
  ];

  const connections = [
    { x1: 8, y1: 15, x2: 50, y2: 5, delay: 0 },
    { x1: 50, y1: 5, x2: 88, y2: 12, delay: 0.5 },
    { x1: 3, y1: 50, x2: 12, y2: 75, delay: 1 },
    { x1: 92, y1: 80, x2: 97, y2: 45, delay: 1.5 },
    { x1: 25, y1: 92, x2: 75, y2: 95, delay: 2 },
  ];

  // Custom text field styles
  const textFieldStyles = {
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
    '& .MuiFormHelperText-root': {
      color: 'rgba(255, 255, 255, 0.4)',
    },
  };

  return (
    <>
      {/* Onboarding Modal */}
      <OnboardingModal 
        open={showOnboarding} 
        onClose={handleOnboardingClose}
      />

      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
          px: 2,
          py: 4,
        }}
      >
        {/* Animated background gradient overlay */}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(ellipse at 70% 20%, rgba(245, 158, 11, 0.12) 0%, transparent 50%), radial-gradient(ellipse at 30% 80%, rgba(96, 165, 250, 0.15) 0%, transparent 50%)',
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
            <Box sx={{ textAlign: 'center', mb: 3 }}>
              {/* App Icon */}
              <Box
                component="img"
                src="/icon-192x192.png"
                alt="Krios"
                sx={{
                  width: 70,
                  height: 70,
                  borderRadius: 2.5,
                  mb: 2,
                  boxShadow: '0 10px 40px rgba(245, 158, 11, 0.3)',
                  animation: 'iconGlow 3s ease-in-out infinite',
                  '@keyframes iconGlow': {
                    '0%, 100%': {
                      boxShadow: '0 10px 40px rgba(245, 158, 11, 0.3)',
                    },
                    '50%': {
                      boxShadow: '0 10px 60px rgba(245, 158, 11, 0.5), 0 0 30px rgba(96, 165, 250, 0.3)',
                    },
                  },
                }}
              />
              <Typography
                variant="h4"
                sx={{
                  fontWeight: 700,
                  background: 'linear-gradient(135deg, #F59E0B 0%, #60A5FA 100%)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  mb: 1,
                }}
              >
                Join Krios
              </Typography>
              <Typography
                variant="body1"
                sx={{ color: 'rgba(255, 255, 255, 0.6)' }}
              >
                Start your habit tracking journey
              </Typography>
            </Box>

            {/* Error alert */}
            {error && (
              <Alert
                severity="error"
                sx={{
                  mb: 2,
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#fca5a5',
                  '& .MuiAlert-icon': { color: '#f87171' },
                }}
              >
                {error}
              </Alert>
            )}

            {/* Signup form */}
            <form onSubmit={handleSubmit}>
              <TextField
                fullWidth
                label="Username"
                name="username"
                value={formData.username}
                onChange={handleChange}
                required
                autoComplete="username"
                helperText="At least 3 characters"
                sx={{ mb: 2, ...textFieldStyles }}
              />

              <TextField
                fullWidth
                label="Email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                required
                autoComplete="email"
                sx={{ mb: 2, ...textFieldStyles }}
              />

              <TextField
                fullWidth
                label="Password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={handleChange}
                required
                autoComplete="new-password"
                helperText="At least 6 characters"
                sx={{ mb: 2, ...textFieldStyles }}
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

              <TextField
                fullWidth
                label="Confirm Password"
                name="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                autoComplete="new-password"
                sx={{ mb: 3, ...textFieldStyles }}
              />

              <Button
                fullWidth
                type="submit"
                variant="contained"
                size="large"
                disabled={loading}
                startIcon={!loading && <PersonAdd />}
                sx={{
                  py: 1.5,
                  borderRadius: 2,
                  fontSize: '1rem',
                  fontWeight: 600,
                  textTransform: 'none',
                  background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
                  boxShadow: '0 10px 30px -10px rgba(245, 158, 11, 0.5)',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #FBBF24 0%, #F59E0B 100%)',
                    boxShadow: '0 15px 40px -10px rgba(245, 158, 11, 0.6)',
                    transform: 'translateY(-2px)',
                  },
                  '&:disabled': {
                    background: 'rgba(245, 158, 11, 0.3)',
                  },
                }}
              >
                {loading ? 'Creating account...' : 'Create Account'}
              </Button>

              {/* Sign in link */}
              <Box sx={{ textAlign: 'center', mt: 3 }}>
                <Typography
                  variant="body2"
                  sx={{ color: 'rgba(255, 255, 255, 0.5)' }}
                >
                  Already have an account?{' '}
                  <Link
                    component={RouterLink}
                    to="/login"
                    sx={{
                      color: '#F59E0B',
                      fontWeight: 600,
                      textDecoration: 'none',
                      '&:hover': {
                        color: '#FBBF24',
                        textDecoration: 'underline',
                      },
                    }}
                  >
                    Sign In
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
              background: 'radial-gradient(ellipse, rgba(245, 158, 11, 0.3) 0%, transparent 70%)',
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
    </>
  );
};

export default SignupPage;

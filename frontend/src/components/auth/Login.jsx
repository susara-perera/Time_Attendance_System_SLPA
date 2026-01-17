import React, { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import logo from '../../assets/logo.jpg';

const Login = () => {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockTimeLeft, setBlockTimeLeft] = useState(0);

  const { login } = useContext(AuthContext) || {};
  const navigate = useNavigate();

  useEffect(() => {
    // Add the CSS animations to the document
    const style = document.createElement('style');
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@200;400;500;600;700;800;900&display=swap');
      @import url('https://fonts.googleapis.com/css2?family=Roboto+Slab:wght@400;700;900&display=swap');

      @keyframes slideInUp {
        from {
          opacity: 0;
          transform: translateY(40px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }

      @keyframes float {
        0%, 100% { transform: translateY(0px) rotate(0deg); }
        25% { transform: translateY(-8px) rotate(1deg); }
        75% { transform: translateY(-8px) rotate(-1deg); }
      }
      
      @keyframes pulseGlow {
        0%, 100% {
          box-shadow: 0 0 20px rgba(255, 255, 255, 0.3),
                      0 25px 45px rgba(0, 0, 0, 0.2);
        }
        50% {
          box-shadow: 0 0 40px rgba(255, 255, 255, 0.5),
                      0 30px 50px rgba(0, 0, 0, 0.25);
        }
      }

      @keyframes colorChange {
        0% { 
          color: #ffffff;
          text-shadow: 
            0 0 30px rgba(255, 255, 255, 0.9),
            0 4px 20px rgba(0, 0, 0, 0.6),
            0 0 15px rgba(255, 255, 255, 0.6);
        }
        25% { 
          color: #e0e7ff;
          text-shadow: 
            0 0 35px rgba(99, 102, 241, 0.8),
            0 4px 18px rgba(0, 0, 0, 0.5),
            0 0 12px rgba(99, 102, 241, 0.5);
        }
        50% { 
          color: #60a5fa;
          text-shadow: 
            0 0 40px rgba(96, 165, 250, 0.9),
            0 4px 15px rgba(0, 0, 0, 0.4),
            0 0 20px rgba(96, 165, 250, 0.7);
        }
        75% { 
          color: #c7d2fe;
          text-shadow: 
            0 0 35px rgba(199, 210, 254, 0.8),
            0 4px 18px rgba(0, 0, 0, 0.5),
            0 0 12px rgba(199, 210, 254, 0.5);
        }
        100% { 
          color: #ffffff;
          text-shadow: 
            0 0 30px rgba(255, 255, 255, 0.9),
            0 4px 20px rgba(0, 0, 0, 0.6),
            0 0 15px rgba(255, 255, 255, 0.6);
        }
      }

      @keyframes underlineColorChange {
        0%, 100% { 
          background: linear-gradient(90deg, transparent, #ffffff 15%, #e0e7ff 30%, #ffffff 50%, #e0e7ff 70%, #ffffff 85%, transparent);
          opacity: 0.9; 
          transform: translateX(-50%) scaleX(0.95); 
        }
        50% { 
          background: linear-gradient(90deg, transparent, #60a5fa 15%, #3b82f6 30%, #2563eb 50%, #3b82f6 70%, #60a5fa 85%, transparent);
          opacity: 1; 
          transform: translateX(-50%) scaleX(1.1); 
        }
      }

      @keyframes gradientShift {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
      }
      
      @keyframes borderGlow {
        0%, 100% {
          border-color: rgba(255, 255, 255, 0.3);
          box-shadow: 0 25px 50px rgba(0, 0, 0, 0.25);
        }
        50% {
          border-color: rgba(255, 255, 255, 0.6);
          box-shadow: 0 30px 60px rgba(0, 0, 0, 0.3), 0 0 30px rgba(255, 255, 255, 0.1);
        }
      }
      
      @keyframes inputFocus {
        0% { transform: translateY(0); box-shadow: none; }
        100% { transform: translateY(-2px); box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2), 0 0 20px rgba(232, 244, 253, 0.3); }
      }
      
      @keyframes buttonPulse {
        0%, 100% { box-shadow: 0 8px 25px rgba(74, 144, 226, 0.4); }
        50% { box-shadow: 0 12px 35px rgba(74, 144, 226, 0.6), 0 0 40px rgba(74, 144, 226, 0.2); }
      }
      
      @keyframes logoBreath {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.03); }
      }
    `;
    document.head.appendChild(style);

    // Check for existing login attempts in localStorage
    const attempts = localStorage.getItem('loginAttempts');
    const blockUntil = localStorage.getItem('blockUntil');
    
    if (attempts) {
      setLoginAttempts(parseInt(attempts));
    }
    
    if (blockUntil) {
      const blockTime = new Date(blockUntil);
      if (blockTime > new Date()) {
        setIsBlocked(true);
        const timeLeft = Math.ceil((blockTime - new Date()) / 1000);
        setBlockTimeLeft(timeLeft);
        
        // Start countdown timer
        const timer = setInterval(() => {
          const remaining = Math.ceil((blockTime - new Date()) / 1000);
          if (remaining <= 0) {
            setIsBlocked(false);
            setBlockTimeLeft(0);
            localStorage.removeItem('blockUntil');
            localStorage.removeItem('loginAttempts');
            setLoginAttempts(0);
            clearInterval(timer);
          } else {
            setBlockTimeLeft(remaining);
          }
        }, 1000);
        
        return () => clearInterval(timer);
      } else {
        localStorage.removeItem('blockUntil');
        localStorage.removeItem('loginAttempts');
      }
    }

    return () => {
      if (style.parentNode) {
        document.head.removeChild(style);
      }
    };
  }, []);

  // Validation functions
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateEmployeeId = (id) => {
    // Assuming employee ID format: SP001, EMP123, etc.
    const idRegex = /^[A-Z]{2,3}\d{3,4}$/;
    return idRegex.test(id);
  };

  const validateInput = (input) => {
    const errors = {};
    
    if (!input.userId) {
      errors.userId = 'User ID or Email is required';
    } else if (!validateEmail(input.userId) && !validateEmployeeId(input.userId)) {
      errors.userId = 'Please enter a valid email address or employee ID (e.g., SP001)';
    }
    
    if (!input.password) {
      errors.password = 'Password is required';
    } else if (input.password.length < 6) {
      errors.password = 'Password must be at least 6 characters long';
    }
    
    return errors;
  };

  const handleInputChange = (field, value) => {
    if (field === 'userId') {
      setUserId(value);
    } else if (field === 'password') {
      setPassword(value);
    }
    
    // Clear validation error for this field
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
    
    // Clear general error
    if (error) {
      setError('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Check if account is blocked
    if (isBlocked) {
      setError(`Account temporarily locked. Try again in ${Math.ceil(blockTimeLeft / 60)} minutes.`);
      return;
    }
    
    setLoading(true);
    setError('');
    setValidationErrors({});
    
    // Client-side validation
    const input = { userId: userId.trim(), password };
    const errors = validateInput(input);
    
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      setLoading(false);
      return;
    }
    
    try {
      // Prepare credentials object
      const credentials = {};
      
      // Determine if input is email or employee ID
      if (validateEmail(input.userId)) {
        credentials.email = input.userId;
      } else if (validateEmployeeId(input.userId)) {
        credentials.employeeId = input.userId;
      } else {
        // Try as email if format is unclear
        credentials.email = input.userId;
      }
      
      credentials.password = input.password;
      
      const result = await login(credentials);
      
      // Clear login attempts on successful login
      localStorage.removeItem('loginAttempts');
      localStorage.removeItem('blockUntil');
      setLoginAttempts(0);

      // Show brief cache preload notice if server triggered preloads
      if (result && result.cache && result.cache.preloadTrigger) {
        const days = result.cache.preloadTrigger.days || 0;
        setError(`⚡ Cache preload triggered for attendance & audit (last ${days} days). Warming up in background.`);
        // Show message briefly then navigate
        setTimeout(() => {
          setError('');
          navigate('/dashboard');
        }, 900);
      } else {
        console.log('Login successful, navigating to dashboard...', result);
        navigate('/dashboard');
      }
    } catch (err) {
      console.error('Login error:', err);
      
      // Handle failed login attempt
      const newAttempts = loginAttempts + 1;
      setLoginAttempts(newAttempts);
      localStorage.setItem('loginAttempts', newAttempts.toString());
      
      // Block account after 5 failed attempts
      if (newAttempts >= 5) {
        const blockUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
        localStorage.setItem('blockUntil', blockUntil.toISOString());
        setIsBlocked(true);
        setBlockTimeLeft(15 * 60);
        
        // Start countdown timer
        const timer = setInterval(() => {
          const remaining = Math.ceil((blockUntil - new Date()) / 1000);
          if (remaining <= 0) {
            setIsBlocked(false);
            setBlockTimeLeft(0);
            localStorage.removeItem('blockUntil');
            localStorage.removeItem('loginAttempts');
            setLoginAttempts(0);
            clearInterval(timer);
          } else {
            setBlockTimeLeft(remaining);
          }
        }, 1000);
        
        setError('Too many failed attempts. Account locked for 15 minutes.');
      } else {
        setError(err.message || 'Invalid credentials. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'relative',
      height: '100vh',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
      fontFamily: "'Poppins', 'Arial', sans-serif",
      background: videoLoaded 
        ? 'transparent' 
        : `
          linear-gradient(45deg, #667eea 0%, #764ba2 25%, #4568dc 50%, #b06ab3 75%, #667eea 100%),
          radial-gradient(circle at 20% 50%, rgba(120, 119, 198, 0.3) 0%, transparent 50%),
          radial-gradient(circle at 80% 20%, rgba(255, 119, 198, 0.3) 0%, transparent 50%),
          radial-gradient(circle at 40% 80%, rgba(120, 219, 226, 0.3) 0%, transparent 50%)
        `,
      backgroundSize: videoLoaded ? 'auto' : '400% 400%, 100% 100%, 100% 100%, 100% 100%',
      animation: videoLoaded ? 'none' : 'gradientShift 15s ease infinite',
      padding: '20px'
    }}>
      {/* Video Background - Try multiple sources */}
      <video 
        autoPlay 
        muted 
        loop 
        playsInline
        style={{ 
          position: 'fixed',
          top: 0, 
          left: 0, 
          width: '100vw',
          height: '100vh',
          objectFit: 'cover', 
          zIndex: videoLoaded ? -2 : -4,
          opacity: videoLoaded ? 0.7 : 0,
          transition: 'opacity 1s ease-in-out'
        }}
        onLoadedData={() => {
          console.log('Video loaded successfully');
          setVideoLoaded(true);
        }}
        onError={(e) => {
          console.log('Video failed to load, using animated background');
          setVideoLoaded(false);
        }}
        onCanPlay={() => {
          console.log('Video can play');
          setVideoLoaded(true);
        }}
      >
        {/* Try multiple video sources */}
        <source src="/assets/background-video.mp4" type="video/mp4" />
        <source src="./assets/background-video.mp4" type="video/mp4" />
        <source src="/public/assets/background-video.mp4" type="video/mp4" />
        {/* Fallback for browsers that don't support video */}
        Your browser does not support the video tag.
      </video>

      {/* Video Overlay */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.4), rgba(118, 75, 162, 0.4))',
        zIndex: -1,
        backdropFilter: 'blur(2px)'
      }}></div>

      {/* Login Form Box */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.12)',
        padding: '45px',
        borderRadius: '24px',
        boxShadow: `
          0 30px 60px rgba(0, 0, 0, 0.25),
          inset 0 1px 0 rgba(255, 255, 255, 0.4),
          inset 0 -1px 0 rgba(0, 0, 0, 0.1),
          0 0 0 1px rgba(255, 255, 255, 0.1)
        `,
        width: '100%',
        maxWidth: '920px',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.25)',
        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        position: 'relative',
        overflow: 'hidden',
        opacity: 1,
        transform: 'translateY(0)',
        animation: 'slideInUp 0.8s cubic-bezier(0.4, 0, 0.2, 1) forwards, float 8s ease-in-out 1.5s infinite, borderGlow 4s ease-in-out infinite'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-5px)';
        e.currentTarget.style.boxShadow = `
          0 35px 60px rgba(0, 0, 0, 0.3),
          inset 0 1px 0 rgba(255, 255, 255, 0.5),
          inset 0 -1px 0 rgba(0, 0, 0, 0.1)
        `;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = `
          0 25px 45px rgba(0, 0, 0, 0.2),
          inset 0 1px 0 rgba(255, 255, 255, 0.4),
          inset 0 -1px 0 rgba(0, 0, 0, 0.1)
        `;
      }}
      >
        {/* Shimmer effect */}
        <div style={{
          content: '',
          position: 'absolute',
          top: 0,
          left: '-100%',
          width: '100%',
          height: '100%',
          background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent)',
          transition: 'left 0.5s'
        }}></div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '40px'
        }}>
          {/* Left Side - Logo and Title */}
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'
          }}>
            <div style={{ textAlign: 'center', marginBottom: '30px', position: 'relative' }}>
              <img 
                src={logo} 
                alt="Logo" 
                style={{
                  maxWidth: '160px',
                  height: 'auto',
                  borderRadius: '50%',
                  boxShadow: `
                    0 20px 50px rgba(0, 0, 0, 0.4),
                    0 0 40px rgba(255, 255, 255, 0.25)
                  `,
                  transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                  border: '4px solid rgba(255, 255, 255, 0.35)',
                  animation: 'logoBreath 4s ease-in-out infinite'
                }}
                onMouseEnter={(e) => {
                  e.target.style.transform = 'scale(1.18) rotate(5deg)';
                  e.target.style.boxShadow = `
                    0 25px 60px rgba(0, 0, 0, 0.5),
                    0 0 60px rgba(255, 255, 255, 0.5)
                  `;
                  e.target.style.borderColor = 'rgba(255, 255, 255, 0.6)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = 'scale(1) rotate(0deg)';
                  e.target.style.boxShadow = `
                    0 20px 50px rgba(0, 0, 0, 0.4),
                    0 0 40px rgba(255, 255, 255, 0.25)
                  `;
                  e.target.style.borderColor = 'rgba(255, 255, 255, 0.35)';
                }}
              />
            </div>
            
            <h1 style={{
              textAlign: 'center',
              fontSize: '48px',
              fontWeight: '900',
              marginBottom: '40px',
              textShadow: `
                0 0 30px rgba(255, 255, 255, 0.8),
                0 4px 15px rgba(0, 0, 0, 0.6),
                0 0 10px rgba(255, 255, 255, 0.5)
              `,
              letterSpacing: '8px',
              textTransform: 'uppercase',
              position: 'relative',
              animation: 'colorChange 4s ease-in-out infinite',
              fontFamily: "'Roboto Slab', serif",
              fontStyle: 'normal',
              lineHeight: '1'
            }}>
              LOGIN
              <div style={{
                content: '',
                position: 'absolute',
                bottom: '-18px',
                left: '50%',
                transform: 'translateX(-50%)',
                width: '140px',
                height: '6px',
                background: 'linear-gradient(90deg, transparent, #ffffff 15%, #cccccc 30%, #000000 50%, #cccccc 70%, #ffffff 85%, transparent)',
                borderRadius: '3px',
                boxShadow: `
                  0 0 25px rgba(255, 255, 255, 0.7),
                  0 3px 10px rgba(0, 0, 0, 0.3)
                `,
                animation: 'underlineColorChange 4s ease-in-out infinite'
              }}></div>
            </h1>
          </div>

          {/* Right Side - Form */}
          <div style={{ flex: 1 }}>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {error && (
                <div style={{
                  background: 'rgba(255, 99, 132, 0.15)',
                  color: '#ff6384',
                  padding: '14px',
                  borderRadius: '10px',
                  textAlign: 'center',
                  fontWeight: '600',
                  fontSize: '14px',
                  border: '1px solid rgba(255, 99, 132, 0.3)',
                  backdropFilter: 'blur(10px)',
                  textShadow: '0 1px 3px rgba(0, 0, 0, 0.3)',
                  animation: 'slideInUp 0.3s ease-out'
                }}>
                  <i className="bi bi-exclamation-triangle" style={{ marginRight: '8px' }}></i>
                  {error}
                </div>
              )}

              {/* Login attempts warning */}
              {loginAttempts > 0 && loginAttempts < 5 && (
                <div style={{
                  background: 'rgba(255, 193, 7, 0.15)',
                  color: '#ffc107',
                  padding: '12px',
                  borderRadius: '10px',
                  textAlign: 'center',
                  fontWeight: '600',
                  fontSize: '13px',
                  border: '1px solid rgba(255, 193, 7, 0.3)',
                  backdropFilter: 'blur(10px)'
                }}>
                  <i className="bi bi-shield-exclamation" style={{ marginRight: '8px' }}></i>
                  {5 - loginAttempts} attempts remaining before account lock
                </div>
              )}

              {/* Account blocked message */}
              {isBlocked && (
                <div style={{
                  background: 'rgba(220, 53, 69, 0.15)',
                  color: '#dc3545',
                  padding: '14px',
                  borderRadius: '10px',
                  textAlign: 'center',
                  fontWeight: '600',
                  fontSize: '14px',
                  border: '1px solid rgba(220, 53, 69, 0.3)',
                  backdropFilter: 'blur(10px)'
                }}>
                  <i className="bi bi-lock-fill" style={{ marginRight: '8px' }}></i>
                  Account temporarily locked. Try again in {Math.ceil(blockTimeLeft / 60)} minutes.
                </div>
              )}

              {/* User ID Field */}
              <div style={{ position: 'relative', marginBottom: '10px' }}>
                <label style={{
                  display: 'block',
                  color: '#e8f4fd',
                  fontWeight: '700',
                  marginBottom: '10px',
                  fontSize: '15px',
                  textShadow: '0 2px 8px rgba(0, 0, 0, 0.4)',
                  textTransform: 'uppercase',
                  letterSpacing: '1px'
                }}>
                  <i className="bi bi-person-circle" style={{ 
                    marginRight: '10px', 
                    opacity: '0.9', 
                    color: '#c3e9ff',
                    filter: 'drop-shadow(0 1px 3px rgba(0, 0, 0, 0.3))'
                  }}></i>
                  USER ID / EMAIL
                </label>
                <input
                  type="text"
                  placeholder="Enter your Employee ID or Email"
                  value={userId}
                  onChange={(e) => handleInputChange('userId', e.target.value)}
                  required
                  autoFocus
                  disabled={isBlocked}
                  style={{
                    width: '100%',
                    padding: '16px 22px',
                    border: `2px solid ${validationErrors.userId ? 'rgba(255, 99, 132, 0.5)' : 'rgba(232, 244, 253, 0.3)'}`,
                    borderRadius: '12px',
                    outline: 'none',
                    background: isBlocked ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.08)',
                    color: isBlocked ? '#999' : '#ffffff',
                    fontSize: '16px',
                    fontWeight: '500',
                    transition: 'all 0.3s ease',
                    backdropFilter: 'blur(10px)',
                    opacity: isBlocked ? 0.6 : 1
                  }}
                  onFocus={(e) => {
                    if (!isBlocked) {
                      e.target.style.borderColor = 'rgba(232, 244, 253, 0.8)';
                      e.target.style.background = 'rgba(255, 255, 255, 0.15)';
                      e.target.style.transform = 'translateY(-2px)';
                      e.target.style.boxShadow = `
                        0 10px 25px rgba(0, 0, 0, 0.2),
                        0 0 20px rgba(232, 244, 253, 0.3)
                      `;
                    }
                  }}
                  onBlur={(e) => {
                    if (!isBlocked) {
                      e.target.style.borderColor = validationErrors.userId ? 'rgba(255, 99, 132, 0.5)' : 'rgba(232, 244, 253, 0.3)';
                      e.target.style.background = 'rgba(255, 255, 255, 0.08)';
                      e.target.style.transform = 'translateY(0)';
                      e.target.style.boxShadow = 'none';
                    }
                  }}
                />
                {validationErrors.userId && (
                  <div style={{
                    color: '#ff6384',
                    fontSize: '12px',
                    marginTop: '5px',
                    fontWeight: '500',
                    animation: 'slideInUp 0.2s ease-out'
                  }}>
                    <i className="bi bi-exclamation-circle" style={{ marginRight: '5px' }}></i>
                    {validationErrors.userId}
                  </div>
                )}
              </div>

              {/* Password Field */}
              <div style={{ position: 'relative', marginBottom: '10px' }}>
                <label style={{
                  display: 'block',
                  color: '#e8f4fd',
                  fontWeight: '700',
                  marginBottom: '10px',
                  fontSize: '15px',
                  textShadow: '0 2px 8px rgba(0, 0, 0, 0.4)',
                  textTransform: 'uppercase',
                  letterSpacing: '1px'
                }}>
                  <i className="bi bi-shield-lock" style={{ 
                    marginRight: '10px', 
                    opacity: '0.9', 
                    color: '#c3e9ff',
                    filter: 'drop-shadow(0 1px 3px rgba(0, 0, 0, 0.3))'
                  }}></i>
                  PASSWORD
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => handleInputChange('password', e.target.value)}
                    required
                    disabled={isBlocked}
                    minLength={6}
                    style={{
                      width: '100%',
                      padding: '16px 55px 16px 22px',
                      border: `2px solid ${validationErrors.password ? 'rgba(255, 99, 132, 0.5)' : 'rgba(232, 244, 253, 0.3)'}`,
                      borderRadius: '12px',
                      outline: 'none',
                      background: isBlocked ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.08)',
                      color: isBlocked ? '#999' : '#ffffff',
                      fontSize: '16px',
                      fontWeight: '500',
                      transition: 'all 0.3s ease',
                      backdropFilter: 'blur(10px)',
                      opacity: isBlocked ? 0.6 : 1
                    }}
                    onFocus={(e) => {
                      if (!isBlocked) {
                        e.target.style.borderColor = 'rgba(232, 244, 253, 0.8)';
                        e.target.style.background = 'rgba(255, 255, 255, 0.15)';
                        e.target.style.transform = 'translateY(-2px)';
                        e.target.style.boxShadow = `
                          0 10px 25px rgba(0, 0, 0, 0.2),
                          0 0 20px rgba(232, 244, 253, 0.3)
                        `;
                      }
                    }}
                    onBlur={(e) => {
                      if (!isBlocked) {
                        e.target.style.borderColor = validationErrors.password ? 'rgba(255, 99, 132, 0.5)' : 'rgba(232, 244, 253, 0.3)';
                        e.target.style.background = 'rgba(255, 255, 255, 0.08)';
                        e.target.style.transform = 'translateY(0)';
                        e.target.style.boxShadow = 'none';
                      }
                    }}
                  />
                  {/* Password visibility toggle */}
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isBlocked}
                    style={{
                      position: 'absolute',
                      right: '15px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'transparent',
                      border: 'none',
                      color: isBlocked ? '#666' : '#c3e9ff',
                      fontSize: '18px',
                      cursor: isBlocked ? 'not-allowed' : 'pointer',
                      opacity: isBlocked ? 0.5 : 0.8,
                      transition: 'opacity 0.3s ease'
                    }}
                    onMouseEnter={(e) => {
                      if (!isBlocked) {
                        e.target.style.opacity = '1';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isBlocked) {
                        e.target.style.opacity = '0.8';
                      }
                    }}
                  >
                    <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                  </button>
                </div>
                {validationErrors.password && (
                  <div style={{
                    color: '#ff6384',
                    fontSize: '12px',
                    marginTop: '5px',
                    fontWeight: '500',
                    animation: 'slideInUp 0.2s ease-out'
                  }}>
                    <i className="bi bi-exclamation-circle" style={{ marginRight: '5px' }}></i>
                    {validationErrors.password}
                  </div>
                )}
                
                {/* Password strength indicator */}
                {password && (
                  <div style={{ marginTop: '8px' }}>
                    <div style={{
                      fontSize: '11px',
                      color: '#c3e9ff',
                      marginBottom: '4px',
                      opacity: 0.8
                    }}>
                      Password Strength:
                    </div>
                    <div style={{
                      width: '100%',
                      height: '3px',
                      background: 'rgba(255, 255, 255, 0.1)',
                      borderRadius: '2px',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        height: '100%',
                        width: `${Math.min((password.length / 12) * 100, 100)}%`,
                        background: password.length < 6 ? '#ff6384' : 
                                  password.length < 8 ? '#ffc107' : '#28a745',
                        transition: 'all 0.3s ease',
                        borderRadius: '2px'
                      }}></div>
                    </div>
                  </div>
                )}
              </div>

              {/* Forgot Password */}
              <div style={{ textAlign: 'right', margin: '10px 0' }}>
                <button
                  type="button"
                  onClick={() => navigate('/forgot-password')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#c3e9ff',
                    textDecoration: 'none',
                    fontSize: '14px',
                    fontWeight: '600',
                    transition: 'all 0.3s ease',
                    textShadow: '0 2px 6px rgba(0, 0, 0, 0.4)',
                    textTransform: 'capitalize',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.color = '#ffffff';
                    e.target.style.textShadow = '0 0 15px rgba(195, 233, 255, 0.8)';
                    e.target.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.color = '#c3e9ff';
                    e.target.style.textShadow = '0 2px 6px rgba(0, 0, 0, 0.4)';
                    e.target.style.transform = 'translateY(0)';
                  }}
                >
                  <i className="bi bi-key" style={{ marginRight: '6px' }}></i>
                  Lost your password and advanced recovery?
                </button>
              </div>

              {/* Login Button */}
              <div style={{ marginTop: '25px' }}>
                <button
                  type="submit"
                  disabled={loading || isBlocked}
                  style={{
                    width: '100%',
                    padding: '18px',
                    fontSize: '18px',
                    fontWeight: '800',
                    color: isBlocked ? '#999' : '#ffffff',
                    border: 'none',
                    borderRadius: '14px',
                    background: isBlocked 
                      ? 'linear-gradient(135deg, #666 0%, #555 50%, #444 100%)'
                      : loading 
                        ? 'linear-gradient(135deg, #888 0%, #666 50%, #555 100%)'
                        : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 50%, #1e40af 100%)',
                    cursor: loading || isBlocked ? 'not-allowed' : 'pointer',
                    transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                    textTransform: 'uppercase',
                    letterSpacing: '2px',
                    boxShadow: loading || isBlocked 
                      ? 'none' 
                      : `
                        0 8px 30px rgba(59, 130, 246, 0.45),
                        inset 0 1px 0 rgba(255, 255, 255, 0.25)
                      `,
                    textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
                    opacity: isBlocked ? 0.6 : 1,
                    animation: loading || isBlocked ? 'none' : 'buttonPulse 3s ease-in-out infinite'
                  }}
                  onMouseEnter={(e) => {
                    if (!loading && !isBlocked) {
                      e.target.style.background = 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #2563eb 100%)';
                      e.target.style.transform = 'translateY(-5px) scale(1.02)';
                      e.target.style.boxShadow = `
                        0 18px 45px rgba(59, 130, 246, 0.55),
                        inset 0 1px 0 rgba(255, 255, 255, 0.35)
                      `;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!loading && !isBlocked) {
                      e.target.style.background = 'linear-gradient(135deg, #3b82f6 0%, #2563eb 50%, #1e40af 100%)';
                      e.target.style.transform = 'translateY(0) scale(1)';
                      e.target.style.boxShadow = `
                        0 8px 30px rgba(59, 130, 246, 0.45),
                        inset 0 1px 0 rgba(255, 255, 255, 0.25)
                      `;
                    }
                  }}
                >
                  {loading ? (
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                      <i className="bi bi-arrow-clockwise" style={{ 
                        animation: 'spin 1s linear infinite', 
                        fontSize: '16px' 
                      }}></i>
                      Authenticating...
                    </span>
                  ) : isBlocked ? (
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                      <i className="bi bi-lock-fill"></i>
                      Account Locked
                    </span>
                  ) : (
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                      <i className="bi bi-box-arrow-in-right"></i>
                      Secure Login
                    </span>
                  )}
                </button>
              </div>

              {/* Security Information */}
              <div style={{
                marginTop: '20px',
                padding: '14px',
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(5, 150, 105, 0.08) 100%)',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                borderRadius: '12px',
                textAlign: 'center',
                fontSize: '12px',
                color: '#10b981',
                fontWeight: '600',
                backdropFilter: 'blur(8px)',
                transition: 'all 0.3s ease',
                animation: 'slideInUp 0.5s ease-out 0.6s backwards'
              }}>
                <i className="bi bi-shield-check" style={{ marginRight: '8px', fontSize: '14px' }}></i>
                Your login is secured with advanced encryption
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
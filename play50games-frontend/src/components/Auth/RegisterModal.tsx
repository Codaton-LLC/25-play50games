'use client';

import { useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface RegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRegister: (firstName: string, lastName: string, username: string, email: string, password: string) => Promise<void>;
  onSwitchToLogin: () => void;
}

export default function RegisterModal({ isOpen, onClose, onRegister, onSwitchToLogin }: RegisterModalProps) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Field-specific errors
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  
  // Validation functions
  const validateFirstName = (value: string) => {
    if (!value.trim()) {
      return 'First name is required';
    }
    return '';
  };
  
  const validateLastName = (value: string) => {
    if (!value.trim()) {
      return 'Last name is required';
    }
    return '';
  };
  
  const validateUsername = (value: string) => {
    if (!value.trim()) {
      return 'Username is required';
    }
    if (value.length < 3) {
      return 'Username must be at least 3 characters';
    }
    return '';
  };
  
  const validateEmail = (value: string) => {
    if (!value.trim()) {
      return 'Email is required';
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      return 'Please enter a valid email address';
    }
    return '';
  };
  
  const validatePassword = (value: string) => {
    if (!value) {
      return 'Password is required';
    }
    if (value.length < 6) {
      return 'Password must be at least 6 characters';
    }
    return '';
  };
  
  const validateConfirmPassword = (value: string, passwordValue: string) => {
    if (!value) {
      return 'Please confirm your password';
    }
    if (value !== passwordValue) {
      return 'Passwords do not match';
    }
    return '';
  };
  
  // Handle field changes with validation
  const handleFirstNameChange = (value: string) => {
    setFirstName(value);
    setFieldErrors(prev => ({ ...prev, firstName: validateFirstName(value) }));
  };
  
  const handleLastNameChange = (value: string) => {
    setLastName(value);
    setFieldErrors(prev => ({ ...prev, lastName: validateLastName(value) }));
  };
  
  const handleUsernameChange = (value: string) => {
    setUsername(value);
    setFieldErrors(prev => ({ ...prev, username: validateUsername(value) }));
  };
  
  const handleEmailChange = (value: string) => {
    setEmail(value);
    setFieldErrors(prev => ({ ...prev, email: validateEmail(value) }));
  };
  
  const handlePasswordChange = (value: string) => {
    setPassword(value);
    setFieldErrors(prev => ({ 
      ...prev, 
      password: validatePassword(value),
      confirmPassword: confirmPassword ? validateConfirmPassword(confirmPassword, value) : ''
    }));
  };
  
  const handleConfirmPasswordChange = (value: string) => {
    setConfirmPassword(value);
    setFieldErrors(prev => ({ ...prev, confirmPassword: validateConfirmPassword(value, password) }));
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Validate all fields
    const errors: Record<string, string> = {
      firstName: validateFirstName(firstName),
      lastName: validateLastName(lastName),
      username: validateUsername(username),
      email: validateEmail(email),
      password: validatePassword(password),
      confirmPassword: validateConfirmPassword(confirmPassword, password),
    };
    
    setFieldErrors(errors);
    
    // Check if there are any errors
    if (Object.values(errors).some(err => err !== '')) {
      return;
    }

    setLoading(true);

    try {
      await onRegister(firstName, lastName, username, email, password);
      setFirstName('');
      setLastName('');
      setUsername('');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          <XMarkIcon style={{ width: 24, height: 24 }} />
        </button>
        
        <h2>Register</h2>
        
        {error && (
          <div className="error-message" style={{
            padding: '0.75rem',
            backgroundColor: 'rgba(252, 165, 165, 0.15)',
            border: '1px solid rgba(252, 165, 165, 0.4)',
            color: 'var(--warn)',
            marginBottom: '1rem',
            fontSize: '14px'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="register-firstname">First Name</label>
            <input
              id="register-firstname"
              type="text"
              value={firstName}
              onChange={(e) => handleFirstNameChange(e.target.value)}
              onBlur={() => setFieldErrors(prev => ({ ...prev, firstName: validateFirstName(firstName) }))}
              required
              placeholder="John"
              style={{ borderColor: fieldErrors.firstName ? 'var(--warn)' : undefined }}
            />
            {fieldErrors.firstName && (
              <small style={{ color: 'var(--warn)', fontSize: '0.875rem', display: 'block', marginTop: '0.25rem' }}>
                {fieldErrors.firstName}
              </small>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="register-lastname">Last Name</label>
            <input
              id="register-lastname"
              type="text"
              value={lastName}
              onChange={(e) => handleLastNameChange(e.target.value)}
              onBlur={() => setFieldErrors(prev => ({ ...prev, lastName: validateLastName(lastName) }))}
              required
              placeholder="Doe"
              style={{ borderColor: fieldErrors.lastName ? 'var(--warn)' : undefined }}
            />
            {fieldErrors.lastName && (
              <small style={{ color: 'var(--warn)', fontSize: '0.875rem', display: 'block', marginTop: '0.25rem' }}>
                {fieldErrors.lastName}
              </small>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="register-username">Username</label>
            <input
              id="register-username"
              type="text"
              value={username}
              onChange={(e) => handleUsernameChange(e.target.value)}
              onBlur={() => setFieldErrors(prev => ({ ...prev, username: validateUsername(username) }))}
              required
              placeholder="johndoe"
              minLength={3}
              style={{ borderColor: fieldErrors.username ? 'var(--warn)' : undefined }}
            />
            {fieldErrors.username ? (
              <small style={{ color: 'var(--warn)', fontSize: '0.875rem', display: 'block', marginTop: '0.25rem' }}>
                {fieldErrors.username}
              </small>
            ) : (
              <small style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>
                Must be at least 3 characters
              </small>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="register-email">Email</label>
            <input
              id="register-email"
              type="email"
              value={email}
              onChange={(e) => handleEmailChange(e.target.value)}
              onBlur={() => setFieldErrors(prev => ({ ...prev, email: validateEmail(email) }))}
              required
              placeholder="your@email.com"
              style={{ borderColor: fieldErrors.email ? 'var(--warn)' : undefined }}
            />
            {fieldErrors.email && (
              <small style={{ color: 'var(--warn)', fontSize: '0.875rem', display: 'block', marginTop: '0.25rem' }}>
                {fieldErrors.email}
              </small>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="register-password">Password</label>
            <input
              id="register-password"
              type="password"
              value={password}
              onChange={(e) => handlePasswordChange(e.target.value)}
              onBlur={() => setFieldErrors(prev => ({ ...prev, password: validatePassword(password) }))}
              required
              placeholder="••••••••"
              minLength={6}
              style={{ borderColor: fieldErrors.password ? 'var(--warn)' : undefined }}
            />
            {fieldErrors.password ? (
              <small style={{ color: 'var(--warn)', fontSize: '0.875rem', display: 'block', marginTop: '0.25rem' }}>
                {fieldErrors.password}
              </small>
            ) : (
              <small style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>
                Must be at least 6 characters
              </small>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="register-confirm-password">Confirm Password</label>
            <input
              id="register-confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => handleConfirmPasswordChange(e.target.value)}
              onBlur={() => setFieldErrors(prev => ({ ...prev, confirmPassword: validateConfirmPassword(confirmPassword, password) }))}
              required
              placeholder="••••••••"
              style={{ borderColor: fieldErrors.confirmPassword ? 'var(--warn)' : undefined }}
            />
            {fieldErrors.confirmPassword && (
              <small style={{ color: 'var(--warn)', fontSize: '0.875rem', display: 'block', marginTop: '0.25rem' }}>
                {fieldErrors.confirmPassword}
              </small>
            )}
          </div>

          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Registering...' : 'Register'}
          </button>
        </form>

        <div style={{ marginTop: '1rem', textAlign: 'center' }}>
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: '14px' }}>
            Already have an account?{' '}
            <button
              type="button"
              onClick={onSwitchToLogin}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--accent)',
                cursor: 'pointer',
                textDecoration: 'underline',
                fontSize: '14px',
                fontWeight: '600'
              }}
            >
              Login here
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}


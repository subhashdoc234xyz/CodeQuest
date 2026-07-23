import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

export default function LoginForm({ onToggleForm, onForgot }) {
  const { login, loginWithGoogle, loginWithGithub } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err.message.replace('Firebase: ', ''));
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (providerFn) => {
    setError('');
    try {
      await providerFn();
    } catch (err) {
      setError(err.message.replace('Firebase: ', ''));
    }
  };

  return (
    <div className="modal-overlay" style={{ background: '#0B1D3A' }}>
      <div className="modal" style={{ maxWidth: '400px' }}>
        <div className="brand" style={{ justifyContent: 'center', marginBottom: '24px', fontSize: '1.5rem' }}>
          <span>🚀 CodeQuest</span>
        </div>
        <h2 className="modal-title" style={{ textAlign: 'center', marginBottom: '24px' }}>Welcome back</h2>
        
        {error && (
          <div style={{ color: '#FF5A5F', background: 'rgba(255, 90, 95, 0.1)', padding: '10px', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '16px', border: '1px solid rgba(255, 90, 95, 0.2)' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column' }}>
          <input
            type="email"
            className="input-field"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
          />
          <input
            type="password"
            className="input-field"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
          />
          
          <div style={{ textAlign: 'right', marginBottom: '16px' }}>
            <button 
              type="button"
              onClick={onForgot}
              style={{ background: 'transparent', border: 'none', color: '#3E6BD6', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 500 }}
            >
              Forgot Password?
            </button>
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px' }} disabled={loading}>
            {loading ? "Signing in..." : "Log In"}
          </button>
        </form>

        <div style={{ position: 'relative', margin: '20px 0', textAlign: 'center' }}>
          <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '1px', background: '#E5E9F0', zIndex: 1 }}></div>
          <span style={{ position: 'relative', zIndex: 2, background: '#FFFFFF', padding: '0 12px', fontSize: '0.8rem', color: '#5B6472' }}>OR CONTINUE WITH</span>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            type="button" 
            className="btn btn-secondary" 
            style={{ flex: 1 }} 
            onClick={() => handleOAuth(loginWithGoogle)}
          >
            Google
          </button>
          <button 
            type="button" 
            className="btn btn-secondary" 
            style={{ flex: 1 }} 
            onClick={() => handleOAuth(loginWithGithub)}
          >
            GitHub
          </button>
        </div>

        <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '0.85rem' }}>
          <span style={{ color: '#5B6472' }}>Don't have an account? </span>
          <button 
            type="button"
            onClick={onToggleForm}
            style={{ background: 'transparent', border: 'none', color: '#3E6BD6', fontWeight: 600, cursor: 'pointer' }}
          >
            Sign Up
          </button>
        </div>
      </div>
    </div>
  );
}

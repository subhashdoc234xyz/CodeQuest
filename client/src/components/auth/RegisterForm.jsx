import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

export default function RegisterForm({ onToggleForm }) {
  const { register } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      return setError('Passwords do not match');
    }

    if (password.length < 6) {
      return setError('Password must be at least 6 characters');
    }

    setLoading(true);
    try {
      await register(email, password);
    } catch (err) {
      setError(err.message.replace('Firebase: ', ''));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ background: '#0B1D3A' }}>
      <div className="modal" style={{ maxWidth: '400px' }}>
        <div className="brand" style={{ justifyContent: 'center', marginBottom: '24px', fontSize: '1.5rem' }}>
          <span>🚀 CodeQuest</span>
        </div>
        <h2 className="modal-title" style={{ textAlign: 'center', marginBottom: '24px' }}>Create learning account</h2>

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
          <input
            type="password"
            className="input-field"
            placeholder="Confirm Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            disabled={loading}
          />

          <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px', marginTop: '8px' }} disabled={loading}>
            {loading ? "Creating account..." : "Sign Up"}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '0.85rem' }}>
          <span style={{ color: '#5B6472' }}>Already have an account? </span>
          <button 
            type="button"
            onClick={onToggleForm}
            style={{ background: 'transparent', border: 'none', color: '#3E6BD6', fontWeight: 600, cursor: 'pointer' }}
          >
            Log In
          </button>
        </div>
      </div>
    </div>
  );
}

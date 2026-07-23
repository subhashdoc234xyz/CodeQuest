import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

export default function ForgotPassword({ onBackToLogin }) {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      await resetPassword(email);
      setMessage('Check your inbox for a password reset email.');
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
        <h2 className="modal-title" style={{ textAlign: 'center', marginBottom: '16px' }}>Reset Password</h2>
        
        {error && (
          <div style={{ color: '#FF5A5F', background: 'rgba(255, 90, 95, 0.1)', padding: '10px', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '16px', border: '1px solid rgba(255, 90, 95, 0.2)' }}>
            {error}
          </div>
        )}

        {message && (
          <div style={{ color: '#3EBE7A', background: 'rgba(62, 190, 122, 0.1)', padding: '10px', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '16px', border: '1px solid rgba(62, 190, 122, 0.2)' }}>
            {message}
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
          <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px', marginTop: '8px' }} disabled={loading}>
            {loading ? "Sending..." : "Send Reset Email"}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '0.85rem' }}>
          <button 
            type="button"
            onClick={onBackToLogin}
            style={{ background: 'transparent', border: 'none', color: '#3E6BD6', fontWeight: 600, cursor: 'pointer' }}
          >
            Back to Login
          </button>
        </div>
      </div>
    </div>
  );
}

import React from 'react';
import { useAuth } from '../../context/AuthContext';

export default function ProtectedRoute({ children }) {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: '#0B1D3A',
        color: '#FFFFFF'
      }}>
        <span>Loading session...</span>
      </div>
    );
  }

  return children;
}

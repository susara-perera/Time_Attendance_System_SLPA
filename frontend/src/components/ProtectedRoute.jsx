import React, { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const ProtectedRoute = ({ children }) => {
  const { user, loading, isAuthenticated } = useContext(AuthContext);

  // Show loading screen while checking authentication
  if (loading) {
    return (
      <div className="loading-screen d-flex justify-content-center align-items-center min-vh-100">
        <div className="text-center">
          <div className="spinner-border text-primary mb-3" role="status" style={{ width: '3rem', height: '3rem' }}>
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="text-muted">Verifying your session...</p>
        </div>
      </div>
    );
  }

  // Check if user is authenticated and account is active
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  // Check if user account is active
  if (user.isActive === false) {
    return (
      <div className="error-screen d-flex justify-content-center align-items-center min-vh-100">
        <div className="text-center">
          <h3 className="text-danger mb-3">Account Deactivated</h3>
          <p className="text-muted">Your account has been deactivated. Please contact the administrator.</p>
          <button 
            className="btn btn-primary"
            onClick={() => window.location.href = '/login'}
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return children;
};

export default ProtectedRoute;
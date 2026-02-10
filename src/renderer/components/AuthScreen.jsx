import React, { useState } from 'react';
import { FiMail, FiLock, FiUser, FiAlertCircle, FiCode } from 'react-icons/fi';
import FirebaseService from '../services/FirebaseService';
import './AuthScreen.css';

function AuthScreen({ onAuthSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: ''
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      let result;

      if (isLogin) {
        result = await FirebaseService.signIn(formData.email, formData.password);
      } else {
        result = await FirebaseService.signUp(formData.email, formData.password, formData.name);
      }

      if (result.success) {
        onAuthSuccess(result.user);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setError(null);
    setFormData({ email: '', password: '', name: '' });
  };

  return (
    <div className="auth-screen">
      <div className="auth-container">
        <div className="auth-content">
          <div className="auth-info">
            <div className="auth-logo-title">
              <FiCode size={40} color="#1a73e8" style={{ marginBottom: '10px' }} />
              <h1>ExternAI</h1>
            </div>
            <p className="auth-description">
              ExternAI is a powerful desktop IDE with advanced AI capabilities.
              Build websites, mobile apps, and games with intelligent code generation, real-time debugging assistance,
              and an integrated terminal—all powered by cutting-edge AI technology to accelerate your development workflow.
            </p>
          </div>

          <div className="auth-card">
            <h2>{isLogin ? 'Welcome Back' : 'Create Account'}</h2>
            <p className="auth-subtitle">
              {isLogin ? 'Sign in to continue' : 'Get started with ExternAI'}
            </p>

            {error && (
              <div className="auth-error">
                <FiAlertCircle />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="auth-form">
              {!isLogin && (
                <div className="form-group">
                  <label htmlFor="name">
                    <FiUser size={16} />
                    Full Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required={!isLogin}
                    placeholder="Enter your name"
                    disabled={loading}
                  />
                </div>
              )}

              <div className="form-group">
                <label htmlFor="email">
                  <FiMail size={16} />
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  placeholder="your@email.com"
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label htmlFor="password">
                  <FiLock size={16} />
                  Password
                </label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  minLength={8}
                  placeholder="Enter password (min 8 characters)"
                  disabled={loading}
                />
              </div>

              <button type="submit" className="auth-button" disabled={loading}>
                {loading ? 'Please wait...' : (isLogin ? 'Sign In' : 'Create Account')}
              </button>
            </form>

            <div className="auth-footer">
              <p>
                {isLogin ? "Don't have an account?" : 'Already have an account?'}
                {' '}
                <button onClick={toggleMode} className="auth-toggle" disabled={loading}>
                  {isLogin ? 'Sign up' : 'Sign in'}
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AuthScreen;

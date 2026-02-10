import React, { useState, useEffect } from 'react';
import { FiCode } from 'react-icons/fi';
import './SplashScreen.css';

const SplashScreen = ({ onLoadComplete }) => {
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('Initializing...');
  const [fadeOut, setFadeOut] = useState(false);

  const loadingSteps = [
    { progress: 15, text: 'Loading core modules...' },
    { progress: 30, text: 'Initializing AI engine...' },
    { progress: 45, text: 'Setting up workspace...' },
    { progress: 60, text: 'Connecting to services...' },
    { progress: 75, text: 'Loading editor components...' },
    { progress: 90, text: 'Finalizing setup...' },
    { progress: 100, text: 'Ready!' },
  ];

  useEffect(() => {
    let stepIndex = 0;
    const interval = setInterval(() => {
      if (stepIndex < loadingSteps.length) {
        setProgress(loadingSteps[stepIndex].progress);
        setStatusText(loadingSteps[stepIndex].text);
        stepIndex++;
      } else {
        clearInterval(interval);
        setTimeout(() => {
          setFadeOut(true);
          setTimeout(() => {
            onLoadComplete?.();
          }, 500);
        }, 300);
      }
    }, 400);

    return () => clearInterval(interval);
  }, [onLoadComplete]);

  return (
    <div className={`splash-screen ${fadeOut ? 'fade-out' : ''}`}>
      {/* Animated background */}
      <div className="splash-bg">
        <div className="splash-gradient"></div>
        <div className="splash-particles">
          {[...Array(50)].map((_, i) => (
            <div
              key={i}
              className="particle"
              style={{
                '--delay': `${Math.random() * 5}s`,
                '--duration': `${3 + Math.random() * 4}s`,
                '--x': `${Math.random() * 100}%`,
                '--y': `${Math.random() * 100}%`,
                '--size': `${2 + Math.random() * 4}px`,
              }}
            />
          ))}
        </div>
        <div className="splash-grid"></div>
      </div>

      {/* Main content */}
      <div className="splash-content">
        <div className="splash-logo-container">
          <div className="splash-logo">
            <div className="logo-icon">
              <FiCode size={48} color="#00d9ff" />
            </div>
            <div className="logo-glow"></div>
          </div>

          <h1 className="splash-title">
            <span className="title-extern">extern</span>
            <span className="title-ai">AI</span>
          </h1>
          <p className="splash-tagline">Your AI-Powered Development Environment</p>
        </div>

        {/* Progress section */}
        <div className="splash-progress-section">
          <div className="progress-bar-container">
            <div className="progress-bar-bg">
              <div
                className="progress-bar-fill"
                style={{ width: `${progress}%` }}
              >
                <div className="progress-bar-glow"></div>
              </div>
            </div>
            <div className="progress-percentage">{progress}%</div>
          </div>
          <p className="progress-status">{statusText}</p>
        </div>

        {/* Bottom info */}
        <div className="splash-footer">
          <div className="splash-version">v1.0.16</div>
          <div className="splash-dots">
            <span className="dot"></span>
            <span className="dot"></span>
            <span className="dot"></span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SplashScreen;

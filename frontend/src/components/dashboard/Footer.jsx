import React from 'react';
import './Footer.css';
import footerVideo from '../../assets/fottermp4.mp4';


const Footer = () => {
  return (
    <div className="footer-wrapper">
      {/* Video Background Section with Text Overlay */}
      <div className="footer-video-section">
        <div className="video-container">
          <video 
            className="footer-video" 
            autoPlay 
            loop 
            muted 
            playsInline
          >
            <source src={footerVideo} type="video/mp4" />
            Your browser does not support the video tag.
          </video>
          
          {/* Text Overlay on Video */}
          <div className="video-text-overlay">
            <div className="video-text-content">
              <div className="center-text">
                <span className="authority-name">Copyright © Ports Authority 2025. All rights reserved.</span>
                <span className="info-system">Created By: INFORMATION SYSTEM</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Footer;

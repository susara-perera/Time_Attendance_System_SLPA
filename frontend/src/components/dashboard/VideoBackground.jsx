import React from 'react';
import './VideoBackground.css';
import backgroundVideo from '../../assets/fottermp4.mp4';

const VideoBackground = () => {
  return (
    <div className="video-background-overlay">
      <video 
        className="background-video" 
        autoPlay 
        loop 
        muted 
        playsInline
      >
        <source src={backgroundVideo} type="video/mp4" />
        Your browser does not support the video tag.
      </video>
      <div className="video-background-overlay-filter"></div>
    </div>
  );
};

export default VideoBackground;

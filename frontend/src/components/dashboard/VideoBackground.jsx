import React from 'react';
import './VideoBackground.css';
import fingerbackVideo from '/assets/fingerback.mp4';

const VideoBackground = () => {
  return (
    <div className="video-background-overlay">
      <video 
        className="fingerback-video" 
        autoPlay 
        loop 
        muted 
        playsInline
      >
        <source src={fingerbackVideo} type="video/mp4" />
        Your browser does not support the video tag.
      </video>
      <div className="video-background-overlay-filter"></div>
    </div>
  );
};

export default VideoBackground;

import React, { useState, useEffect, useRef } from 'react';

export default function PhotoCard({ photo, squareMode, rowHeight, aspectRatio, onClick }) {
  const [imgSrc, setImgSrc] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [hovered, setHovered] = useState(false);
  const cardRef = useRef(null);

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) {
          const src = photo.thumbnailPath
            ? `localfile://${photo.thumbnailPath}`
            : photo.originalPath
              ? `localfile://${photo.originalPath}`
              : null;
          setImgSrc(src);
          observer.disconnect();
        }
      },
      { rootMargin: '300px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [photo.uuid]);

  const handleError = () => {
    if (photo.originalPath && imgSrc !== `localfile://${photo.originalPath}`) {
      setImgSrc(`localfile://${photo.originalPath}`);
    } else {
      setError(true);
    }
  };

  // In square mode: use aspect-ratio:1 and let the grid determine size.
  // In ratio mode: fixed height with proportional width.
  const style = squareMode
    ? { aspectRatio: '1' }
    : { height: `${rowHeight}px`, width: `${rowHeight * (aspectRatio || 1)}px`, flexShrink: 0 };

  return (
    <div
      ref={cardRef}
      className="photo-card relative bg-mac-card overflow-hidden cursor-pointer"
      style={style}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Skeleton */}
      {!loaded && !error && (
        <div className="absolute inset-0 bg-mac-card animate-pulse" />
      )}

      {/* Image */}
      {!error && imgSrc && (
        <img
          src={imgSrc}
          alt={photo.filename}
          className={`photo-img w-full h-full object-cover ${loaded ? 'loaded' : 'loading'}`}
          onLoad={() => setLoaded(true)}
          onError={handleError}
          draggable={false}
        />
      )}

      {/* Placeholder */}
      {(error || (!imgSrc && loaded)) && (
        <div className="w-full h-full flex items-center justify-center">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-mac-text-secondary opacity-30">
            <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
          </svg>
        </div>
      )}

      {/* Hover overlay */}
      {hovered && <div className="absolute inset-0 bg-black/10 pointer-events-none" />}

      {/* Favorite badge */}
      {photo.favorite && (
        <div className="absolute bottom-1 left-1">
          <svg viewBox="0 0 24 24" fill="#ff453a" className="w-3.5 h-3.5 drop-shadow">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
          </svg>
        </div>
      )}

      {/* Video badge */}
      {photo.isVideo && (
        <div className="absolute bottom-1 right-1 bg-black/60 rounded px-1 py-0.5 flex items-center gap-0.5">
          <svg viewBox="0 0 24 24" fill="white" className="w-2.5 h-2.5"><path d="M8 5v14l11-7z"/></svg>
          {photo.duration > 0 && (
            <span className="text-white" style={{ fontSize: '9px' }}>{fmtDur(photo.duration)}</span>
          )}
        </div>
      )}
    </div>
  );
}

function fmtDur(s) {
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

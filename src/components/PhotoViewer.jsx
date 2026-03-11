import React, { useState, useEffect, useCallback, useRef } from 'react';

const APPLE_EPOCH = 978307200;
const IS_MAC = window.photosAPI?.platform === 'darwin';

function appleToDate(ts) { return ts ? new Date((ts + APPLE_EPOCH) * 1000) : null; }
function fmtDate(d) {
  if (!d) return '未知日期';
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric', month: 'long', day: 'numeric',
    weekday: 'long', hour: '2-digit', minute: '2-digit',
  });
}
function fmtShutter(s) {
  if (!s) return null;
  return s >= 1 ? `${s}s` : `1/${Math.round(1 / s)}s`;
}

export default function PhotoViewer({ photo, photos, onClose, onNavigate, onFavoriteToggle }) {
  const [detail, setDetail] = useState(null);
  const [mediaSrc, setMediaSrc] = useState(null);
  const [mediaLoaded, setMediaLoaded] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [heicLoading, setHeicLoading] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [isFavorite, setIsFavorite] = useState(photo.favorite);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showLive, setShowLive] = useState(false);
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const liveTimerRef = useRef(null);

  // Long-press handlers for Live Photo (like iOS behavior)
  // Use Pointer Events instead of Mouse Events so macOS trackpad gestures
  // don't get intercepted by the system (drag detection, text selection, etc.)
  const handleLivePressStart = useCallback((e) => {
    e.preventDefault();
    // Capture pointer so pointerup fires on this element even if pointer moves away
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
    liveTimerRef.current = setTimeout(() => setShowLive(true), 180);
  }, []);
  const handleLivePressEnd = useCallback(() => {
    clearTimeout(liveTimerRef.current);
    setShowLive(false);
  }, []);
  useEffect(() => {
    return () => clearTimeout(liveTimerRef.current);
  }, []);

  const idx = photos.findIndex(p => p.uuid === photo.uuid);

  useEffect(() => {
    setMediaLoaded(false);
    setDetail(null);
    setVideoError(false);
    setHeicLoading(false);
    setShowLive(false);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setIsFavorite(photo.favorite);

    // Load original directly — protocol handler now returns correct MIME type
    // so Chromium renders HEIC natively on macOS without any conversion.
    if (photo.isVideo) {
      setMediaSrc(photo.originalPath ? `localfile://${photo.originalPath}` : null);
    } else if (photo.originalPath) {
      setMediaSrc(`localfile://${photo.originalPath}`);
    } else if (photo.thumbnailPath) {
      setMediaSrc(`localfile://${photo.thumbnailPath}`);
    } else {
      setMediaSrc(null);
    }
    window.photosAPI.getPhotoDetail(photo.uuid).then(setDetail);
  }, [photo.uuid]);

  const handleImgError = useCallback(() => {
    // If HEIC failed to render (non-macOS or older Chromium), try sips conversion
    if (photo.originalPath && !photo.isVideo) {
      const ext = photo.originalPath.split('.').pop().toLowerCase();
      if ((ext === 'heic' || ext === 'heif') && IS_MAC && window.photosAPI.getHeicJpeg) {
        const alreadyConverted = mediaSrc?.includes('/plv_');
        if (!alreadyConverted) {
          setHeicLoading(true);
          window.photosAPI.getHeicJpeg(photo.uuid, photo.originalPath).then(result => {
            setHeicLoading(false);
            if (result.path) {
              setMediaSrc(`localfile://${result.path}`);
              return;
            }
            if (photo.thumbnailPath) setMediaSrc(`localfile://${photo.thumbnailPath}`);
          });
          return;
        }
      }
    }
    if (photo.thumbnailPath && mediaSrc !== `localfile://${photo.thumbnailPath}`) {
      setMediaSrc(`localfile://${photo.thumbnailPath}`);
    }
  }, [photo, mediaSrc]);

  const navigate = useCallback((dir) => {
    const ni = idx + dir;
    if (ni >= 0 && ni < photos.length) onNavigate(photos[ni]);
  }, [idx, photos, onNavigate]);

  const handleKeyDown = useCallback((e) => {
    if (e.target.tagName === 'INPUT') return;
    switch (e.key) {
      case 'Escape': onClose(); break;
      case 'ArrowLeft': navigate(-1); break;
      case 'ArrowRight': navigate(1); break;
      case 'i': case 'I': setShowInfo(v => !v); break;
      case '+': case '=': if (!photo.isVideo) setZoom(z => Math.min(z * 1.25, 8)); break;
      case '-': if (!photo.isVideo) setZoom(z => Math.max(z / 1.25, 0.1)); break;
      case '0': setZoom(1); setPan({ x: 0, y: 0 }); break;
    }
  }, [navigate, onClose, photo.isVideo]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // non-passive wheel for zoom (photos only)
  useEffect(() => {
    if (photo.isVideo) return;
    const el = containerRef.current;
    if (!el) return;
    const handler = e => {
      e.preventDefault();
      setZoom(z => Math.min(Math.max(z * (e.deltaY > 0 ? 0.9 : 1.1), 0.1), 8));
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [photo.isVideo]);

  const handleMouseDown = e => {
    if (photo.isVideo || zoom <= 1) return;
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };
  const handleMouseMove = e => {
    if (!isDragging) return;
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };
  const handleMouseUp = () => setIsDragging(false);
  const handleDblClick = () => {
    if (photo.isVideo) return;
    if (zoom === 1) { setZoom(2); } else { setZoom(1); setPan({ x: 0, y: 0 }); }
  };

  const toggleFav = async () => {
    const result = await window.photosAPI.toggleFavorite(photo.uuid);
    if (result.success) {
      const newVal = result.isFavorite;
      setIsFavorite(newVal);
      onFavoriteToggle?.(photo.uuid, newVal);
    }
  };

  const date = appleToDate(photo.dateCreated);

  return (
    <div
      className="fixed inset-0 z-[1000] bg-black/95 flex flex-col photo-viewer-overlay fade-in"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* ── Top toolbar ─────────────────────────────────────────────────── */}
      <div
        className="flex items-center h-12 bg-black/50 flex-shrink-0 gap-2"
        style={{ paddingLeft: IS_MAC ? '88px' : '12px', paddingRight: '12px' }}
      >
        {/* Back */}
        <button
          className="p-1.5 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-colors flex-shrink-0"
          onClick={onClose}
          title="返回 (ESC)"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
          </svg>
        </button>

        {/* Center */}
        <div className="flex-1 text-center min-w-0">
          <p className="text-sm font-medium text-white truncate">{photo.filename}</p>
          {date && <p className="text-xs text-white/50">{fmtDate(date)}</p>}
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-xs text-white/40 mr-1">{idx + 1} / {photos.length}</span>

          {/* Zoom reset (photos only) */}
          {!photo.isVideo && (
            <button
              className="p-1.5 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors"
              onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
              title="适合窗口 (0)"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
              </svg>
            </button>
          )}

          {/* Favorite */}
          <button
            className={`p-1.5 rounded hover:bg-white/10 transition-colors ${isFavorite ? 'text-red-400' : 'text-white/60 hover:text-white'}`}
            onClick={toggleFav}
            title={isFavorite ? '取消收藏' : '加入收藏'}
          >
            <svg viewBox="0 0 24 24"
              fill={isFavorite ? 'currentColor' : 'none'}
              stroke="currentColor" strokeWidth={isFavorite ? 0 : 2}
              className="w-4 h-4">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
            </svg>
          </button>

          {/* Info */}
          <button
            className={`p-1.5 rounded transition-colors ${showInfo ? 'bg-white/20 text-white' : 'hover:bg-white/10 text-white/60 hover:text-white'}`}
            onClick={() => setShowInfo(v => !v)}
            title="照片信息 (I)"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
            </svg>
          </button>
        </div>
      </div>

      {/* ── Main area ────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Prev */}
        <button
          className={`flex-shrink-0 w-14 flex items-center justify-center hover:bg-white/5 transition-colors ${idx === 0 ? 'opacity-20 cursor-default' : ''}`}
          onClick={() => navigate(-1)} disabled={idx === 0}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-white drop-shadow-lg">
            <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
          </svg>
        </button>

        {/* Media */}
        <div
          ref={containerRef}
          className="flex-1 flex items-center justify-center overflow-hidden relative"
          style={{ cursor: !photo.isVideo && zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
          onMouseDown={handleMouseDown}
          onDoubleClick={handleDblClick}
        >
          {/* Spinner */}
          {(heicLoading || (!mediaLoaded && mediaSrc)) && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="spinner w-8 h-8 border-2 border-white/20 border-t-white rounded-full" />
            </div>
          )}

          {photo.isVideo ? (
            /* ── VIDEO ──────────────────────────────────────────────── */
            videoError || !mediaSrc ? (
              <NoMedia
                label={mediaSrc ? '视频格式不支持或文件损坏' : '视频文件未找到'}
                path={photo.originalPath || `${photo.directory}/${photo.filename}`}
              />
            ) : (
              <video
                ref={videoRef}
                key={mediaSrc}
                src={mediaSrc}
                controls
                autoPlay
                className="max-w-full max-h-full outline-none"
                style={{ opacity: mediaLoaded ? 1 : 0, transition: 'opacity 0.2s' }}
                onCanPlay={() => setMediaLoaded(true)}
                onError={() => { setMediaLoaded(true); setVideoError(true); }}
              />
            )
          ) : (
            /* ── IMAGE ──────────────────────────────────────────────── */
            mediaSrc ? (
              <>
                <img
                  key={mediaSrc}
                  src={mediaSrc}
                  alt={photo.filename}
                  className="max-w-full max-h-full object-contain select-none"
                  style={{
                    opacity: mediaLoaded && !showLive ? 1 : 0,
                    transition: isDragging ? 'none' : 'opacity 0.2s, transform 0.1s ease',
                    transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
                    transformOrigin: 'center',
                  }}
                  onLoad={() => setMediaLoaded(true)}
                  onError={handleImgError}
                  draggable={false}
                />
                {/* Live Photo video overlay */}
                {photo.isLive && photo.liveVideoPath && showLive && (
                  <video
                    key={photo.liveVideoPath}
                    src={`localfile://${photo.liveVideoPath}`}
                    autoPlay
                    muted
                    className="absolute inset-0 w-full h-full object-contain"
                    onEnded={() => setShowLive(false)}
                    onError={() => setShowLive(false)}
                  />
                )}
                {/* LIVE badge — long-press to play (like iOS) */}
                {photo.isLive && photo.liveVideoPath && (
                  <div
                    className={`absolute top-3 left-3 flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold backdrop-blur-sm select-none cursor-pointer transition-colors ${
                      showLive ? 'bg-white text-black' : 'bg-black/50 text-white'
                    }`}
                    onPointerDown={handleLivePressStart}
                    onPointerUp={handleLivePressEnd}
                    onPointerCancel={handleLivePressEnd}
                    title="长按播放 Live Photo"
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
                      <circle cx="12" cy="12" r="3"/>
                      <path d="M12 1v3M12 20v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M1 12h3M20 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/>
                    </svg>
                    LIVE
                  </div>
                )}
              </>
            ) : !heicLoading ? (
              <NoMedia label="无法加载照片" path={`${photo.directory}/${photo.filename}`} />
            ) : null
          )}

          {/* Zoom indicator */}
          {!photo.isVideo && zoom !== 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 rounded-full px-3 py-1 text-white text-xs pointer-events-none">
              {Math.round(zoom * 100)}%
            </div>
          )}
        </div>

        {/* Next */}
        <button
          className={`flex-shrink-0 w-14 flex items-center justify-center hover:bg-white/5 transition-colors ${idx === photos.length - 1 ? 'opacity-20 cursor-default' : ''}`}
          onClick={() => navigate(1)} disabled={idx === photos.length - 1}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-white drop-shadow-lg">
            <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
          </svg>
        </button>

        {/* Info panel */}
        {showInfo && detail && (
          <div className="w-72 bg-black/60 border-l border-white/10 overflow-y-auto flex-shrink-0 slide-in">
            <InfoPanel detail={detail} isFavorite={isFavorite} />
          </div>
        )}
      </div>

      {/* ── Filmstrip ───────────────────────────────────────────────────── */}
      <FilmStrip photos={photos} currentIdx={idx} onSelect={onNavigate} />
    </div>
  );
}

function NoMedia({ label, path }) {
  return (
    <div className="text-white/30 text-center px-8 max-w-md">
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-20 h-20 mx-auto mb-2">
        <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
      </svg>
      <p className="text-sm text-white/50 mb-1">{label}</p>
      {path && <p className="text-xs opacity-40 break-all">{path}</p>}
    </div>
  );
}

function InfoPanel({ detail, isFavorite }) {
  const date = detail.dateCreated ? new Date((detail.dateCreated + 978307200) * 1000) : null;

  const rows = [
    { label: '文件名', value: detail.filename },
    { label: '日期', value: date ? fmtDate(date) : null },
    { label: '尺寸', value: detail.width && detail.height ? `${detail.width} × ${detail.height}` : null },
    { label: '相机', value: detail.camera },
    { label: '镜头', value: detail.lens },
    { label: '焦距', value: detail.focalLength ? `${Math.round(detail.focalLength)}mm` : null },
    { label: '光圈', value: detail.aperture ? `ƒ/${detail.aperture.toFixed(1)}` : null },
    { label: '快门', value: fmtShutter(detail.shutterSpeed) },
    { label: 'ISO', value: detail.iso ? `ISO ${detail.iso}` : null },
    {
      label: 'GPS',
      value: detail.latitude && detail.latitude !== -180
        ? `${detail.latitude.toFixed(5)}, ${detail.longitude.toFixed(5)}`
        : null,
    },
    { label: '类型', value: detail.isLive ? 'Live Photo' : null },
    { label: '收藏', value: isFavorite ? '已收藏 ❤️' : null },
  ].filter(r => r.value);

  return (
    <div className="p-4">
      <h3 className="text-sm font-semibold text-white mb-4">照片信息</h3>
      <div className="space-y-3">
        {rows.map(({ label, value }) => (
          <div key={label}>
            <p className="text-xs text-white/40 uppercase tracking-wide">{label}</p>
            <p className="text-sm text-white mt-0.5 break-all">{value}</p>
          </div>
        ))}
      </div>
      {detail.title && (
        <div className="mt-4 pt-4 border-t border-white/10">
          <p className="text-xs text-white/40 uppercase tracking-wide">标题</p>
          <p className="text-sm text-white mt-0.5">{detail.title}</p>
        </div>
      )}
    </div>
  );
}

function FilmStrip({ photos, currentIdx, onSelect }) {
  const stripRef = useRef(null);

  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    const item = el.children[currentIdx];
    item?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [currentIdx]);

  return (
    <div className="h-20 bg-black/60 border-t border-white/10 flex-shrink-0 overflow-hidden">
      <div ref={stripRef} className="flex h-full overflow-x-auto gap-1 px-2 items-center"
        style={{ scrollbarWidth: 'none' }}>
        {photos.map((p, i) => (
          <FilmItem key={p.uuid} photo={p} active={i === currentIdx} onClick={() => onSelect(p)} />
        ))}
      </div>
    </div>
  );
}

function FilmItem({ photo, active, onClick }) {
  const [src, setSrc] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        setSrc(
          photo.thumbnailPath ? `localfile://${photo.thumbnailPath}`
          : photo.originalPath ? `localfile://${photo.originalPath}`
          : null
        );
        obs.disconnect();
      }
    }, { rootMargin: '100px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, [photo.uuid]);

  return (
    <div
      ref={ref}
      className={`flex-shrink-0 overflow-hidden cursor-pointer rounded transition-all relative ${
        active
          ? 'ring-2 ring-blue-400 ring-offset-1 ring-offset-black scale-105 w-16 h-16'
          : 'opacity-60 hover:opacity-100 w-14 h-14'
      }`}
      onClick={onClick}
    >
      {src
        ? <img src={src} alt="" className="w-full h-full object-cover" draggable={false} />
        : <div className="w-full h-full bg-white/10" />
      }
      {photo.isVideo && (
        <div className="absolute inset-0 flex items-center justify-center">
          <svg viewBox="0 0 24 24" fill="white" className="w-4 h-4 opacity-80 drop-shadow">
            <path d="M8 5v14l11-7z"/>
          </svg>
        </div>
      )}
      {photo.isLive && (
        <div className="absolute bottom-0.5 left-0.5 bg-black/50 rounded px-1 text-white text-[8px] font-semibold leading-tight">
          LIVE
        </div>
      )}
    </div>
  );
}

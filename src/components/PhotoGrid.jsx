import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import PhotoCard from './PhotoCard';

const APPLE_EPOCH = 978307200;
const MONTHS_EN = ['January','February','March','April','May','June',
                   'July','August','September','October','November','December'];

function appleToDate(ts) {
  return ts ? new Date((ts + APPLE_EPOCH) * 1000) : null;
}
function monthKey(date) {
  return date ? `${date.getFullYear()}-${date.getMonth()}` : 'unknown';
}
function monthLabel(date) {
  return date ? `${MONTHS_EN[date.getMonth()]} ${date.getFullYear()}` : '未知日期';
}

const GRID_COLS = { 1: 8, 2: 6, 3: 4, 4: 3, 5: 2 };
const RATIO_HEIGHT = { 1: 80, 2: 110, 3: 160, 4: 200, 5: 260 };
const BATCH = 200;

export default function PhotoGrid({
  filter, albumId, timelineYear, timelineMonth,
  searchQuery, gridSize, squareMode,
  onPhotoClick, onTotalChange,
}) {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const containerRef = useRef(null);
  const loadingRef = useRef(false);
  const searchTimer = useRef(null);

  // ── load reset whenever key inputs change ──────────────────────────────────
  const doLoad = useCallback(async (reset, currentOffset, query) => {
    if (loadingRef.current && !reset) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const result = await window.photosAPI.getPhotos({
        offset: reset ? 0 : currentOffset,
        limit: BATCH,
        filter,
        albumId,
        year: timelineYear,
        month: timelineMonth,
        query: query?.trim() || null,
      });
      const newPhotos = result.photos || [];
      if (reset) {
        setPhotos(newPhotos);
        setOffset(newPhotos.length);
        onTotalChange(result.total || 0);
      } else {
        setPhotos(prev => [...prev, ...newPhotos]);
        setOffset(prev => prev + newPhotos.length);
      }
      setHasMore(newPhotos.length === BATCH);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [filter, albumId, timelineYear, timelineMonth]);

  // reset on filter/timeline change
  useEffect(() => {
    setPhotos([]);
    setOffset(0);
    setHasMore(true);
    loadingRef.current = false;
    doLoad(true, 0, searchQuery);
  }, [filter, albumId, timelineYear, timelineMonth]);

  // debounced search
  useEffect(() => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setPhotos([]);
      setOffset(0);
      setHasMore(true);
      loadingRef.current = false;
      doLoad(true, 0, searchQuery);
    }, 300);
    return () => clearTimeout(searchTimer.current);
  }, [searchQuery]);

  // infinite scroll
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = () => {
      if (!hasMore || loadingRef.current) return;
      if (el.scrollHeight - el.scrollTop - el.clientHeight < 600) {
        doLoad(false, offset, searchQuery);
      }
    };
    el.addEventListener('scroll', handler, { passive: true });
    return () => el.removeEventListener('scroll', handler);
  }, [hasMore, offset, searchQuery, doLoad]);

  // group by month
  const groups = useMemo(() => {
    const map = new Map();
    for (const photo of photos) {
      const date = appleToDate(photo.dateCreated);
      const key = monthKey(date);
      if (!map.has(key)) map.set(key, { key, label: monthLabel(date), photos: [] });
      map.get(key).photos.push(photo);
    }
    return Array.from(map.values());
  }, [photos]);

  const cols = GRID_COLS[gridSize] || 4;
  const rowHeight = RATIO_HEIGHT[gridSize] || 160;

  if (!loading && photos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-mac-text-secondary">
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-16 h-16 mb-4 opacity-30">
          <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
        </svg>
        <p className="text-lg font-medium">
          {searchQuery ? `没有找到 "${searchQuery}"` : '暂无照片'}
        </p>
        <p className="text-sm mt-1 opacity-60">
          {filter === 'favorites' ? '标记为收藏的照片将显示在这里' :
           filter === 'videos' ? '视频将显示在这里' :
           searchQuery ? '请尝试其他搜索词' : '此图库中没有照片'}
        </p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-full overflow-y-auto">
      <div className="px-4 pb-8">
        {groups.map(group => (
          <div key={group.key} className="mb-2">
            <div className="month-header bg-mac-bg/90 py-2 mb-1">
              <h2 className="text-sm font-semibold text-white">{group.label}</h2>
              <p className="text-xs text-mac-text-secondary">{group.photos.length} 个项目</p>
            </div>

            {squareMode ? (
              /* ── Square grid ─────────────────────────────────────────── */
              <div style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${cols}, 1fr)`,
                gap: '3px',
              }}>
                {group.photos.map(photo => (
                  <PhotoCard
                    key={photo.uuid}
                    photo={photo}
                    squareMode={true}
                    onClick={() => onPhotoClick(photo, photos)}
                  />
                ))}
              </div>
            ) : (
              /* ── Ratio (justified) layout ────────────────────────────── */
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', alignContent: 'flex-start' }}>
                {group.photos.map(photo => {
                  const ratio = photo.width && photo.height ? photo.width / photo.height : 1;
                  return (
                    <PhotoCard
                      key={photo.uuid}
                      photo={photo}
                      squareMode={false}
                      rowHeight={rowHeight}
                      aspectRatio={ratio}
                      onClick={() => onPhotoClick(photo, photos)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="spinner w-6 h-6 border-2 border-white/20 border-t-white rounded-full" />
          </div>
        )}
      </div>
    </div>
  );
}

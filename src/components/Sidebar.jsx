import React, { useState, useEffect } from 'react';

const MONTHS_EN = ['January','February','March','April','May','June',
                   'July','August','September','October','November','December'];

export default function Sidebar({ selectedView, selectedAlbum, selectedTimeline, onSelectView, libraryPath, totalPhotos }) {
  const [albums, setAlbums] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [albumsExpanded, setAlbumsExpanded] = useState(true);
  const [timelineExpanded, setTimelineExpanded] = useState(true);

  useEffect(() => {
    window.photosAPI.getAlbums().then(setAlbums);
    window.photosAPI.getTimeline().then(setTimeline);
  }, []);

  const isTimelineActive = (year, month) =>
    selectedView === 'timeline' && selectedTimeline?.year === year && selectedTimeline?.month === month;

  return (
    <aside className="w-56 flex-shrink-0 bg-mac-sidebar border-r border-mac-border flex flex-col overflow-hidden">
      <div className="h-8 flex-shrink-0 titlebar-drag" />

      <div className="flex-1 overflow-y-auto py-2">
        {/* Library section */}
        <div className="mb-2">
          <div className="px-4 py-1">
            <span className="text-xs font-semibold text-mac-text-secondary uppercase tracking-wider">媒体库</span>
          </div>

          {[
            {
              id: 'library', label: '图库', count: totalPhotos,
              icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M4 4h4v4H4zm6 0h4v4h-4zm6 0h4v4h-4zM4 10h4v4H4zm6 0h4v4h-4zm6 0h4v4h-4zM4 16h4v4H4zm6 0h4v4h-4zm6 0h4v4h-4z"/></svg>
            },
            {
              id: 'favorites', label: '个人收藏',
              icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
            },
            {
              id: 'videos', label: '视频',
              icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>
            },
            {
              id: 'people', label: '人物',
              icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
            },
            {
              id: 'map', label: '地图',
              icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M20.5 3l-.16.03L15 5.1 9 3 3.36 4.9c-.21.07-.36.25-.36.48V20.5c0 .28.22.5.5.5l.16-.03L9 18.9l6 2.1 5.64-1.9c.21-.07.36-.25.36-.48V3.5c0-.28-.22-.5-.5-.5zM15 19l-6-2.11V5l6 2.11V19z"/></svg>
            },
          ].map(item => (
            <button key={item.id}
              className={`sidebar-item w-full flex items-center gap-2.5 px-4 py-1.5 rounded-md mx-1 text-left ${selectedView === item.id ? 'active' : 'text-mac-text'}`}
              style={{ width: 'calc(100% - 8px)' }}
              onClick={() => onSelectView(item.id)}
            >
              <span className={selectedView === item.id ? 'text-mac-accent' : 'text-mac-text-secondary'}>
                {item.icon}
              </span>
              <span className="text-sm flex-1">{item.label}</span>
              {item.count !== undefined && (
                <span className="text-xs text-mac-text-secondary">{item.count.toLocaleString()}</span>
              )}
            </button>
          ))}
        </div>

        {/* Albums */}
        {albums.length > 0 && (
          <div className="mb-2">
            <button className="w-full px-4 py-1 flex items-center gap-1 text-left hover:bg-white/5"
              onClick={() => setAlbumsExpanded(v => !v)}>
              <svg viewBox="0 0 24 24" fill="currentColor"
                className={`w-3 h-3 text-mac-text-secondary transition-transform ${albumsExpanded ? 'rotate-90' : ''}`}>
                <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
              </svg>
              <span className="text-xs font-semibold text-mac-text-secondary uppercase tracking-wider">我的相簿</span>
            </button>
            {albumsExpanded && albums.map(album => (
              <button key={album.uuid}
                className={`sidebar-item w-full flex items-center gap-2.5 px-4 py-1.5 rounded-md mx-1 text-left ${selectedView === 'album' && selectedAlbum?.uuid === album.uuid ? 'active' : 'text-mac-text'}`}
                style={{ width: 'calc(100% - 8px)' }}
                onClick={() => onSelectView('album', album)}>
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-mac-text-secondary flex-shrink-0">
                  <path d="M22 16V4c0-1.1-.9-2-2-2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2zm-11-4l2.03 2.71L16 11l4 5H8l3-4zM2 6v14c0 1.1.9 2 2 2h14v-2H4V6H2z"/>
                </svg>
                <span className="text-sm truncate flex-1">{album.title}</span>
                {album.photoCount > 0 && (
                  <span className="text-xs text-mac-text-secondary flex-shrink-0">{album.photoCount}</span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Timeline — clickable */}
        {timeline.length > 0 && (
          <div className="mb-2">
            <button className="w-full px-4 py-1 flex items-center gap-1 text-left hover:bg-white/5"
              onClick={() => setTimelineExpanded(v => !v)}>
              <svg viewBox="0 0 24 24" fill="currentColor"
                className={`w-3 h-3 text-mac-text-secondary transition-transform ${timelineExpanded ? 'rotate-90' : ''}`}>
                <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
              </svg>
              <span className="text-xs font-semibold text-mac-text-secondary uppercase tracking-wider">时间线</span>
            </button>
            {timelineExpanded && timeline.map(entry => (
              <button key={`${entry.year}-${entry.month}`}
                className={`sidebar-item w-full flex items-center gap-2.5 px-4 py-1.5 rounded-md mx-1 text-left ${isTimelineActive(entry.year, entry.month) ? 'active' : 'text-mac-text'}`}
                style={{ width: 'calc(100% - 8px)' }}
                onClick={() => onSelectView('timeline', { year: entry.year, month: entry.month })}>
                <svg viewBox="0 0 24 24" fill="currentColor"
                  className={`w-4 h-4 flex-shrink-0 ${isTimelineActive(entry.year, entry.month) ? 'text-mac-accent' : 'text-mac-text-secondary'}`}>
                  <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"/>
                </svg>
                <span className="text-sm flex-1">
                  {MONTHS_EN[entry.month - 1]} {entry.year}
                </span>
                <span className="text-xs text-mac-text-secondary flex-shrink-0">{entry.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {libraryPath && (
        <div className="px-4 py-3 border-t border-mac-border">
          <p className="text-xs text-mac-text-secondary truncate" title={libraryPath}>
            {libraryPath.split('/').pop()}
          </p>
        </div>
      )}
    </aside>
  );
}

import React, { useState, useRef } from 'react';

const MONTHS_EN = ['January','February','March','April','May','June',
                   'July','August','September','October','November','December'];

export default function Toolbar({
  onOpenLibrary, searchQuery, onSearchChange,
  sidebarCollapsed, onToggleSidebar,
  gridSize, onGridSizeChange,
  squareMode, onSquareModeToggle,
  totalPhotos, selectedView, selectedAlbum, selectedTimeline,
}) {
  const searchRef = useRef(null);

  const viewLabel = () => {
    if (selectedView === 'library') return '图库';
    if (selectedView === 'favorites') return '个人收藏';
    if (selectedView === 'videos') return '视频';
    if (selectedView === 'map') return '地图';
    if (selectedView === 'album') return selectedAlbum?.title || '相簿';
    if (selectedView === 'timeline' && selectedTimeline)
      return `${MONTHS_EN[selectedTimeline.month - 1]} ${selectedTimeline.year}`;
    return '图库';
  };

  return (
    <header
      className="flex items-center h-12 px-3 bg-mac-sidebar border-b border-mac-border flex-shrink-0 titlebar-drag"
      style={{ paddingLeft: window.photosAPI?.platform === 'darwin' ? '80px' : '12px' }}
    >
      {/* Sidebar toggle */}
      <div className="flex items-center gap-1 titlebar-no-drag">
        <button
          className="p-1.5 rounded-md hover:bg-white/10 text-mac-text-secondary hover:text-white transition-colors"
          onClick={onToggleSidebar}
          title={sidebarCollapsed ? '显示侧栏' : '隐藏侧栏'}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
            <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
          </svg>
        </button>
      </div>

      {/* Title */}
      <div className="flex-1 flex items-center justify-center titlebar-drag pointer-events-none">
        <h1 className="text-sm font-semibold text-mac-text select-none">
          {viewLabel()}
          {totalPhotos > 0 && selectedView !== 'map' && (
            <span className="ml-2 text-xs font-normal text-mac-text-secondary">
              {totalPhotos.toLocaleString()} 个项目
            </span>
          )}
        </h1>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-2 titlebar-no-drag">
        {/* Grid size */}
        {selectedView !== 'map' && (
          <div className="flex items-center gap-1.5 titlebar-no-drag" onMouseDown={e => e.stopPropagation()}>
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-mac-text-secondary">
              <path d="M3 3h4v4H3zm5 0h4v4H8zm5 0h4v4h-4z"/>
            </svg>
            <input
              type="range"
              className="zoom-slider titlebar-no-drag"
              style={{ width: '70px' }}
              min="1" max="5" value={gridSize}
              onChange={e => onGridSizeChange(Number(e.target.value))}
              title="调整缩略图大小"
            />
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-mac-text-secondary">
              <path d="M3 3h7v7H3zm0 11h7v7H3zm11-11h7v7h-7zm0 11h7v7h-7z"/>
            </svg>
          </div>
        )}

        {/* Square / ratio toggle */}
        {selectedView !== 'map' && (
          <button
            className={`p-1.5 rounded-md transition-colors text-xs font-medium border ${
              squareMode
                ? 'bg-white/10 border-white/20 text-white'
                : 'border-white/10 text-mac-text-secondary hover:text-white hover:bg-white/10'
            }`}
            onClick={onSquareModeToggle}
            title={squareMode ? '切换为原始比例' : '切换为方形'}
          >
            {squareMode ? (
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                <rect x="3" y="3" width="18" height="18" rx="2" fill="none" stroke="currentColor" strokeWidth="2"/>
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                <rect x="3" y="5" width="12" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="2"/>
                <rect x="17" y="7" width="4" height="10" rx="1" fill="currentColor" opacity="0.5"/>
              </svg>
            )}
          </button>
        )}

        <div className="w-px h-4 bg-mac-border" />

        {/* Search */}
        <div className="relative">
          <svg viewBox="0 0 24 24" fill="currentColor"
            className="w-3.5 h-3.5 text-mac-text-secondary absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none">
            <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
          </svg>
          <input
            ref={searchRef}
            type="text"
            className="search-input text-sm text-white pl-7 pr-3 py-1 rounded-md w-44 text-xs"
            placeholder="搜索文件名"
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
          />
          {searchQuery && (
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 text-mac-text-secondary hover:text-white"
              onClick={() => onSearchChange('')}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </button>
          )}
        </div>

        <div className="w-px h-4 bg-mac-border" />

        {/* Open library */}
        <button
          className="p-1.5 rounded-md hover:bg-white/10 text-mac-text-secondary hover:text-white transition-colors"
          onClick={onOpenLibrary}
          title="打开图库"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
            <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
          </svg>
        </button>
      </div>
    </header>
  );
}

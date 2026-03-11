import React, { useState, useCallback, useEffect } from 'react';

export default function WelcomeScreen({ onOpenLibrary, onDrop, loading, onAutoOpen }) {
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    window.photosAPI?.onAutoOpenLibrary?.((path) => {
      if (onAutoOpen) onAutoOpen(path);
    });
  }, [onAutoOpen]);

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const handleDrop = (e) => {
    setDragOver(false);
    onDrop(e);
  };

  return (
    <div
      className="h-screen w-screen bg-mac-bg flex flex-col items-center justify-center titlebar-drag"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* macOS traffic lights area */}
      <div className="absolute top-0 left-0 right-0 h-8" />

      <div
        className={`flex flex-col items-center gap-6 p-12 rounded-2xl transition-all duration-200 titlebar-no-drag ${
          dragOver
            ? 'bg-mac-accent/10 border-2 border-mac-accent scale-105'
            : 'bg-mac-sidebar/50 border-2 border-dashed border-mac-border'
        }`}
        style={{ maxWidth: '480px', width: '90%' }}
      >
        {/* App icon */}
        <div className="relative">
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-blue-400 via-purple-500 to-pink-500 flex items-center justify-center shadow-2xl">
            <svg viewBox="0 0 24 24" fill="white" className="w-12 h-12">
              <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
            </svg>
          </div>
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="spinner w-10 h-10 border-3 border-white/30 border-t-white rounded-full" />
            </div>
          )}
        </div>

        {/* Title */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white">照片图库查看器</h1>
          <p className="text-mac-text-secondary text-sm mt-2">
            打开 Apple Photos 图库文件 (.photoslibrary)
          </p>
        </div>

        {/* Open button */}
        <button
          className="bg-mac-accent hover:bg-mac-accent-hover text-white font-medium px-8 py-2.5 rounded-lg transition-colors text-sm shadow-lg"
          onClick={onOpenLibrary}
          disabled={loading}
        >
          {loading ? '正在打开...' : '打开图库'}
        </button>

        {/* Drag hint */}
        <div className={`flex items-center gap-2 text-xs transition-colors ${dragOver ? 'text-mac-accent' : 'text-mac-text-secondary'}`}>
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
            <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
          </svg>
          <span>{dragOver ? '释放以打开图库' : '或将 .photoslibrary 拖到此处'}</span>
        </div>

        {/* Format hint */}
        <div className="border-t border-mac-border w-full pt-4">
          <p className="text-xs text-mac-text-secondary text-center">
            支持 macOS 照片 App 图库格式 · 只读模式
          </p>
          <p className="text-xs text-mac-text-secondary/60 text-center mt-1">
            跨平台支持 · macOS & Windows
          </p>
        </div>
      </div>

      {/* Keyboard shortcuts hint */}
      <div className="absolute bottom-6 flex gap-6 text-xs text-mac-text-secondary/50">
        <span>← → 导航照片</span>
        <span>I 显示信息</span>
        <span>ESC 退出查看</span>
        <span>滚轮 缩放</span>
      </div>
    </div>
  );
}

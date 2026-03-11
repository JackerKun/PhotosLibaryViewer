import React, { useState, useCallback, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Toolbar from './components/Toolbar';
import PhotoGrid from './components/PhotoGrid';
import PhotoViewer from './components/PhotoViewer';
import MapView from './components/MapView';
import PeopleView from './components/PeopleView';
import WelcomeScreen from './components/WelcomeScreen';

export default function App() {
  const [libraryLoaded, setLibraryLoaded] = useState(false);
  const [libraryPath, setLibraryPath] = useState(null);
  const [libraryKey, setLibraryKey] = useState(0); // increments on each library switch to force remount
  const [selectedView, setSelectedView] = useState('library');
  const [selectedAlbum, setSelectedAlbum] = useState(null);
  const [selectedTimeline, setSelectedTimeline] = useState(null); // {year, month}
  const [searchQuery, setSearchQuery] = useState('');
  const [viewerPhoto, setViewerPhoto] = useState(null);
  const [viewerPhotos, setViewerPhotos] = useState([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [gridSize, setGridSize] = useState(3);
  const [squareMode, setSquareMode] = useState(true);
  const [totalPhotos, setTotalPhotos] = useState(0);
  const [loading, setLoading] = useState(false);

  const openLibrary = useCallback(async (libPath) => {
    setLoading(true);
    const result = await window.photosAPI.openLibrary(libPath);
    setLoading(false);
    if (result.success) {
      setLibraryPath(libPath);
      setLibraryLoaded(true);
      setTotalPhotos(result.photoCount);
      // Reset all view state so Sidebar/Grid start fresh for the new library
      setSelectedView('library');
      setSelectedAlbum(null);
      setSelectedTimeline(null);
      setSearchQuery('');
      setViewerPhoto(null);
      setViewerPhotos([]);
      setLibraryKey(k => k + 1); // causes Sidebar, PhotoGrid, MapView to remount
    } else {
      alert(`打开图库失败: ${result.error}`);
    }
  }, []);

  const handleOpenLibrary = useCallback(async () => {
    const libPath = await window.photosAPI.openLibraryDialog();
    if (libPath) await openLibrary(libPath);
  }, [openLibrary]);

  const handleDropLibrary = useCallback(async (e) => {
    e.preventDefault();
    for (const item of Array.from(e.dataTransfer.items)) {
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file?.path?.endsWith('.photoslibrary')) {
          await openLibrary(file.path);
          return;
        }
      }
    }
  }, [openLibrary]);

  const handleSelectView = useCallback((view, extra) => {
    setSelectedView(view);
    setSelectedAlbum(view === 'album' ? extra : null);
    setSelectedTimeline(view === 'timeline' ? extra : null);
    setSearchQuery('');
  }, []);

  const getGridFilter = () => {
    if (selectedView === 'favorites') return 'favorites';
    if (selectedView === 'videos') return 'videos';
    if (selectedView === 'album') return 'album';
    if (selectedView === 'timeline') return 'timeline';
    return 'all';
  };

  if (!libraryLoaded) {
    return (
      <WelcomeScreen
        onOpenLibrary={handleOpenLibrary}
        onDrop={handleDropLibrary}
        loading={loading}
        onAutoOpen={openLibrary}
      />
    );
  }

  return (
    <div className="flex flex-col h-screen bg-mac-bg overflow-hidden">
      <Toolbar
        onOpenLibrary={handleOpenLibrary}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={() => setSidebarCollapsed(v => !v)}
        gridSize={gridSize}
        onGridSizeChange={setGridSize}
        squareMode={squareMode}
        onSquareModeToggle={() => setSquareMode(v => !v)}
        totalPhotos={totalPhotos}
        selectedView={selectedView}
        selectedAlbum={selectedAlbum}
        selectedTimeline={selectedTimeline}
      />

      <div className="flex flex-1 overflow-hidden">
        {!sidebarCollapsed && (
          <Sidebar
            key={libraryKey}
            selectedView={selectedView}
            selectedAlbum={selectedAlbum}
            selectedTimeline={selectedTimeline}
            onSelectView={handleSelectView}
            libraryPath={libraryPath}
            totalPhotos={totalPhotos}
          />
        )}

        <main className="flex-1 overflow-hidden bg-mac-bg">
          {selectedView === 'map' ? (
            <MapView
              key={libraryKey}
              libraryPath={libraryPath}
              onPhotoClick={(photo, photos) => {
                setViewerPhoto(photo);
                setViewerPhotos(photos);
              }}
            />
          ) : selectedView === 'people' ? (
            <PeopleView
              key={libraryKey}
              gridSize={gridSize}
              squareMode={squareMode}
              onPhotoClick={(photo, photos) => {
                setViewerPhoto(photo);
                setViewerPhotos(photos);
              }}
            />
          ) : (
            <PhotoGrid
              key={libraryKey}
              filter={getGridFilter()}
              albumId={selectedView === 'album' ? selectedAlbum?.uuid : null}
              timelineYear={selectedTimeline?.year}
              timelineMonth={selectedTimeline?.month}
              searchQuery={searchQuery}
              gridSize={gridSize}
              squareMode={squareMode}
              onPhotoClick={(photo, photos) => {
                setViewerPhoto(photo);
                setViewerPhotos(photos);
              }}
              onTotalChange={setTotalPhotos}
            />
          )}
        </main>
      </div>

      {viewerPhoto && (
        <PhotoViewer
          photo={viewerPhoto}
          photos={viewerPhotos}
          onClose={() => setViewerPhoto(null)}
          onNavigate={(p) => setViewerPhoto(p)}
          onFavoriteToggle={(uuid, isFav) => {
            setViewerPhotos(ps => ps.map(p => p.uuid === uuid ? { ...p, favorite: isFav } : p));
            setViewerPhoto(prev => prev?.uuid === uuid ? { ...prev, favorite: isFav } : prev);
          }}
        />
      )}
    </div>
  );
}

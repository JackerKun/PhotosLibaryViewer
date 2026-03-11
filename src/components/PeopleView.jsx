import React, { useState, useEffect, useRef, useCallback } from 'react';
import PhotoCard from './PhotoCard';

const BATCH = 200;

// ── Simple avatar image: scale whole photo to fit the circle, no crop ─────────
function AvatarImg({ person, size }) {
  const [src, setSrc] = useState(null);
  const triedThumb = useRef(false);

  const originalSrc  = person.keyFaceOriginalPath  ? `localfile://${person.keyFaceOriginalPath}`  : null;
  const thumbnailSrc = person.keyFaceThumbnailPath ? `localfile://${person.keyFaceThumbnailPath}` : null;

  useEffect(() => {
    triedThumb.current = false;
    setSrc(originalSrc || thumbnailSrc || null);
  }, [person.keyFaceUUID]);

  const handleError = () => {
    if (!triedThumb.current && thumbnailSrc && src !== thumbnailSrc) {
      triedThumb.current = true;
      setSrc(thumbnailSrc);
    }
  };

  if (!src) return null;
  return (
    <img
      src={src}
      onError={handleError}
      draggable={false}
      alt=""
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'contain',   // show full image, no stretch, no crop
        objectPosition: 'center',
      }}
    />
  );
}

// ── Small circular face avatar (used in PersonPhotos header) ─────────────────
function FaceAvatar({ person, size = 36 }) {
  return (
    <div
      className="rounded-full overflow-hidden bg-white/10 flex-shrink-0"
      style={{ width: size, height: size }}
    >
      <AvatarImg person={person} size={size} />
    </div>
  );
}

// ── Person card in grid ───────────────────────────────────────────────────────
const AVATAR_SIZE = 144; // w-36 = 9rem = 144px

function PersonCard({ person, onClick }) {
  const [visible, setVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) { setVisible(true); obs.disconnect(); }
    }, { rootMargin: '200px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, [person.keyFaceUUID]);

  return (
    <button
      ref={ref}
      onClick={onClick}
      className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-white/8 transition-colors group"
    >
      <div
        className="rounded-full overflow-hidden bg-white/10"
        style={{ width: AVATAR_SIZE, height: AVATAR_SIZE }}
      >
        {visible ? (
          <AvatarImg person={person} size={AVATAR_SIZE} />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-14 h-14 text-white/20">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
            </svg>
          </div>
        )}
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-white group-hover:text-blue-300 transition-colors">{person.name}</p>
        <p className="text-xs text-white/40">{person.faceCount} 张</p>
      </div>
    </button>
  );
}

// ── Person photos view ────────────────────────────────────────────────────────
function PersonPhotos({ person, gridSize, squareMode, onPhotoClick, onBack }) {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const containerRef = useRef(null);
  const loadingRef = useRef(false);

  const GRID_COLS = { 1: 8, 2: 6, 3: 4, 4: 3, 5: 2 };
  const RATIO_HEIGHT = { 1: 80, 2: 110, 3: 160, 4: 200, 5: 260 };
  const cols = GRID_COLS[gridSize] || 4;
  const cellH = RATIO_HEIGHT[gridSize] || 160;

  const doLoad = useCallback(async (reset, currentOffset) => {
    if (loadingRef.current && !reset) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const result = await window.photosAPI.getPersonPhotos({
        personUuid: person.uuid,
        offset: reset ? 0 : currentOffset,
        limit: BATCH,
      });
      const newPhotos = result.photos || [];
      if (reset) {
        setPhotos(newPhotos);
        setOffset(newPhotos.length);
      } else {
        setPhotos(prev => [...prev, ...newPhotos]);
        setOffset(prev => prev + newPhotos.length);
      }
      setHasMore(newPhotos.length === BATCH);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [person.uuid]);

  useEffect(() => { doLoad(true, 0); }, [doLoad]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = () => {
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 400 && hasMore && !loading) {
        doLoad(false, offset);
      }
    };
    el.addEventListener('scroll', handler, { passive: true });
    return () => el.removeEventListener('scroll', handler);
  }, [hasMore, loading, offset, doLoad]);

  return (
    <div className="flex flex-col h-full">
      {/* Back header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 flex-shrink-0">
        <button
          onClick={onBack}
          className="p-1 rounded hover:bg-white/10 text-white/70 hover:text-white transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
          </svg>
        </button>
        <FaceAvatar person={person} size={36} />
        <div>
          <p className="text-sm font-semibold text-white">{person.name}</p>
          <p className="text-xs text-white/50">{person.faceCount} 张照片</p>
        </div>
      </div>

      {/* Photo grid */}
      <div ref={containerRef} className="flex-1 overflow-y-auto">
        {loading && photos.length === 0 ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          </div>
        ) : (
          <div
            className="grid p-1 gap-0.5"
            style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
          >
            {photos.map((photo) => (
              <PhotoCard
                key={photo.uuid}
                photo={photo}
                cellH={cellH}
                squareMode={squareMode}
                onClick={() => onPhotoClick(photo, photos)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main PeopleView ───────────────────────────────────────────────────────────
export default function PeopleView({ gridSize, squareMode, onPhotoClick }) {
  const [persons, setPersons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPerson, setSelectedPerson] = useState(null);

  useEffect(() => {
    setLoading(true);
    window.photosAPI.getPersons().then(data => {
      setPersons(data);
      setLoading(false);
    });
  }, []);

  if (selectedPerson) {
    return (
      <PersonPhotos
        person={selectedPerson}
        gridSize={gridSize}
        squareMode={squareMode}
        onPhotoClick={onPhotoClick}
        onBack={() => setSelectedPerson(null)}
      />
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      ) : persons.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full gap-3 text-white/30">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-16 h-16">
            <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
          </svg>
          <p className="text-sm">此图库中没有命名的人物</p>
        </div>
      ) : (
        <div className="p-6">
          <h2 className="text-lg font-semibold text-white mb-4">人物</h2>
          <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
            {persons.map(person => (
              <PersonCard
                key={person.uuid}
                person={person}
                onClick={() => setSelectedPerson(person)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

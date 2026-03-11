import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Module-level cache — persists across view switches for the same library
let _cachedLibraryPath = null;
let _cachedPhotos = null;

const PIN_ICON = L.divIcon({
  className: '',
  html: `<div style="
    width:26px;height:26px;border-radius:50%;
    background:#007aff;border:2.5px solid white;
    box-shadow:0 2px 8px rgba(0,0,0,.5);
    display:flex;align-items:center;justify-content:center;
  ">
    <svg viewBox="0 0 24 24" fill="white" width="13" height="13">
      <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
    </svg>
  </div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 13],
  popupAnchor: [0, -15],
});

const VIDEO_ICON = L.divIcon({
  className: '',
  html: `<div style="
    width:26px;height:26px;border-radius:50%;
    background:#ff9f0a;border:2.5px solid white;
    box-shadow:0 2px 8px rgba(0,0,0,.5);
    display:flex;align-items:center;justify-content:center;
  ">
    <svg viewBox="0 0 24 24" fill="white" width="13" height="13">
      <path d="M8 5v14l11-7z"/>
    </svg>
  </div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 13],
  popupAnchor: [0, -15],
});

export default function MapView({ onPhotoClick, libraryPath }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const photosRef = useRef([]);
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Return cached data instantly if same library is still open
    if (_cachedLibraryPath === libraryPath && _cachedPhotos) {
      setPhotos(_cachedPhotos);
      photosRef.current = _cachedPhotos;
      setLoading(false);
      return;
    }
    window.photosAPI.getMapPhotos().then(data => {
      _cachedLibraryPath = libraryPath;
      _cachedPhotos = data;
      setPhotos(data);
      photosRef.current = data;
      setLoading(false);
    });
  }, [libraryPath]);

  useEffect(() => {
    if (loading || !containerRef.current || photos.length === 0) return;

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const map = L.map(containerRef.current, { preferCanvas: false });
    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    const bounds = [];

    photos.forEach(photo => {
      const ll = [photo.latitude, photo.longitude];
      bounds.push(ll);

      const thumbSrc = photo.thumbnailPath
        ? `localfile://${photo.thumbnailPath}`
        : photo.originalPath
          ? `localfile://${photo.originalPath}`
          : null;

      const marker = L.marker(ll, { icon: photo.isVideo ? VIDEO_ICON : PIN_ICON }).addTo(map);

      const popupHtml = `
        <div style="text-align:center;min-width:130px;">
          ${thumbSrc
            ? `<img src="${thumbSrc}" style="width:130px;height:98px;object-fit:cover;border-radius:5px;display:block;margin-bottom:6px;" />`
            : `<div style="width:130px;height:98px;background:#2c2c2e;border-radius:5px;display:flex;align-items:center;justify-content:center;margin-bottom:6px;">
                 <svg viewBox="0 0 24 24" fill="#6e6e73" width="28" height="28">
                   <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
                 </svg>
               </div>`
          }
          <div style="font-size:11px;color:#8e8e93;max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-bottom:6px;">${photo.filename}</div>
          <button class="map-view-btn" style="
            padding:4px 14px;background:#007aff;color:white;border:none;
            border-radius:5px;font-size:11px;cursor:pointer;width:100%;
          ">查看</button>
        </div>
      `;

      marker.bindPopup(popupHtml, { maxWidth: 150, className: 'map-photo-popup' });

      marker.on('popupopen', (e) => {
        const btn = e.popup.getElement()?.querySelector('.map-view-btn');
        if (btn) {
          btn.addEventListener('click', () => {
            onPhotoClick(photo, photosRef.current);
            map.closePopup();
          });
        }
      });
    });

    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 13 });
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [loading, photos]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="spinner w-6 h-6 border-2 border-white/20 border-t-white rounded-full" />
      </div>
    );
  }

  if (photos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-mac-text-secondary">
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-16 h-16 mb-4 opacity-30">
          <path d="M20.5 3l-.16.03L15 5.1 9 3 3.36 4.9c-.21.07-.36.25-.36.48V20.5c0 .28.22.5.5.5l.16-.03L9 18.9l6 2.1 5.64-1.9c.21-.07.36-.25.36-.48V3.5c0-.28-.22-.5-.5-.5zM15 19l-6-2.11V5l6 2.11V19z"/>
        </svg>
        <p className="text-lg font-medium">没有带位置信息的照片</p>
        <p className="text-sm mt-1 opacity-60">带有 GPS 坐标的照片将显示在这里</p>
      </div>
    );
  }

  return <div ref={containerRef} className="w-full h-full" />;
}

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('photosAPI', {
  openLibraryDialog: () => ipcRenderer.invoke('open-library-dialog'),
  openLibrary: (path) => ipcRenderer.invoke('open-library', path),
  getPhotos: (opts) => ipcRenderer.invoke('get-photos', opts),
  getAlbums: () => ipcRenderer.invoke('get-albums'),
  getTimeline: () => ipcRenderer.invoke('get-timeline'),
  getPhotoDetail: (uuid) => ipcRenderer.invoke('get-photo-detail', uuid),
  getMapPhotos: () => ipcRenderer.invoke('get-map-photos'),
  toggleFavorite: (uuid) => ipcRenderer.invoke('toggle-favorite', uuid),
  getLocalFavorites: () => ipcRenderer.invoke('get-local-favorites'),
  checkFileExists: (path) => ipcRenderer.invoke('check-file-exists', path),
  getPersons: () => ipcRenderer.invoke('get-persons'),
  getPersonPhotos: (opts) => ipcRenderer.invoke('get-person-photos', opts),
  getHeicJpeg: (uuid, heicPath) => ipcRenderer.invoke('get-heic-jpeg', { uuid, heicPath }),
  getLibraryInfo: () => ipcRenderer.invoke('get-library-info'),
  platform: process.platform,
  onAutoOpenLibrary: (cb) => ipcRenderer.on('auto-open-library', (_, p) => cb(p)),
});

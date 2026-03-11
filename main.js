const { app, BrowserWindow, ipcMain, dialog, protocol } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { Readable } = require('stream');

const execFileAsync = promisify(execFile);

const MIME_TYPES = {
  '.mov': 'video/quicktime',
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.mkv': 'video/x-matroska',
  '.avi': 'video/x-msvideo',
  '.webm': 'video/webm',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.heic': 'image/heic',
  '.heif': 'image/heic',
  '.tiff': 'image/tiff',
  '.tif': 'image/tiff',
};

let mainWindow;
let db = null;
let SQL = null;
let libraryPath = null;
const heicCache = new Map(); // uuid → converted jpeg path

const isDev = process.env.NODE_ENV === 'development' && process.env.VITE_DEV_SERVER_URL;

// Enable HEVC / H.265 hardware decoding (for iPhone videos etc.)
app.commandLine.appendSwitch('enable-features', 'PlatformHEVCDecoderSupport,VaapiVideoDecodeLinuxGL');
app.commandLine.appendSwitch('enable-accelerated-video-decode');

// ── Local favorites (stored in userData so the library stays read-only) ──────
function favsFile() {
  // One file per library, keyed by a simple hash of the path
  const hash = Buffer.from(libraryPath || '').toString('base64').replace(/[/+=]/g, '_').slice(0, 32);
  return path.join(app.getPath('userData'), `favs_${hash}.json`);
}
function loadFavs() {
  try { return JSON.parse(fs.readFileSync(favsFile(), 'utf8')); } catch { return {}; }
}
function saveFavs(obj) {
  fs.writeFileSync(favsFile(), JSON.stringify(obj));
}

// Normalize path separators to forward slashes for safe use in localfile:// URLs.
// On Windows, path.join returns backslashes which break URL parsing.
function normPath(p) {
  return p ? p.replace(/\\/g, '/') : p;
}

async function initSqlJs() {
  if (SQL) return SQL;
  const initSqlJs = require('sql.js');
  const wasmPath = path.join(__dirname, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
  SQL = await initSqlJs({ locateFile: () => wasmPath });
  return SQL;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    center: true,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: '#1c1c1e',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
    },
    show: false,
  });

  if (isDev) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
    const args = process.argv.slice(isDev ? 2 : 1);
    const libArg = args.find(a => a.endsWith('.photoslibrary'));
    if (libArg) {
      setTimeout(() => mainWindow.webContents.send('auto-open-library', libArg), 500);
    }
  });

  // Fallback: force-show window if ready-to-show never fires (e.g. renderer crash)
  setTimeout(() => {
    if (mainWindow && !mainWindow.isVisible()) {
      mainWindow.show();
      mainWindow.focus();
    }
  }, 8000);

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (db) { db.close(); db = null; }
  });
}

app.whenReady().then(() => {
  // Set macOS Dock icon (only in dev; packaged app uses the .app bundle icon)
  if (isDev && process.platform === 'darwin' && app.dock) {
    try {
      app.dock.setIcon(path.join(__dirname, 'build', 'icon.png'));
    } catch (e) {
      console.warn('dock.setIcon failed:', e.message);
    }
  }

  // Custom protocol handler with proper Range request support for video streaming
  protocol.handle('localfile', async (request) => {
    // Use URL parsing to correctly handle Windows drive letters.
    // localfile://H:/Sync/path → hostname='H', pathname='/Sync/path'
    // Naively slicing off 'localfile://' gives 'H/Sync/path' (colon lost) → 404.
    const parsed = new URL(request.url);
    let filePath;
    if (parsed.hostname && parsed.hostname.length === 1 && /[a-zA-Z]/.test(parsed.hostname)) {
      // Windows absolute path: reassemble drive letter + pathname
      filePath = decodeURIComponent(parsed.hostname + ':' + parsed.pathname);
    } else {
      filePath = decodeURIComponent(parsed.pathname);
    }
    const ext = path.extname(filePath).toLowerCase();
    const mimeType = MIME_TYPES[ext] || 'application/octet-stream';

    try {
      const stat = fs.statSync(filePath);
      const fileSize = stat.size;
      const rangeHeader = request.headers.get('range');

      if (rangeHeader) {
        const match = rangeHeader.match(/bytes=(\d*)-(\d*)/);
        let start, end;
        if (!match[1] && match[2]) {
          // Suffix range: bytes=-N → last N bytes (moov-at-end videos need this)
          start = Math.max(0, fileSize - parseInt(match[2], 10));
          end = fileSize - 1;
        } else {
          start = match[1] ? parseInt(match[1], 10) : 0;
          end = match[2] ? Math.min(parseInt(match[2], 10), fileSize - 1) : fileSize - 1;
        }
        const chunkSize = end - start + 1;
        const nodeStream = fs.createReadStream(filePath, { start, end });
        return new Response(Readable.toWeb(nodeStream), {
          status: 206,
          headers: {
            'Content-Type': mimeType,
            'Content-Length': String(chunkSize),
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
          },
        });
      }

      const nodeStream = fs.createReadStream(filePath);
      return new Response(Readable.toWeb(nodeStream), {
        status: 200,
        headers: {
          'Content-Type': mimeType,
          'Content-Length': String(fileSize),
          'Accept-Ranges': 'bytes',
        },
      });
    } catch (err) {
      console.error('localfile protocol error:', err.message, filePath);
      return new Response(null, { status: 404 });
    }
  });
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ── helpers ───────────────────────────────────────────────────────────────────
function dbAll(sql, params = []) {
  if (!db) return [];
  try {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows;
  } catch (err) {
    console.error('dbAll error:', err.message);
    return [];
  }
}
function dbGet(sql, params = []) { return dbAll(sql, params)[0] || null; }

let _joinTableCache = undefined;
function findAlbumJoinTable() {
  if (_joinTableCache !== undefined) return _joinTableCache;
  try {
    const tables = dbAll("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'Z_%ASSETS'");
    for (const { name } of tables) {
      const cols = dbAll(`PRAGMA table_info(${name})`).map(c => c.name);
      const assetCol = cols.find(c => c.endsWith('ASSETS') && c !== 'Z_PK');
      const albumCol = cols.find(c => c.endsWith('ALBUMS') && c !== 'Z_PK');
      if (assetCol && albumCol) {
        _joinTableCache = { table: name, assetCol, albumCol };
        return _joinTableCache;
      }
    }
  } catch {}
  _joinTableCache = null;
  return null;
}

function getThumbnailPath(libPath, uuid) {
  if (!libPath || !uuid) return null;
  for (const c of [uuid[0].toUpperCase(), uuid[0].toLowerCase()]) {
    const p = path.join(libPath, 'resources', 'derivatives', 'masters', c, `${uuid}_4_5005_c.jpeg`);
    if (fs.existsSync(p)) return normPath(p);
  }
  return null;
}
function getOriginalPath(directory, filename) {
  if (!directory || !filename) return null;
  // Check external/absolute path first
  const p = path.join(directory, filename);
  if (fs.existsSync(p)) return normPath(p);
  // Fall back to library's originals folder (for internally stored photos/videos)
  if (libraryPath) {
    const firstChar = filename[0].toUpperCase();
    const p2 = path.join(libraryPath, 'originals', firstChar, filename);
    if (fs.existsSync(p2)) return normPath(p2);
    const p3 = path.join(libraryPath, 'originals', firstChar.toLowerCase(), filename);
    if (fs.existsSync(p3)) return normPath(p3);
  }
  return null;
}

function getLiveVideoPath(directory, filename) {
  if (!filename) return null;
  const ext = path.extname(filename);
  const base = path.basename(filename, ext);
  const videoName = `${base}_3.mov`;
  // Check alongside the original file
  if (directory) {
    const p = path.join(directory, videoName);
    if (fs.existsSync(p)) return normPath(p);
  }
  // Check in library originals folder
  if (libraryPath) {
    const firstChar = base[0].toUpperCase();
    const p2 = path.join(libraryPath, 'originals', firstChar, videoName);
    if (fs.existsSync(p2)) return normPath(p2);
    const p3 = path.join(libraryPath, 'originals', firstChar.toLowerCase(), videoName);
    if (fs.existsSync(p3)) return normPath(p3);
  }
  return null;
}

function mapPhoto(p, favs) {
  const isLive = p.ZKINDSUBTYPE === 2;
  return {
    uuid: p.ZUUID,
    filename: p.ZFILENAME,
    directory: p.ZDIRECTORY,
    dateCreated: p.ZDATECREATED,
    favorite: p.ZFAVORITE === 1 || !!favs[p.ZUUID],
    localFavorite: !!favs[p.ZUUID],
    isVideo: p.ZKIND === 1,
    isLive,
    width: p.ZWIDTH,
    height: p.ZHEIGHT,
    duration: p.ZDURATION,
    thumbnailPath: getThumbnailPath(libraryPath, p.ZUUID),
    originalPath: getOriginalPath(p.ZDIRECTORY, p.ZFILENAME),
    liveVideoPath: isLive ? getLiveVideoPath(p.ZDIRECTORY, p.ZFILENAME) : null,
  };
}

const SELECT_COLS = `ZUUID, ZFILENAME, ZDIRECTORY, ZDATECREATED, ZFAVORITE, ZKIND, ZKINDSUBTYPE, ZWIDTH, ZHEIGHT, ZDURATION`;

// ── IPC: open dialog ──────────────────────────────────────────────────────────
ipcMain.handle('open-library-dialog', async () => {
  // On macOS, .photoslibrary is a package/bundle. Using openFile lets users
  // select it like a file in Finder without drilling into it.
  const isMac = process.platform === 'darwin';
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '选择照片图库',
    message: '请选择一个 .photoslibrary 图库文件',
    buttonLabel: '打开图库',
    properties: isMac ? ['openFile', 'openDirectory'] : ['openDirectory'],
    filters: isMac ? [{ name: 'Photos Library', extensions: ['photoslibrary'] }] : [],
  });
  if (result.canceled || !result.filePaths.length) return null;
  return result.filePaths[0];
});

// ── IPC: open library ─────────────────────────────────────────────────────────
ipcMain.handle('open-library', async (event, libPath) => {
  try {
    await initSqlJs();
    const dbPath = path.join(libPath, 'database', 'Photos.sqlite');
    if (!fs.existsSync(dbPath)) return { success: false, error: 'Photos.sqlite not found' };
    if (db) { db.close(); db = null; }
    db = new SQL.Database(fs.readFileSync(dbPath));
    libraryPath = libPath;
    _joinTableCache = undefined;
    const cnt = db.exec('SELECT COUNT(*) FROM ZASSET WHERE ZTRASHEDSTATE = 0')[0]?.values[0][0] || 0;
    return { success: true, photoCount: cnt };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ── IPC: get photos ───────────────────────────────────────────────────────────
ipcMain.handle('get-photos', async (event, opts = {}) => {
  if (!db) return { photos: [], total: 0 };
  const { offset = 0, limit = 200, filter = 'all', albumId = null,
          year = null, month = null, query = null } = opts;

  const favs = loadFavs();

  // Build search clause
  let searchClause = '';
  let searchParams = [];
  if (query && query.trim()) {
    searchClause = ` AND (LOWER(ZFILENAME) LIKE LOWER(?) OR LOWER(ZDIRECTORY) LIKE LOWER(?))`;
    searchParams = [`%${query.trim()}%`, `%${query.trim()}%`];
  }

  try {
    let photos, total;

    if (filter === 'favorites') {
      const localUuids = Object.keys(favs).filter(u => favs[u]);
      // DB-favorites
      const dbRows = dbAll(
        `SELECT ${SELECT_COLS} FROM ZASSET WHERE ZTRASHEDSTATE=0 AND ZFAVORITE=1${searchClause} ORDER BY ZDATECREATED DESC`,
        searchParams
      );
      const dbSet = new Set(dbRows.map(r => r.ZUUID));
      // local-favorites not already in DB
      let localRows = [];
      if (localUuids.length) {
        const ph = localUuids.map(() => '?').join(',');
        localRows = dbAll(
          `SELECT ${SELECT_COLS} FROM ZASSET WHERE ZTRASHEDSTATE=0 AND ZUUID IN (${ph})${searchClause} ORDER BY ZDATECREATED DESC`,
          [...localUuids, ...searchParams]
        ).filter(r => !dbSet.has(r.ZUUID));
      }
      const all = [...dbRows, ...localRows];
      total = all.length;
      photos = all.slice(offset, offset + limit);

    } else if (filter === 'videos') {
      photos = dbAll(
        `SELECT ${SELECT_COLS} FROM ZASSET WHERE ZTRASHEDSTATE=0 AND ZKIND=1${searchClause} ORDER BY ZDATECREATED DESC LIMIT ? OFFSET ?`,
        [...searchParams, limit, offset]
      );
      total = dbGet(`SELECT COUNT(*) as cnt FROM ZASSET WHERE ZTRASHEDSTATE=0 AND ZKIND=1${searchClause}`, searchParams)?.cnt || 0;

    } else if (filter === 'album' && albumId) {
      const jt = findAlbumJoinTable();
      if (jt) {
        photos = dbAll(
          `SELECT a.${SELECT_COLS.split(',').join(',a.')} FROM ZASSET a
           INNER JOIN ${jt.table} rel ON rel.${jt.assetCol}=a.Z_PK
           INNER JOIN ZGENERICALBUM alb ON alb.Z_PK=rel.${jt.albumCol}
           WHERE a.ZTRASHEDSTATE=0 AND alb.ZUUID=?${searchClause.replace(/ZFILENAME/g,'a.ZFILENAME').replace(/ZDIRECTORY/g,'a.ZDIRECTORY')}
           ORDER BY a.ZDATECREATED DESC LIMIT ? OFFSET ?`,
          [albumId, ...searchParams, limit, offset]
        );
        total = dbGet(
          `SELECT COUNT(*) as cnt FROM ZASSET a
           INNER JOIN ${jt.table} rel ON rel.${jt.assetCol}=a.Z_PK
           INNER JOIN ZGENERICALBUM alb ON alb.Z_PK=rel.${jt.albumCol}
           WHERE a.ZTRASHEDSTATE=0 AND alb.ZUUID=?${searchClause.replace(/ZFILENAME/g,'a.ZFILENAME').replace(/ZDIRECTORY/g,'a.ZDIRECTORY')}`,
          [albumId, ...searchParams]
        )?.cnt || 0;
      } else { photos = []; total = 0; }

    } else if (filter === 'timeline' && year && month) {
      const y = String(year);
      const m = String(month).padStart(2, '0');
      const timeClause = ` AND strftime('%Y',datetime(ZDATECREATED+978307200,'unixepoch'))=? AND strftime('%m',datetime(ZDATECREATED+978307200,'unixepoch'))=?`;
      photos = dbAll(
        `SELECT ${SELECT_COLS} FROM ZASSET WHERE ZTRASHEDSTATE=0${timeClause}${searchClause} ORDER BY ZDATECREATED DESC LIMIT ? OFFSET ?`,
        [y, m, ...searchParams, limit, offset]
      );
      total = dbGet(
        `SELECT COUNT(*) as cnt FROM ZASSET WHERE ZTRASHEDSTATE=0${timeClause}${searchClause}`,
        [y, m, ...searchParams]
      )?.cnt || 0;

    } else {
      photos = dbAll(
        `SELECT ${SELECT_COLS} FROM ZASSET WHERE ZTRASHEDSTATE=0${searchClause} ORDER BY ZDATECREATED DESC LIMIT ? OFFSET ?`,
        [...searchParams, limit, offset]
      );
      total = dbGet(`SELECT COUNT(*) as cnt FROM ZASSET WHERE ZTRASHEDSTATE=0${searchClause}`, searchParams)?.cnt || 0;
    }

    return { photos: photos.map(p => mapPhoto(p, favs)), total };
  } catch (err) {
    console.error('get-photos error:', err);
    return { photos: [], total: 0 };
  }
});

// ── IPC: albums ───────────────────────────────────────────────────────────────
ipcMain.handle('get-albums', async () => {
  if (!db) return [];
  try {
    const albums = dbAll(
      `SELECT ZUUID, ZTITLE, ZKIND FROM ZGENERICALBUM
       WHERE ZTITLE IS NOT NULL AND ZTITLE!=''
       AND ZKIND NOT IN (3999,3998,1605,1627,1610,1632,1631,3573,3571,4001,1619,1620,1642,3572,3574)
       ORDER BY ZTITLE`
    );
    const jt = findAlbumJoinTable();
    return albums.map(a => {
      let count = 0;
      if (jt) {
        try {
          count = dbGet(
            `SELECT COUNT(*) as cnt FROM ZASSET a
             INNER JOIN ${jt.table} rel ON rel.${jt.assetCol}=a.Z_PK
             INNER JOIN ZGENERICALBUM alb ON alb.Z_PK=rel.${jt.albumCol}
             WHERE a.ZTRASHEDSTATE=0 AND alb.ZUUID=?`, [a.ZUUID]
          )?.cnt || 0;
        } catch {}
      }
      return { uuid: a.ZUUID, title: a.ZTITLE, kind: a.ZKIND, photoCount: count };
    });
  } catch (err) { return []; }
});

// ── IPC: timeline ─────────────────────────────────────────────────────────────
ipcMain.handle('get-timeline', async () => {
  if (!db) return [];
  try {
    return dbAll(`
      SELECT
        CAST(strftime('%Y',datetime(ZDATECREATED+978307200,'unixepoch')) AS INTEGER) as year,
        CAST(strftime('%m',datetime(ZDATECREATED+978307200,'unixepoch')) AS INTEGER) as month,
        COUNT(*) as count
      FROM ZASSET WHERE ZTRASHEDSTATE=0 AND ZDATECREATED IS NOT NULL
      GROUP BY year, month ORDER BY year DESC, month DESC
    `);
  } catch { return []; }
});

// ── IPC: photo detail ─────────────────────────────────────────────────────────
ipcMain.handle('get-photo-detail', async (event, uuid) => {
  if (!db) return null;
  try {
    const p = dbGet(
      `SELECT a.ZUUID,a.ZFILENAME,a.ZDIRECTORY,a.ZDATECREATED,a.ZFAVORITE,
              a.ZKIND,a.ZKINDSUBTYPE,a.ZWIDTH,a.ZHEIGHT,a.ZDURATION,a.ZLATITUDE,a.ZLONGITUDE,
              a.ZUNIFORMTYPEIDENTIFIER,
              ea.ZCAMERAMAKE,ea.ZCAMERAMODEL,ea.ZLENSMODEL as ZLENS,ea.ZISO,ea.ZFOCALLENGTH,
              ea.ZAPERTURE,ea.ZSHUTTERSPEED,aa.ZTITLE
       FROM ZASSET a
       LEFT JOIN ZEXTENDEDATTRIBUTES ea ON ea.ZASSET=a.Z_PK
       LEFT JOIN ZADDITIONALASSETATTRIBUTES aa ON aa.ZASSET=a.Z_PK
       WHERE a.ZUUID=?`, [uuid]
    );
    if (!p) return null;
    const favs = loadFavs();
    const isLive = p.ZKINDSUBTYPE === 2;
    return {
      uuid: p.ZUUID, filename: p.ZFILENAME, directory: p.ZDIRECTORY,
      dateCreated: p.ZDATECREATED,
      favorite: p.ZFAVORITE === 1 || !!favs[p.ZUUID],
      localFavorite: !!favs[p.ZUUID],
      isVideo: p.ZKIND === 1,
      isLive,
      width: p.ZWIDTH, height: p.ZHEIGHT, duration: p.ZDURATION,
      latitude: p.ZLATITUDE, longitude: p.ZLONGITUDE,
      thumbnailPath: getThumbnailPath(libraryPath, p.ZUUID),
      originalPath: getOriginalPath(p.ZDIRECTORY, p.ZFILENAME),
      liveVideoPath: isLive ? getLiveVideoPath(p.ZDIRECTORY, p.ZFILENAME) : null,
      camera: p.ZCAMERAMODEL || p.ZCAMERAMAKE, lens: p.ZLENS,
      iso: p.ZISO, focalLength: p.ZFOCALLENGTH,
      aperture: p.ZAPERTURE, shutterSpeed: p.ZSHUTTERSPEED, title: p.ZTITLE,
    };
  } catch (err) { return null; }
});

// ── IPC: persons (people) ─────────────────────────────────────────────────────
ipcMain.handle('get-persons', async () => {
  if (!db) return [];
  try {
    return dbAll(`
      SELECT p.ZDISPLAYNAME, p.ZFULLNAME, p.ZFACECOUNT, p.ZPERSONUUID,
             a.ZUUID as keyFaceUUID, a.ZDIRECTORY, a.ZFILENAME,
             a.ZWIDTH, a.ZHEIGHT,
             df.ZCENTERX, df.ZCENTERY, df.ZSIZE as ZFACESIZE
      FROM ZPERSON p
      LEFT JOIN ZDETECTEDFACE df ON df.Z_PK = p.ZKEYFACE
      LEFT JOIN ZASSET a ON a.Z_PK = df.ZASSETFORFACE
      WHERE p.ZDISPLAYNAME IS NOT NULL AND p.ZDISPLAYNAME != ''
      ORDER BY p.ZFACECOUNT DESC
    `).map(r => ({
      uuid: r.ZPERSONUUID,
      name: r.ZDISPLAYNAME,
      fullName: r.ZFULLNAME,
      faceCount: r.ZFACECOUNT,
      keyFaceUUID: r.keyFaceUUID,
      keyFaceThumbnailPath: getThumbnailPath(libraryPath, r.keyFaceUUID),
      keyFaceOriginalPath: getOriginalPath(r.ZDIRECTORY, r.ZFILENAME),
      faceX: r.ZCENTERX,
      faceY: r.ZCENTERY,
      faceSize: r.ZFACESIZE,
      imageWidth: r.ZWIDTH,
      imageHeight: r.ZHEIGHT,
    }));
  } catch (err) { console.error('get-persons error:', err); return []; }
});

ipcMain.handle('get-person-photos', async (event, { personUuid, offset = 0, limit = 200 }) => {
  if (!db) return { photos: [], total: 0 };
  try {
    const favs = loadFavs();
    const photos = dbAll(`
      SELECT DISTINCT a.ZUUID, a.ZFILENAME, a.ZDIRECTORY, a.ZDATECREATED,
             a.ZFAVORITE, a.ZKIND, a.ZKINDSUBTYPE, a.ZWIDTH, a.ZHEIGHT, a.ZDURATION
      FROM ZASSET a
      JOIN ZDETECTEDFACE df ON df.ZASSETFORFACE = a.Z_PK
      JOIN ZPERSON p ON p.Z_PK = df.ZPERSONFORFACE
      WHERE p.ZPERSONUUID = ? AND a.ZTRASHEDSTATE = 0
      ORDER BY a.ZDATECREATED DESC
      LIMIT ? OFFSET ?
    `, [personUuid, limit, offset]);
    const total = dbGet(`
      SELECT COUNT(DISTINCT a.Z_PK) as cnt
      FROM ZASSET a
      JOIN ZDETECTEDFACE df ON df.ZASSETFORFACE = a.Z_PK
      JOIN ZPERSON p ON p.Z_PK = df.ZPERSONFORFACE
      WHERE p.ZPERSONUUID = ? AND a.ZTRASHEDSTATE = 0
    `, [personUuid])?.cnt || 0;
    return { photos: photos.map(p => mapPhoto(p, favs)), total };
  } catch (err) { console.error('get-person-photos error:', err); return { photos: [], total: 0 }; }
});

// ── IPC: map photos (with GPS) ────────────────────────────────────────────────
ipcMain.handle('get-map-photos', async () => {
  if (!db) return [];
  try {
    return dbAll(
      `SELECT ZUUID,ZFILENAME,ZDATECREATED,ZLATITUDE,ZLONGITUDE,ZKIND,ZWIDTH,ZHEIGHT,ZDIRECTORY
       FROM ZASSET
       WHERE ZTRASHEDSTATE=0 AND ZLATITUDE IS NOT NULL AND ZLATITUDE!=-180
         AND ZLONGITUDE IS NOT NULL AND ZLONGITUDE!=-180`
    ).map(p => ({
      uuid: p.ZUUID, filename: p.ZFILENAME, dateCreated: p.ZDATECREATED,
      latitude: p.ZLATITUDE, longitude: p.ZLONGITUDE, isVideo: p.ZKIND === 1,
      thumbnailPath: getThumbnailPath(libraryPath, p.ZUUID),
      originalPath: getOriginalPath(p.ZDIRECTORY, p.ZFILENAME),
      width: p.ZWIDTH, height: p.ZHEIGHT,
    }));
  } catch { return []; }
});

// ── IPC: favorites ────────────────────────────────────────────────────────────
ipcMain.handle('toggle-favorite', async (event, uuid) => {
  const favs = loadFavs();
  if (favs[uuid]) { delete favs[uuid]; } else { favs[uuid] = true; }
  saveFavs(favs);
  return { success: true, isFavorite: !!favs[uuid] };
});
ipcMain.handle('get-local-favorites', () => loadFavs());

// ── IPC: HEIC → JPEG conversion (macOS sips) ─────────────────────────────────
ipcMain.handle('get-heic-jpeg', async (event, { uuid, heicPath }) => {
  if (heicCache.has(uuid)) return { path: heicCache.get(uuid) };
  const tmpPath = path.join(os.tmpdir(), `plv_${uuid}.jpg`);
  if (fs.existsSync(tmpPath)) {
    heicCache.set(uuid, normPath(tmpPath));
    return { path: normPath(tmpPath) };
  }
  try {
    await execFileAsync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '90', heicPath, '--out', tmpPath]);
    heicCache.set(uuid, normPath(tmpPath));
    return { path: normPath(tmpPath) };
  } catch (err) {
    console.error('HEIC conversion failed:', err.message);
    return { path: null };
  }
});

// ── misc ──────────────────────────────────────────────────────────────────────
ipcMain.handle('get-library-info', () => ({ path: libraryPath }));
ipcMain.handle('check-file-exists', (e, p) => fs.existsSync(p));

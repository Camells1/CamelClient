// Camel Client: the main process. Owns the window, the game library on disk (download, install,
// launch, uninstall) and the launch ticket that lets a game know it was started from the client
// by a signed-in player.
const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const { spawn, execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const CATALOG = require('./catalog');

const SHARED = path.join(app.getPath('appData'), 'CamelStudios');   // read by the games
const TICKET = path.join(SHARED, 'ticket.json');
const STATE = path.join(app.getPath('userData'), 'state.json');
const DOWNLOADS = path.join(app.getPath('userData'), 'downloads');
const DEV = !app.isPackaged;

let win = null;
let state = { library: fs.existsSync('D:\\') ? 'D:\\Games' : path.join(process.env.LOCALAPPDATA || app.getPath('home'), 'CamelGames'), games: {}, releases: {} };
try { Object.assign(state, JSON.parse(fs.readFileSync(STATE, 'utf8'))); } catch (_) {}
const saveState = () => { try { fs.mkdirSync(path.dirname(STATE), { recursive: true }); fs.writeFileSync(STATE, JSON.stringify(state, null, 2)); } catch (_) {} };
const send = (channel, data) => { if (win && !win.isDestroyed()) win.webContents.send(channel, data); };
const gameById = id => CATALOG.find(g => g.id === id);
const running = new Map(); // id -> child process

function createWindow() {
  win = new BrowserWindow({
    width: 1440, height: 860, minWidth: 1100, minHeight: 680, frame: false, backgroundColor: '#0c0d10', title: 'Camel Client',
    icon: path.join(__dirname, '..', 'assets', 'icon.png'), show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false }
  });
  win.loadFile(path.join(__dirname, '..', 'index.html'));
  win.once('ready-to-show', () => win.show());
  win.on('maximize', () => send('win:state', true)); win.on('unmaximize', () => send('win:state', false));
  // Links never navigate the client itself
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https:\/\//.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file:')) { e.preventDefault(); if (/^https:\/\//.test(url)) shell.openExternal(url); } });
  win.webContents.on('before-input-event', (e, input) => { if (DEV && input.type === 'keyDown' && input.key === 'F12') win.webContents.toggleDevTools(); });
}

// One copy only; a second launch (or a game's "Open Camel Client" button) brings the window forward
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); } });
  app.setAsDefaultProtocolClient('camel');
  app.whenReady().then(createWindow);
}
app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => { try { fs.rmSync(TICKET, { force: true }); } catch (_) {} });

// ---------------------------------------------------------------- window
ipcMain.on('win:min', () => win?.minimize());
ipcMain.on('win:max', () => { if (!win) return; win.isMaximized() ? win.unmaximize() : win.maximize(); });
ipcMain.on('win:close', () => win?.close());
ipcMain.handle('app:info', () => ({ version: app.getVersion(), dev: DEV, library: state.library }));
ipcMain.handle('open:url', (_e, url) => { if (/^https:\/\//.test(String(url))) shell.openExternal(url); });

// ---------------------------------------------------------------- the library on disk
const exeVersion = file => new Promise(resolve => {
  execFile('powershell.exe', ['-NoProfile', '-Command', `(Get-Item -LiteralPath '${file.replace(/'/g, "''")}').VersionInfo.ProductVersion`], { windowsHide: true, timeout: 8000 },
    (err, out) => resolve(err ? '' : String(out).trim()));
});
const versionCache = new Map(); // exe path + mtime -> version

async function installInfo(g) {
  const saved = state.games[g.id];
  const dirs = [saved?.dir, path.join(state.library, g.dir), path.join(process.env.LOCALAPPDATA || '', 'Programs', g.id)].filter(Boolean);
  for (const dir of dirs) {
    const exe = path.join(dir, g.exe);
    let st; try { st = fs.statSync(exe); } catch (_) { continue; }
    const key = exe + '|' + st.mtimeMs;
    if (!versionCache.has(key)) versionCache.set(key, await exeVersion(exe));
    return { installed: true, dir, exe, version: versionCache.get(key).replace(/\.0$/, '') };
  }
  return { installed: false };
}

async function latestRelease(g) {
  if (!g.repo) return null;
  const cached = state.releases[g.id];
  if (cached && Date.now() - cached.at < 10 * 60 * 1000) return cached;
  try {
    const res = await fetch(`https://api.github.com/repos/${g.repo}/releases/latest`, { headers: { 'User-Agent': 'CamelClient', Accept: 'application/vnd.github+json' } });
    if (!res.ok) throw new Error('GitHub ' + res.status);
    const j = await res.json(), asset = (j.assets || []).find(a => a.name === g.asset);
    const rel = { at: Date.now(), version: String(j.tag_name || '').replace(/^v/, ''), notes: j.body || '', published: j.published_at, url: asset?.browser_download_url || null, size: asset?.size || 0, page: j.html_url };
    state.releases[g.id] = rel; saveState();
    return rel;
  } catch (_) { return cached || null; } // offline: use what we knew last time
}

// A build on this PC that isn't published (yet): only offered when it exists
function localBuild(g) {
  try { const st = fs.statSync(g.local); return { path: g.local, size: st.size, at: st.mtimeMs }; } catch (_) { return null; }
}

ipcMain.handle('games:list', async () => Promise.all(CATALOG.map(async g => {
  const [info, release] = await Promise.all([installInfo(g), latestRelease(g)]);
  return { ...g, ...info, release, local: localBuild(g), running: running.has(g.id) };
})));

function download(url, file, onProgress) {
  return new Promise(async (resolve, reject) => {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'CamelClient' }, redirect: 'follow' });
      if (!res.ok || !res.body) throw new Error('Download failed (' + res.status + ')');
      const total = +res.headers.get('content-length') || 0;
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const out = fs.createWriteStream(file);
      let got = 0, last = 0;
      const reader = res.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        got += value.length;
        if (!out.write(Buffer.from(value))) await new Promise(r => out.once('drain', r));
        if (Date.now() - last > 120) { last = Date.now(); onProgress(got, total); }
      }
      out.end(() => resolve(file));
    } catch (e) { reject(e); }
  });
}

const busy = new Set();
// source: 'release' (download the published installer) or 'local' (an installer on this PC)
ipcMain.handle('games:install', async (_e, id, source) => {
  const g = gameById(id);
  if (!g || busy.has(id)) return { ok: false, error: 'Already working on it.' };
  if (running.has(id)) return { ok: false, error: `Close ${g.name} first.` };
  busy.add(id);
  const step = (phase, pct) => send('games:progress', { id, phase, pct });
  try {
    let installer;
    if (source === 'local') {
      const lb = localBuild(g); if (!lb) throw new Error('No local build found.');
      installer = lb.path;
    } else {
      const rel = await latestRelease(g);
      if (!rel?.url) throw new Error(`${g.name} isn't available to download yet.`);
      step('download', 0);
      installer = await download(rel.url, path.join(DOWNLOADS, g.asset), (got, total) => step('download', total ? got / total : 0));
    }
    step('install', 1);
    const dir = path.join(state.library, g.dir);
    fs.mkdirSync(state.library, { recursive: true });
    // NSIS silent install: /D= must be last and unquoted
    await new Promise((resolve, reject) => {
      const p = spawn(installer, ['/S', `/D=${dir}`], { windowsVerbatimArguments: true, windowsHide: true });
      p.on('error', reject); p.on('exit', code => (code === 0 ? resolve() : reject(new Error('The installer stopped (code ' + code + ').'))));
    });
    if (!fs.existsSync(path.join(dir, g.exe))) throw new Error('Install finished but the game is missing.');
    state.games[id] = { dir }; saveState();
    if (source !== 'local') { try { fs.rmSync(installer, { force: true }); } catch (_) {} }
    step('done', 1);
    return { ok: true };
  } catch (e) {
    step('error', 0);
    return { ok: false, error: e.message || String(e) };
  } finally { busy.delete(id); }
});

ipcMain.handle('games:uninstall', async (_e, id) => {
  const g = gameById(id), info = g && await installInfo(g);
  if (!info?.installed) return { ok: false, error: 'Not installed.' };
  if (running.has(id)) return { ok: false, error: `Close ${g.name} first.` };
  const un = fs.readdirSync(info.dir).find(f => /^Uninstall .*\.exe$/i.test(f));
  if (!un) return { ok: false, error: 'No uninstaller found in the game folder.' };
  await new Promise(resolve => { const p = spawn(path.join(info.dir, un), ['/S'], { windowsHide: true }); p.on('exit', resolve); p.on('error', resolve); });
  // The uninstaller copies itself to temp and finishes a moment later
  for (let i = 0; i < 40 && fs.existsSync(info.exe); i++) await new Promise(r => setTimeout(r, 250));
  delete state.games[id]; saveState();
  return { ok: !fs.existsSync(info.exe) };
});

ipcMain.handle('games:folder', async (_e, id) => { const g = gameById(id), info = g && await installInfo(g); if (info?.installed) shell.openPath(info.dir); });

// ---------------------------------------------------------------- launching
// session: { uid, email, name, tag, refreshToken } of the signed-in player.
// The game reads the ticket once at start-up; without a fresh one it refuses to run.
ipcMain.handle('games:launch', async (_e, id, session) => {
  const g = gameById(id), info = g && await installInfo(g);
  if (!info?.installed) return { ok: false, error: 'Not installed.' };
  if (running.has(id)) return { ok: false, error: `${g.name} is already running.` };
  if (!session?.uid || !session?.refreshToken) return { ok: false, error: 'Sign in first.' };
  try {
    fs.mkdirSync(SHARED, { recursive: true });
    fs.writeFileSync(TICKET, JSON.stringify({ v: 1, at: Date.now(), game: id, uid: session.uid, email: session.email || '', name: session.name || '', tag: session.tag || '', refreshToken: session.refreshToken, stay: true }));
    const child = spawn(info.exe, ['--camel-ticket'], { cwd: info.dir, detached: true, stdio: 'ignore' });
    running.set(id, child);
    child.on('exit', () => { running.delete(id); send('games:exit', { id }); });
    child.on('error', () => { running.delete(id); send('games:exit', { id }); });
    child.unref();
    return { ok: true };
  } catch (e) { return { ok: false, error: e.message || String(e) }; }
});

// ---------------------------------------------------------------- updating the client itself
const newer = (a, b) => { const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); } return false; };
let pendingUpdate = null;
ipcMain.handle('client:check', async () => {
  if (DEV) return null;
  try {
    const res = await fetch('https://api.github.com/repos/Camells1/CamelClient/releases/latest', { headers: { 'User-Agent': 'CamelClient', Accept: 'application/vnd.github+json' } });
    if (!res.ok) return null;
    const j = await res.json(), version = String(j.tag_name || '').replace(/^v/, ''), asset = (j.assets || []).find(x => x.name === 'Camel-Client-Setup.exe');
    if (!asset || !newer(version, app.getVersion())) return null;
    pendingUpdate = { version, url: asset.browser_download_url };
    return { version };
  } catch (_) { return null; }
});
// Download the new installer, run it quietly over this install and start the new version
ipcMain.handle('client:update', async () => {
  if (!pendingUpdate) return { ok: false, error: 'No update found.' };
  if (running.size) return { ok: false, error: 'Close your game first.' };
  try {
    const file = await download(pendingUpdate.url, path.join(DOWNLOADS, 'Camel-Client-Setup.exe'), (got, total) => send('client:progress', total ? got / total : 0));
    spawn(file, ['/S', '--force-run'], { detached: true, stdio: 'ignore' }).unref();
    setTimeout(() => app.quit(), 400);
    return { ok: true };
  } catch (e) { return { ok: false, error: e.message || String(e) }; }
});

// ---------------------------------------------------------------- settings
ipcMain.handle('settings:library', async () => {
  const r = await dialog.showOpenDialog(win, { title: 'Where should games be installed?', defaultPath: state.library, properties: ['openDirectory', 'createDirectory'] });
  if (r.canceled || !r.filePaths[0]) return state.library;
  state.library = r.filePaths[0]; saveState();
  return state.library;
});

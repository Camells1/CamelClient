// Camel Client: everything you see. Sign-in screen, the rail of game logos, Home, Library,
// each game's page (install / update / play), Settings and the friends panel.
import { Account, Friends, nice, cleanName, cleanTag, randomTag } from './account.js';

const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const api = window.camel;

// Artwork and news that ship with the client
const ART = {
  riftline: { icon: 'assets/games/riftline-icon.png', hero: 'assets/games/riftline-lineup.jpg', shots: ['riftline-fps.jpg', 'riftline-menu.jpg', 'riftline-lineup.jpg'] },
  shattercrown: { icon: 'assets/games/shattercrown-icon.svg', hero: 'assets/games/shattercrown-title.jpg', shots: ['shattercrown-gameplay.jpg', 'shattercrown-boss.jpg', 'shattercrown-title.jpg'] },
  hollowtide: { icon: 'assets/games/hollowtide-icon.png', hero: 'assets/games/hollowtide-city.jpg', shots: ['hollowtide-title.jpg', 'hollowtide-friend.jpg', 'hollowtide-city.jpg'] },
  lanternfall: { icon: 'assets/games/lanternfall-icon.png', hero: '', shots: [] }
};
const NEWS = [
  { game: 'hollowtide', kind: 'Update', title: 'Hollowtide 0.2: the lagoon grows up', text: 'First person, a lagoon ten times the size, sunken cities to climb, a lighthouse on the horizon and proximity voice with your friends.' },
  { game: 'lanternfall', kind: 'Announcement', title: 'Lanternfall is on the way', text: 'Our next game: a descent into the dark with a lantern as your lifeline. Playable builds will show up right here.' },
  { game: 'riftline', kind: 'Now playing', title: 'Riftline: plant, defuse, repeat', text: 'Six maps, a full agent roster and ranked-style rounds against a friend or bots.' },
  { game: 'shattercrown', kind: 'Now playing', title: 'Shattercrown: bring a friend to the keep', text: 'The pixel-art action RPG with online co-op and a hero you build yourself.' }
];

const S = { games: [], view: 'home', progress: {}, tab: 'friends', me: null, info: null, socialOpen: localStorage.getItem('social') !== '0' };
const game = id => S.games.find(g => g.id === id);
const semver = v => String(v || '0').split('.').map(n => parseInt(n, 10) || 0);
const newer = (a, b) => { const x = semver(a), y = semver(b); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); } return false; };
// What the big button should do for a game right now
function status(g) {
  const p = S.progress[g.id];
  if (p && (p.phase === 'download' || p.phase === 'install')) return { key: 'busy', label: p.phase === 'download' ? `Downloading ${Math.round(p.pct * 100)}%` : 'Installing…', pct: p.phase === 'download' ? p.pct : 1 };
  if (g.running) return { key: 'running', label: 'Running' };
  if (g.installed) return g.release?.url && newer(g.release.version, g.version) ? { key: 'update', label: 'Update' } : { key: 'play', label: 'Play' };
  if (g.release?.url) return { key: 'install', label: 'Install' };
  if (g.local) return { key: 'local', label: 'Install' };
  return { key: 'soon', label: 'Coming soon' };
}
let toastT = 0;
function toast(msg, bad = false) { const t = $('#toast'); t.textContent = msg; t.className = 'on' + (bad ? ' bad' : ''); clearTimeout(toastT); toastT = setTimeout(() => { t.className = ''; }, 3600); }
const fmtDate = d => d ? new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : '';
const fmtSize = n => n ? (n / 1048576).toFixed(0) + ' MB' : '';
// Release notes come from GitHub as light markdown
function notesHtml(md) {
  let html = '', list = false;
  for (const raw of String(md || '').split(/\r?\n/)) {
    const line = raw.trim();
    const item = /^[-*]\s+(.*)/.exec(line), head = /^#+\s+(.*)/.exec(line);
    if (item) { if (!list) { html += '<ul>'; list = true; } html += `<li>${esc(item[1])}</li>`; continue; }
    if (list) { html += '</ul>'; list = false; }
    if (head) html += `<h4>${esc(head[1])}</h4>`; else if (line) html += `<p>${esc(line)}</p>`;
  }
  if (list) html += '</ul>';
  return html.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`(.+?)`/g, '$1');
}

// ---------------------------------------------------------------- window bar
for (const b of $$('[data-win]')) b.addEventListener('click', () => api.win[b.dataset.win]());

// ---------------------------------------------------------------- sign in
const msg = (t, ok = false) => { const m = $('#login-msg'); m.textContent = t || ''; m.classList.toggle('ok', ok); };
function showForm(up) { $('#f-in').classList.toggle('hidden', up); $('#f-up').classList.toggle('hidden', !up); $('#login-title').textContent = up ? 'Create account' : 'Sign in'; msg(''); }
$('#l-up').addEventListener('click', () => { showForm(true); if (!$('#up-tag').value) $('#up-tag').value = randomTag(); preview(); });
$('#l-in').addEventListener('click', () => showForm(false));
const preview = () => { $('#up-preview').textContent = `${cleanName($('#up-name').value) || 'Name'}#${cleanTag($('#up-tag').value) || 'TAG'}`; };
$('#up-name').addEventListener('input', preview);
$('#up-tag').addEventListener('input', e => { e.target.value = cleanTag(e.target.value); preview(); });
const busyForm = (f, on) => f.querySelectorAll('button').forEach(b => { b.disabled = on; });
$('#f-in').addEventListener('submit', async e => {
  e.preventDefault(); const f = e.target; busyForm(f, true); msg('');
  try { await Account.signIn($('#in-email').value, $('#in-pass').value, $('#in-stay').checked); $('#in-pass').value = ''; }
  catch (err) { msg(nice(err)); }
  busyForm(f, false);
});
$('#f-up').addEventListener('submit', async e => {
  e.preventDefault(); const f = e.target; busyForm(f, true); msg('');
  try { await Account.signUp($('#up-email').value, $('#up-pass').value, $('#up-name').value, $('#up-tag').value, true); $('#up-pass').value = ''; }
  catch (err) { msg(nice(err)); }
  busyForm(f, false);
});
$('#l-reset').addEventListener('click', async () => {
  const email = $('#in-email').value.trim();
  if (!email) { msg('Type your email above first, then click this again.'); return; }
  try { await Account.reset(email); msg('Password reset email sent. Check your inbox.', true); } catch (err) { msg(nice(err)); }
});
// Rotating artwork beside the sign-in form
let artI = 0;
function rotateArt() {
  const list = S.games.filter(g => ART[g.id]?.hero);
  if (!list.length) return;
  const g = list[artI++ % list.length];
  $('#login-art').style.backgroundImage = `url("${ART[g.id].hero}")`; $('#art-name').textContent = g.name; $('#art-tag').textContent = g.tagline;
}
setInterval(() => { if (!$('#login').classList.contains('hidden')) rotateArt(); }, 6000);

// ---------------------------------------------------------------- views
function nav(view) { S.view = view; render(); $('#view').scrollTop = 0; }
document.addEventListener('click', e => {
  const n = e.target.closest('[data-nav]'); if (n) { nav(n.dataset.nav); return; }
  const a = e.target.closest('[data-act]'); if (a) act(a.dataset.act, a.dataset.id, a);
});

function renderRail() {
  $('#rail-games').innerHTML = S.games.map(g => {
    const st = status(g);
    return `<button class="rail-game ${S.view === 'game:' + g.id ? 'on' : ''} ${st.key === 'update' ? 'update' : ''} ${g.installed ? '' : 'off'}" data-nav="game:${g.id}" title="${esc(g.name)}"><img src="${ART[g.id].icon}" alt="" /><i class="dot"></i></button>`;
  }).join('');
  for (const b of $$('.rail-btn')) b.classList.toggle('on', b.dataset.nav === S.view);
}

function tile(g) {
  const st = status(g), cls = { play: 'play', running: 'play', update: 'upd', soon: 'soon' }[st.key] || '';
  const bg = ART[g.id].hero ? `background-image:url('${ART[g.id].hero}')` : `background:linear-gradient(135deg, ${g.accent}55, #15171c 70%)`;
  return `<div class="tile" data-nav="game:${g.id}" style="${bg}"><div class="t"><img src="${ART[g.id].icon}" alt="" /><div><b>${esc(g.name)}</b><span>${esc(g.genre)}</span></div><span class="pill ${cls}">${esc(st.key === 'busy' ? 'Working…' : st.label)}</span></div></div>`;
}

function viewHome() {
  const notes = S.games.filter(g => g.release?.version).sort((a, b) => new Date(b.release.published) - new Date(a.release.published));
  const [top, ...rest] = NEWS;
  const feature = n => { const g = game(n.game); return `<div class="feature" data-nav="game:${g.id}"><div class="t"><img src="${ART[g.id].icon}" alt="" /><span class="kind" style="color:${g.accent}">${esc(n.kind)}</span><b>${esc(n.title)}</b><p>${esc(n.text)}</p></div><div class="p" style="${ART[g.id].hero ? `background-image:url('${ART[g.id].hero}')` : `background:linear-gradient(135deg, ${g.accent}66, #15171c)`}"></div></div>`; };
  return `<h1 class="page">Home</h1>
    ${notes.length ? `<h2 class="sec" style="margin-top:0">Latest Patch Notes</h2><div class="row">${notes.map(g => `<div class="note" data-nav="game:${g.id}"><div class="t"><img src="${ART[g.id].icon}" alt="" /><b>${esc(g.name)} Patch Notes ${esc(g.release.version)}</b><small style="color:${g.accent}">${esc(fmtDate(g.release.published))}</small></div><div class="p" style="background-image:url('${ART[g.id].hero}')"></div></div>`).join('')}</div>` : ''}
    <h2 class="sec">What's New</h2>${feature(top)}
    <div class="row" style="margin-top:16px">${rest.map(n => { const g = game(n.game); return `<div class="note" data-nav="game:${g.id}"><div class="t"><img src="${ART[g.id].icon}" alt="" /><b>${esc(n.title)}</b><small style="color:${g.accent}">${esc(n.kind)}</small></div><div class="p" style="${ART[g.id].hero ? `background-image:url('${ART[g.id].hero}')` : `background:linear-gradient(135deg, ${g.accent}66, #15171c)`}"></div></div>`; }).join('')}</div>
    <h2 class="sec">Your Games</h2><div class="row">${S.games.map(tile).join('')}</div>`;
}

function viewLibrary() {
  const mine = S.games.filter(g => g.installed), others = S.games.filter(g => !g.installed);
  return `<h1 class="page">Library</h1>
    <h2 class="sec" style="margin-top:0">Installed</h2>${mine.length ? `<div class="row">${mine.map(tile).join('')}</div>` : '<p class="meta">Nothing installed yet. Pick a game below.</p>'}
    ${others.length ? `<h2 class="sec">More from Camel Studios</h2><div class="row">${others.map(tile).join('')}</div>` : ''}`;
}

function viewGame(g) {
  const st = status(g), art = ART[g.id];
  const hero = art.hero ? `background-image:url('${art.hero}')` : `background:radial-gradient(ellipse at 70% 30%, ${g.accent}55, #0c0d10 70%)`;
  const meta = [];
  if (g.installed) meta.push(`Installed: <b>v${esc(g.version || '?')}</b>`);
  if (g.release?.version) meta.push(`Latest release: <b>v${esc(g.release.version)}</b>${g.release.size ? ' · ' + fmtSize(g.release.size) : ''}`);
  if (!g.release?.version && !g.local) meta.push('Not released yet');
  const extra = [];
  if (g.installed) extra.push(`<button class="ghost" data-act="folder" data-id="${g.id}">Open folder</button>`, `<button class="ghost" data-act="uninstall" data-id="${g.id}">Uninstall</button>`);
  if (g.local && S.info?.dev) extra.push(`<button class="ghost" data-act="local" data-id="${g.id}" title="${esc(g.local.path)}">Install build from this PC</button>`);
  return `<div class="hero" style="${hero}"><div class="hero-in"><img src="${art.icon}" alt="" /><div><div class="genre" style="color:${g.accent}">${esc(g.genre)}</div><h1>${esc(g.name)}</h1><p>${esc(g.tagline)}</p></div></div></div>
    <div class="playbar" style="--ga:${g.accent}">
      <button class="play ${st.key === 'soon' ? 'soon' : ''} ${st.key === 'busy' || st.key === 'running' ? 'busy' : ''}" data-act="main" data-id="${g.id}" ${st.key === 'soon' || st.key === 'busy' || st.key === 'running' ? 'disabled' : ''}>${st.key === 'busy' ? `<i class="bar" style="width:${(st.pct * 100).toFixed(0)}%"></i>` : ''}<span>${esc(st.label)}</span></button>
      <div class="meta">${meta.join('<br>')}</div>
      <div style="margin-left:auto;display:flex;gap:8px;flex-wrap:wrap">${extra.join('')}</div>
    </div>
    <div class="cols">
      <div><h2 class="sec">About</h2><p class="about">${esc(g.about)}</p>
        ${art.shots.length ? `<h2 class="sec">Screenshots</h2><div class="shots">${art.shots.map(s => `<div style="background-image:url('assets/games/${s}')"></div>`).join('')}</div>` : ''}</div>
      <div><h2 class="sec">Patch Notes</h2><div class="notes">${g.release?.version ? `<div class="ver">Version ${esc(g.release.version)}</div><div class="date">${esc(fmtDate(g.release.published))}</div>${notesHtml(g.release.notes) || '<p>No notes for this version.</p>'}` : '<p>Patch notes will appear here once the game is released.</p>'}</div></div>
    </div>`;
}

function viewSettings() {
  return `<h1 class="page">Settings</h1><div class="set">
    <div class="item"><div><b>Account</b><span>${esc(S.me?.id || '')} · ${esc(S.me?.email || '')}</span></div><button class="ghost" data-act="signout">Sign out</button></div>
    <div class="item"><div><b>Game library folder</b><span>${esc(S.info?.library || '')}</span></div><button class="ghost" data-act="library">Change…</button></div>
    <div class="item"><div><b>Account page</b><span>Change your name#TAG or password on the Camel Studios website.</span></div><button class="ghost" data-act="site">Open</button></div>
    <div class="item"><div><b>Camel Client</b><span>Version ${esc(S.info?.version || '')}</span></div></div>
  </div>`;
}

function render() {
  renderRail();
  const v = S.view, g = v.startsWith('game:') && game(v.slice(5));
  $('#view').innerHTML = g ? viewGame(g) : v === 'library' ? viewLibrary() : v === 'settings' ? viewSettings() : viewHome();
}

// ---------------------------------------------------------------- actions
async function refresh() { S.games = await api.games.list(); render(); }
async function install(id, source) {
  const g = game(id);
  S.progress[id] = { phase: source === 'local' ? 'install' : 'download', pct: 0 }; render();
  const r = await api.games.install(id, source);
  delete S.progress[id];
  if (!r.ok) toast(r.error || 'Install failed.', true); else toast(`${g.name} is ready to play.`);
  await refresh();
}
async function act(name, id, el) {
  const g = id && game(id);
  if (name === 'main') {
    const st = status(g);
    if (st.key === 'play') {
      const r = await api.games.launch(id, Account.session());
      if (!r.ok) { toast(r.error, true); return; }
      g.running = true; Friends.setPresence('ingame', g.name); renderSocial(); render();
    } else if (st.key === 'install' || st.key === 'update') install(id, 'release');
    else if (st.key === 'local') install(id, 'local');
  } else if (name === 'local') install(id, 'local');
  else if (name === 'folder') api.games.folder(id);
  else if (name === 'uninstall') {
    if (el.dataset.sure !== '1') { el.dataset.sure = '1'; el.textContent = 'Click again to uninstall'; setTimeout(() => { if (el.isConnected) { el.dataset.sure = ''; el.textContent = 'Uninstall'; } }, 3000); return; }
    const r = await api.games.uninstall(id); if (!r.ok) toast(r.error || 'Could not uninstall.', true); else toast(`${g.name} was uninstalled.`);
    await refresh();
  } else if (name === 'signout') { await Account.signOut(); }
  else if (name === 'library') { S.info.library = await api.chooseLibrary(); await refresh(); }
  else if (name === 'site') api.open('https://camells1.github.io/account/');
  else if (name === 'accept') { try { await Friends.accept(id); } catch (e) { toast(nice(e), true); } }
  else if (name === 'unfriend') {
    if (el.dataset.sure !== '1' && el.dataset.ask) { el.dataset.sure = '1'; el.classList.add('no'); el.title = 'Click again to remove'; return; }
    try { await Friends.remove(id); } catch (e) { toast(nice(e), true); }
  } else if (name === 'social') { S.socialOpen = !S.socialOpen; localStorage.setItem('social', S.socialOpen ? '1' : '0'); renderSocial(); }
}
api.games.onProgress(p => { if (p.phase === 'done' || p.phase === 'error') return; S.progress[p.id] = p; render(); });
api.games.onExit(({ id }) => { const g = game(id); if (g) g.running = false; if (!S.games.some(x => x.running)) Friends.setPresence('online'); renderSocial(); render(); });

// ---------------------------------------------------------------- friends panel
const X = '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>', OK = '<svg viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg>';
const initial = id => esc((id || '?').trim()[0]?.toUpperCase() || '?');
function friendRow(f) {
  const st = Friends.statusOf(f.uid), text = st.state === 'ingame' ? `Playing ${esc(st.game || 'a game')}` : st.state === 'online' ? 'Online' : 'Offline';
  return `<div class="fr ${st.state}"><div class="avatar ${st.state}">${initial(f.id)}</div><div class="who"><b>${esc(f.id)}</b><span>${text}</span></div><div class="acts"><button class="ib" data-act="unfriend" data-ask="1" data-id="${esc(f.pair)}" title="Remove friend">${X}</button></div></div>`;
}
function renderSocial() {
  const open = S.socialOpen;
  $('#social').classList.toggle('hidden', !open); $('#social-open').classList.toggle('hidden', open);
  if (!S.me) return;
  const playing = S.games.find(g => g.running);
  $('#me-name').textContent = S.me.id; $('#me-avatar').textContent = (S.me.name[0] || '?').toUpperCase();
  $('#me-avatar').className = 'avatar ' + (playing ? 'ingame' : 'online'); $('#me-status').textContent = playing ? `Playing ${playing.name}` : 'Online';
  const friends = Friends.list.filter(f => f.status === 'accepted'), incoming = Friends.list.filter(f => f.incoming), outgoing = Friends.list.filter(f => f.status === 'pending' && !f.incoming);
  const on = friends.filter(f => Friends.statusOf(f.uid).state !== 'offline'), off = friends.filter(f => Friends.statusOf(f.uid).state === 'offline');
  $('#req-dot').classList.toggle('on', incoming.length > 0);
  $('#open-count').textContent = on.length ? String(on.length) : '';
  for (const b of $$('#social-tabs button')) b.classList.toggle('on', b.dataset.tab === S.tab);
  const body = $('#social-body');
  // Don't wipe the box while someone is typing a friend's ID
  if (S.tab === 'add' && body.querySelector('#add-id')) return;
  if (Friends.error && S.tab !== 'add') { body.innerHTML = `<div class="empty">${esc(Friends.error)}</div>`; return; }
  if (S.tab === 'friends') {
    body.innerHTML = friends.length ? `${on.length ? `<div class="grp">Online (${on.length})</div>${on.map(friendRow).join('')}` : ''}${off.length ? `<div class="grp">Offline (${off.length})</div>${off.map(friendRow).join('')}` : ''}`
      : '<div class="empty">No friends yet.<br>Add one with their Name#TAG.</div>';
  } else if (S.tab === 'requests') {
    body.innerHTML = (incoming.length || outgoing.length) ? `${incoming.length ? `<div class="grp">Wants to be friends</div>${incoming.map(f => `<div class="fr req"><div class="avatar">${initial(f.id)}</div><div class="who"><b>${esc(f.id)}</b><span>Friend request</span></div><div class="acts"><button class="ib yes" data-act="accept" data-id="${esc(f.pair)}" title="Accept">${OK}</button><button class="ib no" data-act="unfriend" data-id="${esc(f.pair)}" title="Decline">${X}</button></div></div>`).join('')}` : ''}${outgoing.length ? `<div class="grp">Sent</div>${outgoing.map(f => `<div class="fr req"><div class="avatar">${initial(f.id)}</div><div class="who"><b>${esc(f.id)}</b><span>Waiting for them</span></div><div class="acts"><button class="ib no" data-act="unfriend" data-id="${esc(f.pair)}" title="Cancel request">${X}</button></div></div>`).join('')}` : ''}`
      : '<div class="empty">No friend requests.</div>';
  } else {
    body.innerHTML = `<div class="addbox"><p>Add a friend with their Camel ID.</p><input id="add-id" placeholder="Name#TAG" maxlength="20" spellcheck="false" /><button id="add-go">Send request</button><p class="res" id="add-res"></p><p>Your ID</p><div class="myid">${esc(S.me.id)}</div></div>`;
    const go = async () => {
      const res = $('#add-res'); res.className = 'res'; res.textContent = '';
      try { res.textContent = await Friends.add($('#add-id').value); res.classList.add('ok'); $('#add-id').value = ''; } catch (e) { res.textContent = nice(e); }
    };
    $('#add-go').addEventListener('click', go); $('#add-id').addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
  }
}
for (const b of $$('#social-tabs button')) b.addEventListener('click', () => { S.tab = b.dataset.tab; $('#social-body').innerHTML = ''; renderSocial(); });
$('#social-toggle').addEventListener('click', () => act('social'));
$('#social-open').addEventListener('click', () => act('social'));
Friends.onChange = renderSocial;

// ---------------------------------------------------------------- start
Account.onChange = user => {
  S.me = user;
  $('#login').classList.toggle('hidden', !!user); $('#app').classList.toggle('hidden', !user);
  if (user) { S.view = 'home'; render(); renderSocial(); } else { showForm(false); rotateArt(); }
};
(async () => {
  S.info = await api.info();
  S.games = await api.games.list();
  rotateArt();
  Account.start();
  // Keep install state and release info fresh while the client is open
  setInterval(() => { if (S.me && !Object.keys(S.progress).length) refresh(); }, 5 * 60 * 1000);
  addEventListener('focus', () => { if (S.me && !Object.keys(S.progress).length) refresh(); });
})();
window.__cc = { S, Account, Friends, nav, refresh };

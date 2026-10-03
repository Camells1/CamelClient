// Camel Client: everything you see. Sign-in, the dock of game logos, Home, Library, each game's page
// (install / update / play), Settings, and the social panel: friends, chat and parties.
import { Account, Friends, Chat, Party, nice, cleanName, cleanTag, randomTag } from './account.js';

const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const api = window.camel;

// Artwork and news that ship with the client
const ART = {
  riftline: { icon: 'assets/games/riftline-icon.png', hero: 'assets/games/riftline-lineup.jpg', shots: ['riftline-fps.jpg', 'riftline-menu.jpg', 'riftline-lineup.jpg'] },
  shattercrown: { icon: 'assets/games/shattercrown-icon.svg', hero: 'assets/games/shattercrown-gameplay.jpg', shots: ['shattercrown-gameplay.jpg', 'shattercrown-boss.jpg', 'shattercrown-title.jpg'] },
  hollowtide: { icon: 'assets/games/hollowtide-icon.png', hero: 'assets/games/hollowtide-title.jpg', shots: ['hollowtide-title.jpg', 'hollowtide-friend.jpg', 'hollowtide-city.jpg'] }
};
const NEWS = {
  hollowtide: { kind: 'Big update', title: 'The lagoon grows up', text: 'First person, a lagoon ten times the size, sunken cities to climb and proximity voice with your friends.' },
  riftline: { kind: 'Tactical shooter', title: 'Plant, defuse, repeat', text: 'Six maps, a full agent roster and tense rounds against a friend or bots.' },
  shattercrown: { kind: 'Action RPG', title: 'Bring a friend to the keep', text: 'Build a hero, explore a huge world in co-op and take down eleven bosses.' }
};

const S = { games: [], view: 'home', progress: {}, tab: 'friends', me: null, info: null, feature: 0, chatWith: null, socialOpen: localStorage.getItem('social') !== '0' };
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
const fmtDate = d => d ? new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '';
const fmtSize = n => n ? (n / 1048576).toFixed(0) + ' MB' : '';
const initial = id => esc((id || '?').trim()[0]?.toUpperCase() || '?');
// Release notes come from GitHub as light markdown
function notesHtml(md) {
  let html = '', list = false;
  for (const raw of String(md || '').split(/\r?\n/)) {
    const line = raw.trim(), item = /^[-*]\s+(.*)/.exec(line), head = /^#+\s+(.*)/.exec(line);
    if (item) { if (!list) { html += '<ul>'; list = true; } html += `<li>${esc(item[1])}</li>`; continue; }
    if (list) { html += '</ul>'; list = false; }
    if (head) html += `<h4>${esc(head[1])}</h4>`; else if (line) html += `<p>${esc(line)}</p>`;
  }
  if (list) html += '</ul>';
  return html.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`(.+?)`/g, '$1');
}
const playBtn = (g, extra = '') => {
  const st = status(g), off = st.key === 'soon' || st.key === 'busy' || st.key === 'running';
  return `<button class="play ${st.key === 'soon' ? 'soon' : ''} ${st.key === 'busy' || st.key === 'running' ? 'busy' : ''} ${extra}" data-act="main" data-id="${g.id}" ${off ? 'disabled' : ''}>${st.key === 'busy' ? `<i class="bar" style="width:${(st.pct * 100).toFixed(0)}%"></i>` : ''}<span>${esc(st.label)}</span></button>`;
};

// ---------------------------------------------------------------- window bar
for (const b of $$('[data-win]')) b.addEventListener('click', () => api.win[b.dataset.win]());

// ---------------------------------------------------------------- sign in
const msg = (t, ok = false) => { const m = $('#login-msg'); m.textContent = t || ''; m.classList.toggle('ok', ok); };
function showForm(up) {
  $('#f-in').classList.toggle('hidden', up); $('#f-up').classList.toggle('hidden', !up);
  $('#login-title').textContent = up ? 'Join the caravan' : 'Welcome back'; $('#login-sub').textContent = up ? 'Create your Camel Studios account.' : 'Sign in to your Camel Studios account.'; msg('');
}
$('#l-up').addEventListener('click', () => { showForm(true); if (!$('#up-tag').value) $('#up-tag').value = randomTag(); preview(); });
$('#l-in').addEventListener('click', () => showForm(false));
const preview = () => { $('#up-preview').textContent = `${cleanName($('#up-name').value) || 'Name'}#${cleanTag($('#up-tag').value) || 'TAG'}`; };
$('#up-name').addEventListener('input', preview);
$('#up-tag').addEventListener('input', e => { e.target.value = cleanTag(e.target.value); preview(); });
const busyForm = (f, on) => f.querySelectorAll('button').forEach(b => { b.disabled = on; });
$('#f-in').addEventListener('submit', async e => {
  e.preventDefault(); const f = e.target; busyForm(f, true); msg('');
  try { await Account.signIn($('#in-email').value, $('#in-pass').value, $('#in-stay').checked); $('#in-pass').value = ''; } catch (err) { msg(nice(err)); }
  busyForm(f, false);
});
$('#f-up').addEventListener('submit', async e => {
  e.preventDefault(); const f = e.target; busyForm(f, true); msg('');
  try { await Account.signUp($('#up-email').value, $('#up-pass').value, $('#up-name').value, $('#up-tag').value, true); $('#up-pass').value = ''; } catch (err) { msg(nice(err)); }
  busyForm(f, false);
});
$('#l-reset').addEventListener('click', async () => {
  const email = $('#in-email').value.trim();
  if (!email) { msg('Type your email above first, then click this again.'); return; }
  try { await Account.reset(email); msg('Password reset email sent. Check your inbox.', true); } catch (err) { msg(nice(err)); }
});
let artI = 0;
function rotateArt() {
  if (!S.games.length) return;
  const g = S.games[artI++ % S.games.length];
  $('#login-art').style.backgroundImage = `url("${ART[g.id].hero}")`; $('#art-name').textContent = g.name; $('#art-tag').textContent = g.tagline;
}
setInterval(() => { if (!$('#login').classList.contains('hidden')) rotateArt(); else if (S.view === 'home' && !document.hidden) { S.feature++; if (S.view === 'home') renderView(); } }, 9000);

// ---------------------------------------------------------------- views
function nav(view) { S.view = view; render(); $('#view').scrollTop = 0; }
document.addEventListener('click', e => {
  const n = e.target.closest('[data-nav]'); if (n) { nav(n.dataset.nav); return; }
  const a = e.target.closest('[data-act]'); if (a) act(a.dataset.act, a.dataset.id, a);
});

function renderChrome() {
  $('#dock-games').innerHTML = S.games.map(g => {
    const st = status(g);
    return `<button class="dock-game ${S.view === 'game:' + g.id ? 'on' : ''} ${st.key === 'update' ? 'update' : ''} ${g.running ? 'run' : ''} ${g.installed ? '' : 'off'}" style="--ga:${g.accent}" data-nav="game:${g.id}" title="${esc(g.name)}"><img src="${ART[g.id].icon}" alt="" /><i class="dot"></i></button>`;
  }).join('');
  for (const b of $$('#tabs button')) b.classList.toggle('on', b.dataset.nav === S.view);
  $('.dock-btn[data-nav=settings]').classList.toggle('on', S.view === 'settings');
  $('.dock-btn[data-act=social]').classList.toggle('on', S.socialOpen);
}
function tile(g) {
  const st = status(g), cls = { play: 'play-p', running: 'play-p', update: 'upd', soon: 'soon' }[st.key] || '';
  return `<div class="tile" data-nav="game:${g.id}" style="--ga:${g.accent};background-image:url('${ART[g.id].hero}')"><div class="t"><img src="${ART[g.id].icon}" alt="" /><div><b>${esc(g.name)}</b><span>${esc(g.genre)}</span></div><span class="pill ${cls}">${esc(st.key === 'busy' ? 'Working…' : st.label)}</span></div></div>`;
}
function viewHome() {
  const g = S.games[S.feature % S.games.length], n = NEWS[g.id];
  const notes = S.games.filter(x => x.release?.version).sort((a, b) => new Date(b.release.published) - new Date(a.release.published));
  return `<div class="hero" style="--ga:${g.accent};background-image:url('${ART[g.id].hero}')"><div class="hero-in"><span class="kind">${esc(n.kind)}</span><h1>${esc(g.name)}</h1><p><b>${esc(n.title)}.</b> ${esc(n.text)}</p>
      <div class="hero-acts">${playBtn(g)}<button class="ghost" data-nav="game:${g.id}">View game</button></div></div>
      <div class="hero-dots">${S.games.map((x, i) => `<button class="${x === g ? 'on' : ''}" style="--ga:${x.accent}" data-act="feature" data-id="${i}" title="${esc(x.name)}"><img src="${ART[x.id].icon}" alt="" /></button>`).join('')}</div></div>
    <h2 class="sec">Your games</h2><div class="row">${S.games.map(tile).join('')}</div>
    ${notes.length ? `<h2 class="sec">Latest patch notes</h2><div class="notes-list">${notes.map(x => `<div class="nrow" style="--ga:${x.accent}" data-nav="game:${x.id}"><img src="${ART[x.id].icon}" alt="" /><div><b>${esc(x.name)} ${esc(x.release.version)}</b><br><span>${esc((String(x.release.notes).split(/\r?\n/).find(l => l.trim() && !/^#/.test(l.trim())) || '').replace(/^[-*]\s*/, '').slice(0, 110))}</span></div><span class="when">${esc(fmtDate(x.release.published))}</span></div>`).join('')}</div>` : ''}`;
}
function viewLibrary() {
  const mine = S.games.filter(g => g.installed), others = S.games.filter(g => !g.installed);
  return `<h1 class="page">Library</h1><h2 class="sec" style="margin-top:0">Installed</h2>${mine.length ? `<div class="row">${mine.map(tile).join('')}</div>` : '<p class="meta">Nothing installed yet. Pick a game below.</p>'}
    ${others.length ? `<h2 class="sec">Not installed</h2><div class="row">${others.map(tile).join('')}</div>` : ''}`;
}
function viewGame(g) {
  const art = ART[g.id], meta = [], extra = [];
  if (g.installed) meta.push(`Installed <b>v${esc(g.version || '?')}</b>`);
  if (g.release?.version) meta.push(`Latest <b>v${esc(g.release.version)}</b>${g.release.size ? ' · ' + fmtSize(g.release.size) : ''}`);
  if (g.installed) extra.push(`<button class="ghost" data-act="folder" data-id="${g.id}">Open folder</button>`, `<button class="ghost" data-act="uninstall" data-id="${g.id}">Uninstall</button>`);
  if (g.local && S.info?.dev) extra.push(`<button class="ghost" data-act="local" data-id="${g.id}" title="${esc(g.local.path)}">Install build from this PC</button>`);
  return `<div style="--ga:${g.accent}"><div class="ghero" style="background-image:url('${art.hero}')"><div class="ghero-in"><img src="${art.icon}" alt="" /><div><div class="genre">${esc(g.genre)}</div><h1>${esc(g.name)}</h1><p>${esc(g.tagline)}</p></div></div></div>
    <div class="playbar">${playBtn(g)}<div class="meta">${meta.join('<br>')}</div><div style="margin-left:auto;display:flex;gap:8px;flex-wrap:wrap">${extra.join('')}</div></div>
    <div class="cols"><div><h2 class="sec">About</h2><p class="about">${esc(g.about)}</p><h2 class="sec">Screenshots</h2><div class="shots">${art.shots.map(s => `<div style="background-image:url('assets/games/${s}')"></div>`).join('')}</div></div>
      <div><h2 class="sec">Patch notes</h2><div class="card notes">${g.release?.version ? `<div class="ver">Version ${esc(g.release.version)}</div><div class="date">${esc(fmtDate(g.release.published))}</div>${notesHtml(g.release.notes) || '<p>No notes for this version.</p>'}` : '<p>Patch notes will appear here once the game is released.</p>'}</div></div></div></div>`;
}
function viewSettings() {
  return `<h1 class="page">Settings</h1><div class="set">
    <div class="item"><i class="avatar none">${initial(S.me?.id)}</i><div><b>${esc(S.me?.id || '')}</b><span>${esc(S.me?.email || '')}</span></div><button class="ghost" data-act="signout">Sign out</button></div>
    <div class="item"><div><b>Game library folder</b><span>${esc(S.info?.library || '')}</span></div><button class="ghost" data-act="library">Change…</button></div>
    <div class="item"><div><b>Account page</b><span>Change your name#TAG or password on the Camel Studios website.</span></div><button class="ghost" data-act="site">Open</button></div>
    <div class="item"><div><b>Camel Client</b><span>Version ${esc(S.info?.version || '')}</span></div></div></div>`;
}
function renderView() {
  const v = S.view, g = v.startsWith('game:') && game(v.slice(5));
  $('#view').innerHTML = g ? viewGame(g) : v === 'library' ? viewLibrary() : v === 'settings' ? viewSettings() : viewHome();
}
function render() { renderChrome(); renderView(); }

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
async function launch(g) {
  const r = await api.games.launch(g.id, Account.session());
  if (!r.ok) { toast(r.error, true); return; }
  g.running = true; Friends.setPresence('ingame', g.name);
  if (Party.leading) Party.set({ game: g.name });
  renderSocial(); render();
}
const sure = (el, text) => { if (el.dataset.sure === '1') return true; el.dataset.sure = '1'; el.classList.add('sure'); const old = el.title; el.title = text; setTimeout(() => { el.dataset.sure = ''; el.classList.remove('sure'); el.title = old; }, 3000); return false; };
async function act(name, id, el) {
  const g = id && game(id);
  try {
    if (name === 'main') { const st = status(g); if (st.key === 'play') launch(g); else if (st.key === 'install' || st.key === 'update') install(id, 'release'); else if (st.key === 'local') install(id, 'local'); }
    else if (name === 'local') install(id, 'local');
    else if (name === 'feature') { S.feature = +id; renderView(); }
    else if (name === 'folder') api.games.folder(id);
    else if (name === 'uninstall') {
      if (el.dataset.sure !== '1') { el.dataset.sure = '1'; el.textContent = 'Click again to uninstall'; setTimeout(() => { if (el.isConnected) { el.dataset.sure = ''; el.textContent = 'Uninstall'; } }, 3000); return; }
      const r = await api.games.uninstall(id); if (!r.ok) toast(r.error || 'Could not uninstall.', true); else toast(`${g.name} was uninstalled.`);
      await refresh();
    } else if (name === 'signout') await Account.signOut();
    else if (name === 'library') { S.info.library = await api.chooseLibrary(); await refresh(); }
    else if (name === 'site') api.open('https://camells1.github.io/account/');
    else if (name === 'social') { S.socialOpen = !S.socialOpen; localStorage.setItem('social', S.socialOpen ? '1' : '0'); renderChrome(); renderSocial(); }
    // friends
    else if (name === 'accept') await Friends.accept(id);
    else if (name === 'unfriend') { if (el.dataset.ask && !sure(el, 'Click again to remove')) return; await Friends.remove(id); }
    else if (name === 'chat') { S.chatWith = id; Chat.open(id); socialKey = ''; renderSocial(); }
    else if (name === 'chat-back') { S.chatWith = null; Chat.close(); socialKey = ''; renderSocial(); }
    // party
    else if (name === 'p-create') await Party.create();
    else if (name === 'p-invite') { await Party.invite(id, el.dataset.name); toast(`Invited ${el.dataset.name} to your party.`); }
    else if (name === 'p-accept') await Party.accept(id);
    else if (name === 'p-decline') await Party.decline(id);
    else if (name === 'p-leave') { if (!sure(el, Party.leading ? 'Click again to disband' : 'Click again to leave')) return; await Party.leave(); }
    else if (name === 'p-copy') { await navigator.clipboard.writeText(Party.party?.code || ''); toast('Room code copied.'); }
  } catch (e) { toast(nice(e), true); }
}
api.games.onProgress(p => { if (p.phase === 'done' || p.phase === 'error') return; S.progress[p.id] = p; render(); });
api.games.onExit(({ id }) => { const g = game(id); if (g) g.running = false; if (!S.games.some(x => x.running)) Friends.setPresence('online'); renderSocial(); render(); });

// ---------------------------------------------------------------- social panel: friends, chat, party
const X = '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>', OK = '<svg viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg>';
const MSG = '<svg viewBox="0 0 24 24"><path d="M4 6h16v10H9l-5 4z"/></svg>', PLUS = '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>', SEND = '<svg viewBox="0 0 24 24"><path d="M4 12l16-7-6 16-3-7z"/></svg>', BACK = '<svg viewBox="0 0 24 24"><path d="M14 6l-6 6 6 6"/></svg>';
const statusText = st => st.state === 'ingame' ? `Playing ${st.game || 'a game'}` : st.state === 'online' ? 'Online' : 'Offline';
function friendRow(f) {
  const st = Friends.statusOf(f.uid), unread = Chat.unread(f.uid), last = Chat.last.get(f.uid);
  const sub = unread ? esc(last.text.slice(0, 40)) : esc(statusText(st));
  return `<div class="fr ${st.state} ${unread ? 'unread' : ''}"><i class="avatar ${st.state}">${initial(f.id)}</i><div class="who"><b>${esc(f.id)}</b><span>${sub}</span></div><div class="acts">
    <button class="ib" data-act="chat" data-id="${esc(f.uid)}" title="Message">${MSG}</button><button class="ib" data-act="p-invite" data-id="${esc(f.uid)}" data-name="${esc(f.id)}" title="Invite to party">${PLUS}</button><button class="ib no" data-act="unfriend" data-ask="1" data-id="${esc(f.pair)}" title="Remove friend">${X}</button></div></div>`;
}
const bubbles = (list, names) => list.length ? list.map(m => `<div class="msg ${m.from === S.me.uid ? 'me' : ''}">${names && m.from !== S.me.uid ? `<small>${esc(names[m.from] || 'Player')}</small>` : ''}${esc(m.text)}</div>`).join('') : '<div class="empty">No messages yet. Say hi.</div>';
// The panel is only rebuilt when its layout changes, so text boxes keep what you're typing
let socialKey = '';
function shell(key, html) { if (socialKey === key) return false; socialKey = key; $('#social-body').innerHTML = html; return true; }
function fill(sel, html) { const el = $(sel); if (!el || el._html === html) return; el._html = html; el.innerHTML = html; if (el.classList.contains('msgs')) el.scrollTop = el.scrollHeight; }
function sendBox(id, send) {
  const inp = $(id + ' input'), go = () => { const v = inp.value; inp.value = ''; Promise.resolve(send(v)).catch(e => toast(nice(e), true)); };
  $(id + ' button').addEventListener('click', go); inp.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
}
function renderSocial() {
  $('#social').classList.toggle('hidden', !S.socialOpen);
  if (!S.me) return;
  $('#chip-name').textContent = S.me.id; $('#chip-avatar').textContent = (S.me.name[0] || '?').toUpperCase(); $('#chip-avatar').className = 'avatar ' + (S.games.some(g => g.running) ? 'ingame' : 'online');
  const friends = Friends.list.filter(f => f.status === 'accepted'), incoming = Friends.list.filter(f => f.incoming), outgoing = Friends.list.filter(f => f.status === 'pending' && !f.incoming);
  Chat.watch(friends.map(f => f.uid));
  const unread = friends.filter(f => Chat.unread(f.uid)).length, on = friends.filter(f => Friends.statusOf(f.uid).state !== 'offline'), off = friends.filter(f => Friends.statusOf(f.uid).state === 'offline');
  $('#b-friends').textContent = unread + incoming.length || ''; $('#b-party').textContent = Party.invites.length || '';
  $('#dock-count').textContent = unread + incoming.length + Party.invites.length || '';
  for (const b of $$('#social-tabs button')) b.classList.toggle('on', b.dataset.tab === S.tab);
  if (!S.socialOpen) return;

  if (S.tab === 'friends' && S.chatWith) {
    const f = friends.find(x => x.uid === S.chatWith);
    if (!f) { S.chatWith = null; Chat.close(); socialKey = ''; return renderSocial(); }
    const st = Friends.statusOf(f.uid);
    if (shell('chat:' + f.uid, `<div class="thread-head"><button class="ib" data-act="chat-back" title="Back">${BACK}</button><i class="avatar ${st.state}">${initial(f.id)}</i><div><b>${esc(f.id)}</b><span id="th-status"></span></div></div><div class="msgs" id="th-msgs"></div><div class="send" id="th-send"><input placeholder="Message ${esc(f.id.split('#')[0])}" maxlength="500" /><button title="Send">${SEND}</button></div>`)) { sendBox('#th-send', t => Chat.send(t)); $('#th-send input').focus(); }
    $('#th-status').textContent = statusText(st);
    fill('#th-msgs', Chat.error ? `<div class="empty">${esc(Chat.error)}</div>` : bubbles(Chat.messages));
  } else if (S.tab === 'friends') {
    shell('friends', '<div class="scroll" id="fr-list"></div>');
    fill('#fr-list', Friends.error ? `<div class="empty">${esc(Friends.error)}</div>` :
      (incoming.length ? `<div class="grp">Friend requests</div>${incoming.map(f => `<div class="fr req"><i class="avatar none">${initial(f.id)}</i><div class="who"><b>${esc(f.id)}</b><span>Wants to be friends</span></div><div class="acts"><button class="ib yes" data-act="accept" data-id="${esc(f.pair)}" title="Accept">${OK}</button><button class="ib no" data-act="unfriend" data-id="${esc(f.pair)}" title="Decline">${X}</button></div></div>`).join('')}` : '')
      + (on.length ? `<div class="grp">Online · ${on.length}</div>${on.map(friendRow).join('')}` : '') + (off.length ? `<div class="grp">Offline · ${off.length}</div>${off.map(friendRow).join('')}` : '')
      + (outgoing.length ? `<div class="grp">Sent requests</div>${outgoing.map(f => `<div class="fr req"><i class="avatar none">${initial(f.id)}</i><div class="who"><b>${esc(f.id)}</b><span>Waiting for them</span></div><div class="acts"><button class="ib no" data-act="unfriend" data-id="${esc(f.pair)}" title="Cancel">${X}</button></div></div>`).join('')}` : '')
      + (!friends.length && !incoming.length && !outgoing.length ? '<div class="empty">No friends yet.<br>Add one with their Name#TAG in the Add tab.</div>' : ''));
  } else if (S.tab === 'party') {
    const p = Party.party;
    if (!p) {
      shell('party:none', '<div class="scroll" id="pt-none"></div>');
      fill('#pt-none', `${Party.invites.map(i => `<div class="fr req"><i class="avatar none">${initial(i.ids?.[i.leader])}</i><div class="who"><b>${esc(i.ids?.[i.leader] || 'A friend')}</b><span>Invited you to a party</span></div><div class="acts"><button class="ib yes" data-act="p-accept" data-id="${esc(i.id)}" title="Join">${OK}</button><button class="ib no" data-act="p-decline" data-id="${esc(i.id)}" title="Decline">${X}</button></div></div>`).join('')}
        <div class="pad" style="padding-top:14px"><p>Play together: start a party, invite up to three friends, pick a game and share the room code. Everyone in the party gets a group chat.</p><button class="cta" data-act="p-create">Start a party</button></div>`);
    } else {
      if (shell('party:' + p.id, `<div class="slots" id="pt-slots"></div><div class="slot-names" id="pt-names"></div>
        <div class="prow"><label>Game</label><select id="pt-game"></select></div>
        <div class="prow"><label>Code</label><input id="pt-code" maxlength="12" placeholder="Room code from the host" spellcheck="false" /><button class="ib" data-act="p-copy" title="Copy the room code"><svg viewBox="0 0 24 24"><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M5 15V6a1 1 0 011-1h9"/></svg></button></div>
        <div class="msgs" id="pt-msgs"></div><div class="send" id="pt-send"><input placeholder="Message the party" maxlength="500" /><button title="Send">${SEND}</button></div>
        <div style="padding:0 10px 10px"><button class="ghost" style="width:100%" data-act="p-leave" id="pt-leave"></button></div>`)) {
        sendBox('#pt-send', t => Party.send(t));
        $('#pt-game').addEventListener('change', e => Party.set({ game: e.target.value }).catch(er => toast(nice(er), true)));
        $('#pt-code').addEventListener('change', e => Party.set({ code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12) }).catch(er => toast(nice(er), true)));
      }
      const slots = [...p.members.map(u => ({ u, full: true })), ...p.invited.map(u => ({ u, wait: true }))];
      fill('#pt-slots', Array.from({ length: 4 }, (_, i) => { const s = slots[i]; return s ? `<div class="slot ${s.full ? 'full' : 'full wait'} ${s.u === p.leader ? 'lead' : ''}" title="${esc(p.ids?.[s.u] || '')}${s.wait ? ' (invited)' : ''}">${initial(p.ids?.[s.u])}</div>` : '<div class="slot">+</div>'; }).join(''));
      fill('#pt-names', `${p.members.map(u => esc(p.ids?.[u] || 'Player')).join(', ')}${p.invited.length ? ` · invited: ${p.invited.map(u => esc(p.ids?.[u] || 'Player')).join(', ')}` : ''}`);
      const sel = $('#pt-game'), opts = `<option value="">No game picked</option>${S.games.map(g => `<option ${p.game === g.name ? 'selected' : ''}>${esc(g.name)}</option>`).join('')}`;
      if (sel._html !== opts) { sel._html = opts; sel.innerHTML = opts; } sel.disabled = !Party.leading;
      const code = $('#pt-code'); if (document.activeElement !== code && code.value !== (p.code || '')) code.value = p.code || '';
      fill('#pt-msgs', bubbles(Party.messages, p.ids));
      $('#pt-leave').textContent = Party.leading ? 'Disband party' : 'Leave party';
    }
  } else if (shell('add', `<div class="pad"><p>Add a friend with their Camel ID.</p><input id="add-id" placeholder="Name#TAG" maxlength="20" spellcheck="false" /><button class="cta" id="add-go">Send request</button><p class="res" id="add-res"></p><p>Your ID</p><div class="myid">${esc(S.me.id)}</div></div>`)) {
    const go = async () => { const res = $('#add-res'); res.className = 'res'; res.textContent = ''; try { res.textContent = await Friends.add($('#add-id').value); res.classList.add('ok'); $('#add-id').value = ''; } catch (e) { res.textContent = nice(e); } };
    $('#add-go').addEventListener('click', go); $('#add-id').addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
  }
}
for (const b of $$('#social-tabs button')) b.addEventListener('click', () => { S.tab = b.dataset.tab; renderSocial(); });
// A party invite or a new message from a friend: say so even if the panel is on another tab
let seenInvites = 0;
Friends.onChange = renderSocial; Chat.onChange = renderSocial;
Party.onChange = () => { if (Party.invites.length > seenInvites) toast('You have a party invite.'); seenInvites = Party.invites.length; renderSocial(); };

// ---------------------------------------------------------------- start
Account.onChange = user => {
  S.me = user;
  $('#login').classList.toggle('hidden', !!user); $('#app').classList.toggle('hidden', !user); $('#tabs').classList.toggle('hidden', !user); $('#chip').classList.toggle('hidden', !user);
  if (user) { S.view = 'home'; socialKey = ''; render(); renderSocial(); } else { showForm(false); rotateArt(); }
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
// The client updates itself: a button appears in the top bar when a new version is out
async function checkUpdate() {
  const u = await api.update.check(); if (!u) return;
  const b = $('#update'); b.textContent = `Update to ${u.version}`; b.classList.remove('hidden');
}
$('#update').addEventListener('click', async e => {
  const b = e.currentTarget; b.disabled = true; b.textContent = 'Updating…';
  const r = await api.update.apply();
  if (!r.ok) { toast(r.error, true); b.disabled = false; b.textContent = 'Try update again'; }
});
api.update.onProgress(p => { $('#update').textContent = `Updating ${Math.round(p * 100)}%`; });
checkUpdate(); setInterval(checkUpdate, 30 * 60 * 1000);
window.__cc = { S, Account, Friends, Chat, Party, nav, refresh, renderSocial };

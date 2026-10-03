// Camel Studios accounts (Firebase): sign in, create an account with a unique name#TAG,
// friends and who's online. The same accounts the website and the games use.
import { initializeApp } from '../vendor/firebase/firebase-app.js';
import { clean, ok } from './filter.js';
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile,
  sendPasswordResetEmail, signOut, setPersistence, browserLocalPersistence, browserSessionPersistence
} from '../vendor/firebase/firebase-auth.js';
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, writeBatch, serverTimestamp, collection, query, where, orderBy, limitToLast, onSnapshot, arrayUnion, arrayRemove
} from '../vendor/firebase/firebase-firestore.js';

// Public web config (safe to ship: access is controlled by Firebase Auth and the Firestore rules)
const app = initializeApp({
  apiKey: 'AIzaSyAgEzMO9dzwwHr-iyvDhRho-DY1-gg9os4',
  authDomain: 'riftline-f4af8.firebaseapp.com',
  projectId: 'riftline-f4af8',
  storageBucket: 'riftline-f4af8.firebasestorage.app',
  messagingSenderId: '393303739849',
  appId: '1:393303739849:web:cd9b1b2e0cb1725a512c18'
});
const auth = getAuth(app), db = getFirestore(app);

export const cleanName = n => String(n || '').replace(/[^\p{L}\p{N} _.-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 14);
export const cleanTag = t => String(t || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
export const randomTag = () => Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
const splitId = dn => { const i = (dn || '').lastIndexOf('#'); return i > 0 ? [dn.slice(0, i), dn.slice(i + 1)] : [dn || '', '']; };
const keyOf = (name, tag) => name.toLowerCase() + '#' + tag;
const TAKEN = 'That name#TAG is already taken. Try a different tag.';
export const nice = e => ({
  'auth/invalid-credential': 'Wrong email or password.', 'auth/wrong-password': 'Wrong email or password.', 'auth/user-not-found': 'No account with that email.',
  'auth/email-already-in-use': 'That email already has an account. Sign in instead.', 'auth/weak-password': 'Password needs at least 6 characters.',
  'auth/invalid-email': 'That email address looks wrong.', 'auth/missing-password': 'Type your password.', 'auth/too-many-requests': 'Too many tries. Wait a minute and try again.',
  'auth/network-request-failed': 'No connection. Check your internet.', 'id-taken': TAKEN,
  'permission-denied': "The account service isn't fully set up yet (database rules). Try again in a minute.",
  'unavailable': 'No connection. Check your internet.'
}[e?.code] || e?.message || String(e));

// ids/{name#TAG} can exist only once: that's what makes an ID unique
async function claim(user, name, tag) {
  const key = keyOf(name, tag);
  const snap = await getDoc(doc(db, 'ids', key)), owner = snap.exists() ? snap.data().uid : null;
  if (owner && owner !== user.uid) throw Object.assign(new Error(TAKEN), { code: 'id-taken' });
  if (!owner) {
    const mine = await getDoc(doc(db, 'users', user.uid)), old = mine.exists() ? mine.data().id : null;
    const b = writeBatch(db);
    b.set(doc(db, 'ids', key), { uid: user.uid, name, tag, at: serverTimestamp() });
    if (old && old !== key) b.delete(doc(db, 'ids', old));
    b.set(doc(db, 'users', user.uid), { id: key });
    await b.commit();
  }
  await updateProfile(user, { displayName: `${name}#${tag}` });
}

export const Account = {
  user: null,            // { uid, email, name, tag, id }
  onChange: null,        // (user | null) once we know who is signed in, and on every change
  ready: false,

  start() {
    onAuthStateChanged(auth, async u => {
      if (!u) { this.user = null; this.ready = true; Friends.stop(); Chat.stop(); Party.stop(); this.onChange?.(null); return; }
      const [name, tag] = splitId(u.displayName);
      this.user = { uid: u.uid, email: u.email, name: name || 'Player', tag: tag || '', id: name && tag ? `${name}#${tag}` : (u.email || 'Player') };
      this.ready = true;
      this.onChange?.(this.user);
      // Accounts made before IDs were unique: register theirs the first time we see them
      if (name && tag) { try { const mine = await getDoc(doc(db, 'users', u.uid)); if (!mine.exists() || mine.data().id !== keyOf(name, tag)) await claim(u, name, tag); } catch (_) {} }
      Friends.start(this.user); Chat.start(this.user); Party.start(this.user);
    });
  },
  async signIn(email, password, stay) {
    await setPersistence(auth, stay ? browserLocalPersistence : browserSessionPersistence);
    await signInWithEmailAndPassword(auth, email.trim(), password);
  },
  async signUp(email, password, name, tag, stay) {
    name = cleanName(name); tag = cleanTag(tag) || randomTag();
    if (name.length < 3) throw new Error('Your name needs at least 3 characters.');
    if (tag.length < 3) throw new Error('Your tag needs 3 to 5 letters or numbers.');
    if (!ok(name) || !ok(tag)) throw new Error("Pick a different name or tag: that one isn't allowed.");
    // Check the ID first so we don't create an account that then has no name
    const taken = await getDoc(doc(db, 'ids', keyOf(name, tag)));
    if (taken.exists()) throw Object.assign(new Error(TAKEN), { code: 'id-taken' });
    await setPersistence(auth, stay ? browserLocalPersistence : browserSessionPersistence);
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    await claim(cred.user, name, tag);
    const [n, t] = splitId(cred.user.displayName);
    this.user = { uid: cred.user.uid, email: cred.user.email, name: n, tag: t, id: `${n}#${t}` };
    this.onChange?.(this.user);
    Friends.start(this.user);
  },
  reset: email => sendPasswordResetEmail(auth, email.trim()),
  async signOut() { await Friends.setPresence('offline'); Friends.stop(); Chat.stop(); Party.stop(); await signOut(auth); },
  // What a game needs to sign the player in by itself
  session() { const u = auth.currentUser; return u && this.user ? { uid: u.uid, email: u.email, name: this.user.name, tag: this.user.tag, refreshToken: u.refreshToken } : null; }
};

// ---------------------------------------------------------------- friends and presence
const ONLINE_FOR = 150000; // a friend counts as online if they checked in within 2.5 minutes
export const Friends = {
  me: null, list: [], presence: new Map(), error: '', onChange: null,
  _unsub: null, _presUnsubs: new Map(), _beat: null, _state: 'online', _game: '',

  start(me) {
    if (this.me?.uid === me.uid) return;
    this.stop(); this.me = me;
    const q = query(collection(db, 'friends'), where('users', 'array-contains', me.uid));
    this._unsub = onSnapshot(q, snap => {
      this.error = '';
      this.list = snap.docs.map(d => {
        const x = d.data(), other = x.users.find(u => u !== me.uid);
        return { pair: d.id, uid: other, id: clean(x.ids?.[other] || 'Player'), status: x.status, incoming: x.status === 'pending' && x.from !== me.uid };
      });
      // Watch whether each friend is online
      const want = new Set(this.list.filter(f => f.status === 'accepted').map(f => f.uid));
      for (const [uid, un] of this._presUnsubs) if (!want.has(uid)) { un(); this._presUnsubs.delete(uid); this.presence.delete(uid); }
      for (const uid of want) if (!this._presUnsubs.has(uid)) {
        this._presUnsubs.set(uid, onSnapshot(doc(db, 'presence', uid), s => { this.presence.set(uid, s.exists() ? s.data() : null); this.onChange?.(); }, () => {}));
      }
      this.onChange?.();
    }, e => { this.error = e.code === 'permission-denied' ? "Friends aren't switched on yet (the database rules need publishing)." : nice(e); this.onChange?.(); });
    this.setPresence('online');
    this._beat = setInterval(() => { this.setPresence(this._state, this._game); this.onChange?.(); }, 60000);
  },
  stop() {
    this._unsub?.(); this._unsub = null;
    for (const un of this._presUnsubs.values()) un();
    this._presUnsubs.clear(); this.presence.clear(); this.list = []; this.me = null;
    clearInterval(this._beat);
  },
  async setPresence(state, game = '') {
    if (!this.me) return;
    this._state = state; this._game = game;
    try { await setDoc(doc(db, 'presence', this.me.uid), { id: this.me.id, state, game, at: serverTimestamp() }); } catch (_) {}
  },
  // 'online' | 'ingame' | 'offline', plus the game they're in
  statusOf(uid) {
    const p = this.presence.get(uid);
    if (!p || p.state === 'offline') return { state: 'offline' };
    const at = p.at?.toMillis ? p.at.toMillis() : Date.now();
    if (Date.now() - at > ONLINE_FOR) return { state: 'offline' };
    return { state: p.state === 'ingame' ? 'ingame' : 'online', game: p.game || '' };
  },
  async add(idText) {
    const [rawName, rawTag] = splitId(String(idText || '').trim());
    const name = cleanName(rawName), tag = cleanTag(rawTag);
    if (!name || !tag) throw new Error('Type their full ID, like Name#TAG.');
    const snap = await getDoc(doc(db, 'ids', keyOf(name, tag)));
    if (!snap.exists()) throw new Error(`No player called ${name}#${tag}.`);
    const other = snap.data().uid, theirId = `${snap.data().name}#${snap.data().tag}`;
    if (other === this.me.uid) throw new Error("That's you.");
    const have = this.list.find(f => f.uid === other);
    if (have?.status === 'accepted') throw new Error(`You and ${theirId} are already friends.`);
    if (have?.incoming) { await this.accept(have.pair); return `You and ${theirId} are now friends.`; }
    if (have) throw new Error(`You already asked ${theirId}.`);
    const users = [this.me.uid, other].sort();
    await setDoc(doc(db, 'friends', users.join('_')), { users, from: this.me.uid, status: 'pending', ids: { [this.me.uid]: this.me.id, [other]: theirId }, at: serverTimestamp() });
    return `Friend request sent to ${theirId}.`;
  },
  accept: pair => updateDoc(doc(db, 'friends', pair), { status: 'accepted' }),
  remove: pair => deleteDoc(doc(db, 'friends', pair))
};

// ---------------------------------------------------------------- chat with a friend
const pairOf = (a, b) => [a, b].sort().join('_');
const cleanText = t => clean(String(t || '').replace(/\s+/g, ' ').trim().slice(0, 500));
const msgOf = d => { const x = d.data(); return { id: d.id, from: x.from, text: clean(x.text), at: x.at?.toMillis ? x.at.toMillis() : Date.now() }; };
export const Chat = {
  me: null, uid: null, messages: [], last: new Map(), onChange: null, _unsub: null, _watch: new Map(),
  start(me) { this.me = me; },
  stop() { this.close(); for (const un of this._watch.values()) un(); this._watch.clear(); this.last.clear(); this.me = null; },
  // Watch the newest message from each friend so the list can show an unread dot
  watch(uids) {
    if (!this.me) return;
    for (const [uid, un] of this._watch) if (!uids.includes(uid)) { un(); this._watch.delete(uid); this.last.delete(uid); }
    for (const uid of uids) if (!this._watch.has(uid)) {
      const q = query(collection(db, 'chats', pairOf(this.me.uid, uid), 'messages'), orderBy('at'), limitToLast(1));
      this._watch.set(uid, onSnapshot(q, s => { const m = s.docs[0] && msgOf(s.docs[0]); if (m) { this.last.set(uid, m); this.onChange?.(); } }, () => {}));
    }
  },
  unread(uid) { const m = this.last.get(uid); return !!m && m.from !== this.me?.uid && m.at > +(localStorage.getItem('read:' + uid) || 0) && this.uid !== uid; },
  open(uid) {
    this.close(); this.uid = uid; this.messages = [];
    const q = query(collection(db, 'chats', pairOf(this.me.uid, uid), 'messages'), orderBy('at'), limitToLast(60));
    this._unsub = onSnapshot(q, s => { this.messages = s.docs.map(msgOf); localStorage.setItem('read:' + uid, String(Date.now())); this.onChange?.(); }, e => { this.error = nice(e); this.onChange?.(); });
  },
  close() { this._unsub?.(); this._unsub = null; this.uid = null; this.messages = []; this.error = ''; },
  send(text) { text = cleanText(text); if (!text || !this.uid) return; return addDoc(collection(db, 'chats', pairOf(this.me.uid, this.uid), 'messages'), { from: this.me.uid, text, at: serverTimestamp() }); }
};

// ---------------------------------------------------------------- parties (up to 4)
// One party at a time. The leader invites friends, picks the game and shares the room code;
// everyone in the party gets a group chat.
export const Party = {
  me: null, party: null, invites: [], messages: [], onChange: null, _subs: [], _msgUnsub: null,
  start(me) {
    this.stop(); this.me = me;
    const col = collection(db, 'parties'), shape = d => ({ id: d.id, ...d.data() });
    this._subs.push(onSnapshot(query(col, where('members', 'array-contains', me.uid)), s => {
      const p = s.docs.map(shape)[0] || null, changed = p?.id !== this.party?.id;
      this.party = p;
      if (changed) { this._msgUnsub?.(); this._msgUnsub = null; this.messages = []; if (p) this._msgUnsub = onSnapshot(query(collection(db, 'parties', p.id, 'messages'), orderBy('at'), limitToLast(60)), m => { this.messages = m.docs.map(msgOf); this.onChange?.(); }, () => {}); }
      this.onChange?.();
    }, () => {}));
    this._subs.push(onSnapshot(query(col, where('invited', 'array-contains', me.uid)), s => { this.invites = s.docs.map(shape); this.onChange?.(); }, () => {}));
  },
  stop() { for (const un of this._subs) un(); this._subs = []; this._msgUnsub?.(); this._msgUnsub = null; this.party = null; this.invites = []; this.messages = []; this.me = null; },
  get leading() { return !!this.party && this.party.leader === this.me?.uid; },
  async create() {
    if (this.party) return;
    await addDoc(collection(db, 'parties'), { leader: this.me.uid, members: [this.me.uid], invited: [], ids: { [this.me.uid]: this.me.id }, game: '', code: '', at: serverTimestamp() });
  },
  async invite(uid, id) {
    if (!this.party) await this.create();
    for (let i = 0; i < 20 && !this.party; i++) await new Promise(r => setTimeout(r, 150));
    const p = this.party; if (!p) throw new Error('Could not start a party.');
    if (p.members.includes(uid)) throw new Error('They are already in your party.');
    if (p.members.length + p.invited.length >= 4) throw new Error('A party holds 4 players.');
    await updateDoc(doc(db, 'parties', p.id), { invited: arrayUnion(uid), ['ids.' + uid]: id });
  },
  async accept(partyId) {
    if (this.party) await this.leave();
    await updateDoc(doc(db, 'parties', partyId), { members: arrayUnion(this.me.uid), invited: arrayRemove(this.me.uid), ['ids.' + this.me.uid]: this.me.id });
  },
  decline: function (partyId) { return updateDoc(doc(db, 'parties', partyId), { invited: arrayRemove(this.me.uid) }); },
  async leave() {
    const p = this.party; if (!p) return;
    if (p.leader === this.me.uid) await deleteDoc(doc(db, 'parties', p.id));
    else await updateDoc(doc(db, 'parties', p.id), { members: arrayRemove(this.me.uid) });
  },
  set(fields) { if (this.party) return updateDoc(doc(db, 'parties', this.party.id), fields); },
  send(text) { text = cleanText(text); if (!text || !this.party) return; return addDoc(collection(db, 'parties', this.party.id, 'messages'), { from: this.me.uid, text, at: serverTimestamp() }); }
};

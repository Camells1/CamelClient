// Camel Studios accounts (Firebase): sign in, create an account with a unique name#TAG,
// friends and who's online. The same accounts the website and the games use.
import { initializeApp } from '../vendor/firebase/firebase-app.js';
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile,
  sendPasswordResetEmail, signOut, setPersistence, browserLocalPersistence, browserSessionPersistence
} from '../vendor/firebase/firebase-auth.js';
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, writeBatch, serverTimestamp, collection, query, where, onSnapshot
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
      if (!u) { this.user = null; this.ready = true; Friends.stop(); this.onChange?.(null); return; }
      const [name, tag] = splitId(u.displayName);
      this.user = { uid: u.uid, email: u.email, name: name || 'Player', tag: tag || '', id: name && tag ? `${name}#${tag}` : (u.email || 'Player') };
      this.ready = true;
      this.onChange?.(this.user);
      // Accounts made before IDs were unique: register theirs the first time we see them
      if (name && tag) { try { const mine = await getDoc(doc(db, 'users', u.uid)); if (!mine.exists() || mine.data().id !== keyOf(name, tag)) await claim(u, name, tag); } catch (_) {} }
      Friends.start(this.user);
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
  async signOut() { await Friends.setPresence('offline'); Friends.stop(); await signOut(auth); },
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
        return { pair: d.id, uid: other, id: x.ids?.[other] || 'Player', status: x.status, incoming: x.status === 'pending' && x.from !== me.uid };
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

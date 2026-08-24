// js/identity.js
// Auth + dados via Firebase (RTDB). Tudo online e em tempo real.
// Admin é checado via /admins/{uid} no RTDB (nada hardcoded).

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getDatabase, ref, onValue, set, update, remove, get, runTransaction } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyAziFdP1iU_1Dw_etjM40YX91x4HFHFRaU",
  authDomain: "counter-itz-5a08b.firebaseapp.com",
  databaseURL: "https://counter-itz-5a08b-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "counter-itz-5a08b",
  storageBucket: "counter-itz-5a08b.firebasestorage.app",
  messagingSenderId: "848663837161",
  appId: "1:848663837161:web:5003ec4eab7bf5d02d3378"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const auth = getAuth(app);

// ---- Estado ----
let currentUser = null;
let currentUid = null;
let playerData = null;
let playersCache = {};
let bannedCache = [];
let mixesCache = {};
let listenersReady = false;
let authReady = false; // virou true depois do primeiro onAuthStateChanged

const subs = new Set();
const notify = () => { for (const cb of subs) { try { cb(); } catch (e) { console.error(e); } } };
export function subscribe(cb) { subs.add(cb); return () => subs.delete(cb); }

// ---- Info do usuário ----
export function getUid() { return currentUid; }
export function getEmail() { return currentUser?.email || ""; }
export function isLoggedIn() { return !!currentUser; }
export function isAuthReady() { return authReady; }

export function getPlayer() {
  if (!playerData || !currentUid) return null;
  return {
    uid: currentUid,
    nick: playerData.nick || "",
    email: playerData.email || getEmail(),
    level: playerData.level ?? 1000,
    nickChanged: !!playerData.nickChanged
  };
}

export function getAllPlayers() {
  const list = [];
  for (const [uid, p] of Object.entries(playersCache)) {
    if (!p?.nick) continue;
    list.push({
      uid,
      nick: p.nick,
      level: p.level ?? 1000,
      banned: bannedCache.includes(p.nick)
    });
  }
  list.sort((a, b) => b.level - a.level);
  return list;
}

export function getPlayerByNick(nick) {
  for (const [uid, p] of Object.entries(playersCache)) {
    if (p?.nick === nick) return { uid, ...p };
  }
  return null;
}

// ---- Auth ----
export async function registerUser(email, password) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function loginUser(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function logoutUser() {
  await signOut(auth);
}

// Cria perfil do player no banco se não existir
async function ensurePlayerProfile(user) {
  const refP = ref(db, `players/${user.uid}`);
  const snap = await get(refP);
  if (snap.exists()) {
    playerData = snap.val();
    return;
  }
  // Nick padrão = parte do email antes do @
  const defaultNick = (user.email || "player").split("@")[0].replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 24) || "player";
  playerData = {
    email: user.email,
    nick: defaultNick,
    level: 1000,
    nickChanged: false,
    createdAt: Date.now()
  };
  await set(refP, playerData);
}

// Player escolhe o próprio level (1k a 30k)
export async function setMyLevel(level) {
  if (!currentUid) throw new Error("Não estás logado");
  const v = Math.max(1000, Math.min(30000, Math.floor(Number(level) || 1000)));
  await update(ref(db, `players/${currentUid}`), { level: v });
  if (playerData) playerData.level = v;
  return v;
}

// Trocar nick (apenas 1 vez por conta)
export async function changeNick(newNick) {
  if (!currentUid) throw new Error("Não estás logado");
  const p = getPlayer();
  if (!p) throw new Error("Perfil não carregado");
  if (p.nickChanged) throw new Error("Já trocaste teu nick. Não dá pra trocar de novo.");

  const clean = (newNick || "").trim();
  if (clean.length < 2) throw new Error("Nick muito curto (mínimo 2 letras)");
  if (clean.length > 24) throw new Error("Nick muito longo (máximo 24)");

  // Não permite duplicado
  const existing = getPlayerByNick(clean);
  if (existing && existing.uid !== currentUid) {
    throw new Error("Esse nick já tá em uso por outra pessoa");
  }

  await update(ref(db, `players/${currentUid}`), {
    nick: clean,
    nickChanged: true
  });
  playerData.nick = clean;
  playerData.nickChanged = true;
}

// ---- Ban (lista simples baseada em nicks) ----
export function getBannedNicks() { return [...bannedCache]; }
export function isBanned(nick) { return bannedCache.includes(nick); }

// ---- Admin ----
let adminCache = {}; // { uid: true }

export function isAdmin() {
  return !!currentUid && !!adminCache[currentUid];
}

export async function adminResetNick(uid) {
  if (!isAdmin()) throw new Error("Sem permissão de admin");
  if (!uid) throw new Error("UID inválido");
  await update(ref(db, `players/${uid}`), {
    nickChanged: false
  });
}

export async function adminSetLevel(uid, level) {
  if (!isAdmin()) throw new Error("Sem permissão de admin");
  if (!uid) throw new Error("UID inválido");
  const v = Math.max(1000, Math.min(30000, Math.floor(Number(level) || 1000)));
  await update(ref(db, `players/${uid}`), { level: v });
}

export async function adminSetNick(uid, newNick) {
  if (!isAdmin()) throw new Error("Sem permissão de admin");
  if (!uid) throw new Error("UID inválido");
  const clean = (newNick || "").trim();
  if (clean.length < 2) throw new Error("Nick muito curto");
  if (clean.length > 24) throw new Error("Nick muito longo");
  await update(ref(db, `players/${uid}`), { nick: clean });
}

export async function adminBanNick(nick) {
  if (!isAdmin()) throw new Error("Sem permissão de admin");
  if (!nick) throw new Error("Nick inválido");
  if (bannedCache.includes(nick)) return;
  await set(ref(db, `banned/${bannedCache.length}`), nick);
}

export async function adminUnbanNick(nick) {
  if (!isAdmin()) throw new Error("Sem permissão de admin");
  if (!nick) throw new Error("Nick inválido");
  const idx = bannedCache.indexOf(nick);
  if (idx === -1) return;
  const updates = {};
  updates[`banned/${idx}`] = null;
  // Reordenar array pra não ficar com buracos
  const remaining = bannedCache.filter((n) => n !== nick);
  updates["banned"] = remaining.length ? remaining : null;
  await update(ref(db, ""), updates);
}

export async function adminForceRollover() {
  if (!isAdmin()) throw new Error("Sem permissão de admin");
  await runRolloverLogic();
}

export async function runAutomaticRollover() {
  if (!isAdmin()) throw new Error("Sem permissão de admin");
  if (!isRolloverNeeded()) return;
  await runRolloverLogic();
}

export function isRolloverNeeded() {
  const lastRollover = mixesCache?.meta?.lastRollover || null;
  const today = formatDateKey(new Date());
  return !lastRollover || lastRollover < today;
}

async function runRolloverLogic() {
  const today = formatDateKey(new Date());
  const updates = {};
  const dayKeys = Object.keys(mixesCache).filter((k) => k < today);
  for (const dateKey of dayKeys) {
    const data = mixesCache[dateKey];
    if (!data) continue;
    const slots = data.slots || {};
    const complete = data.complete || {};
    const totalFilled = Object.values(slots).filter(Boolean).length;
    if (totalFilled >= 10) {
      updates[`history/${dateKey}`] = {
        type: data.type || "online",
        slots,
        complete,
        closedAt: Date.now(),
        forcedByAdmin: true
      };
    }
    updates[`mixes/${dateKey}`] = null;
  }
  updates["meta/lastRollover"] = today;
  await update(ref(db, ""), updates);
}

function formatDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getAllPlayersDetailed() {
  const list = [];
  for (const [uid, p] of Object.entries(playersCache)) {
    if (!p?.nick) continue;
    list.push({
      uid,
      nick: p.nick,
      email: p.email || "",
      level: p.level ?? 1000,
      nickChanged: !!p.nickChanged,
      banned: bannedCache.includes(p.nick),
      createdAt: p.createdAt || 0
    });
  }
  list.sort((a, b) => b.level - a.level);
  return list;
}

// ---- Mixes ----
export function getMix(dateKey) {
  return mixesCache[dateKey] || { type: "none", slots: {}, complete: {} };
}
export function countSlots(dateKey) {
  const d = mixesCache[dateKey];
  return d?.slots ? Object.values(d.slots).filter(Boolean).length : 0;
}
export function countComplete(dateKey) {
  const d = mixesCache[dateKey];
  return d?.complete ? Object.values(d.complete).filter(Boolean).length : 0;
}

export async function setMixType(dateKey, type) {
  if (!currentUid) throw new Error("Faça login primeiro");
  await update(ref(db, `mixes/${dateKey}`), { type });
}

export async function joinSlot(dateKey, slot, nick) {
  if (!currentUid) throw new Error("Faça login primeiro");
  if (isBanned(nick)) throw new Error("Estás banido");
  await runTransaction(ref(db, `mixes/${dateKey}/slots/${slot}`), (current) => {
    if (current && current !== nick) throw new Error("Esse slot já tá ocupado");
    return nick;
  });
}

export async function leaveSlot(dateKey, slot, nick) {
  if (!currentUid) throw new Error("Faça login primeiro");
  const snap = await get(ref(db, `mixes/${dateKey}/slots/${slot}`));
  if (snap.val() === nick) await remove(ref(db, `mixes/${dateKey}/slots/${slot}`));
}

export async function joinComplete(dateKey, slot, nick) {
  if (!currentUid) throw new Error("Faça login primeiro");
  if (isBanned(nick)) throw new Error("Estás banido");
  await runTransaction(ref(db, `mixes/${dateKey}/complete/${slot}`), (current) => {
    if (current && current !== nick) throw new Error("Esse complete já tá ocupado");
    return nick;
  });
}

export async function leaveComplete(dateKey, slot, nick) {
  if (!currentUid) throw new Error("Faça login primeiro");
  const snap = await get(ref(db, `mixes/${dateKey}/complete/${slot}`));
  if (snap.val() === nick) await remove(ref(db, `mixes/${dateKey}/complete/${slot}`));
}

// ---- Cores / formatação de level ----
export function getLevelColor(level) {
  const stops = [
    { at: 1000, c: "#38bdf8" },
    { at: 5000, c: "#22c55e" },
    { at: 10000, c: "#eab308" },
    { at: 15000, c: "#ec4899" },
    { at: 20000, c: "#a855f7" },
    { at: 25000, c: "#ef4444" },
    { at: 30000, c: "#f59e0b" }
  ];
  if (level <= 1000) return stops[0].c;
  if (level >= 30000) return stops[stops.length - 1].c;
  for (let i = 0; i < stops.length - 1; i++) {
    if (level >= stops[i].at && level <= stops[i + 1].at) {
      const r = (level - stops[i].at) / (stops[i + 1].at - stops[i].at);
      return mix(stops[i].c, stops[i + 1].c, r);
    }
  }
  return stops[stops.length - 1].c;
}
function mix(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const r = Math.round(((pa >> 16) & 255) + (((pb >> 16) & 255) - ((pa >> 16) & 255)) * t);
  const g = Math.round(((pa >> 8) & 255) + (((pb >> 8) & 255) - ((pa >> 8) & 255)) * t);
  const bl = Math.round((pa & 255) + ((pb & 255) - (pa & 255)) * t);
  return `#${((r << 16) | (g << 8) | bl).toString(16).padStart(6, "0")}`;
}
export function formatLevel(level) {
  if (level >= 1000) return `${(level / 1000).toFixed(level % 1000 === 0 ? 0 : 1)}k`;
  return String(level);
}

// ---- Listeners do banco ----
function startListeners() {
  if (listenersReady) return;
  listenersReady = true;
  onValue(ref(db, "players"), (s) => { playersCache = s.val() || {}; notify(); });
  onValue(ref(db, "banned"), (s) => { bannedCache = s.val() || []; notify(); });
  onValue(ref(db, "mixes"), (s) => { mixesCache = s.val() || {}; notify(); });
  onValue(ref(db, "admins"), (s) => { adminCache = s.val() || {}; notify(); });
}

// ---- Auth state ----
onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  currentUid = user ? user.uid : null;
  authReady = true;

  // Listeners RTDB rodam SEMPRE (logado ou não) — assim visitantes veem os mixes
  startListeners();

  if (user) {
    try {
      await ensurePlayerProfile(user);
    } catch (e) {
      console.error("Erro ao carregar perfil:", e);
    }
  } else {
    playerData = null;
  }
  notify();
});

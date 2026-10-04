import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App & Firestore Database
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    username?: string | null;
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
  username?: string | null
) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      username: username || getActiveRacerSession()?.username || 'guest',
    },
    operationType,
    path,
  };
  console.warn('Firestore Operation Notice: ', JSON.stringify(errInfo));
  return new Error(JSON.stringify(errInfo));
}

// Test connection on boot
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client is offline or initializing.');
    }
    return false;
  }
}

// -------------------------------------------------------------
// CUSTOM RACER AUTHENTICATION ENGINE (NAME + PASSWORD ON FIREBASE)
// -------------------------------------------------------------

export interface RacerAccount {
  username: string;
  displayName: string;
  passwordHash: string;
  createdAt: string;
  lastLoginAt: string;
}

export interface ActiveRacerSession {
  username: string;
  displayName: string;
  loggedInAt: string;
}

export interface AuthResponse {
  success: boolean;
  session: ActiveRacerSession | null;
  garage?: UserGarageData;
  error?: string;
}

const SESSION_KEY = 'sup_nitro_active_racer_session';
const LOCAL_ACCOUNTS_VAULT = 'sup_nitro_accounts_vault';
const LOCAL_STORAGE_GARAGE_PREFIX = 'sup_nitro_garage_';
const LEGACY_STORAGE_KEY = 'sup_nitro_user_garage';

/**
 * Standard SHA-256 password hashing using native browser Web Crypto API
 */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Normalize username for database key (lowercase, alphanumeric + underscore)
 */
export function normalizeUsername(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
}

/**
 * Get the currently logged-in racer session
 */
export function getActiveRacerSession(): ActiveRacerSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) {
      return JSON.parse(raw) as ActiveRacerSession;
    }
  } catch (e) {
    console.warn('Failed to parse active session', e);
  }
  return null;
}

/**
 * Store the active racer session
 */
export function setActiveRacerSession(session: ActiveRacerSession | null) {
  try {
    if (session) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(SESSION_KEY);
    }
  } catch (e) {
    console.warn('Failed to set active session', e);
  }
}

/**
 * Helper to cache account locally for offline resilience
 */
function cacheAccountLocally(account: RacerAccount) {
  try {
    const raw = localStorage.getItem(LOCAL_ACCOUNTS_VAULT);
    const vault: Record<string, RacerAccount> = raw ? JSON.parse(raw) : {};
    vault[account.username] = account;
    localStorage.setItem(LOCAL_ACCOUNTS_VAULT, JSON.stringify(vault));
  } catch (e) {
    console.warn('Failed to cache account locally', e);
  }
}

function getLocalCachedAccount(username: string): RacerAccount | null {
  try {
    const raw = localStorage.getItem(LOCAL_ACCOUNTS_VAULT);
    if (raw) {
      const vault: Record<string, RacerAccount> = JSON.parse(raw);
      return vault[username] || null;
    }
  } catch {}
  return null;
}

// -------------------------------------------------------------
// USER GARAGE DATA STRUCTURE & DEFAULTS
// -------------------------------------------------------------

export interface UserGarageData {
  displayName: string;
  username?: string;
  coins: number;
  activeCarId: string;
  unlockedCars: string[];
  upgrades: {
    [carId: string]: {
      topSpeed: number; // 1 to 5
      acceleration: number; // 1 to 5
      heavyArmor: number; // 1 to 5
      nitroDuration: number; // 1 to 5
      nitroPower: number; // 1 to 5
    };
  };
  stats: {
    racesPlayed: number;
    racesWon: number;
    totalBumps: number;
    bestTimeMs: number;
  };
  updatedAt?: string;
}

export const DEFAULT_USER_GARAGE: UserGarageData = {
  displayName: 'Apex Racer',
  coins: 2500,
  activeCarId: 'red_storm',
  unlockedCars: ['red_storm'],
  upgrades: {
    red_storm: { topSpeed: 1, acceleration: 1, heavyArmor: 1, nitroDuration: 1, nitroPower: 1 },
    cyber_beast: { topSpeed: 1, acceleration: 1, heavyArmor: 1, nitroDuration: 1, nitroPower: 1 },
    nitro_apex: { topSpeed: 1, acceleration: 1, heavyArmor: 1, nitroDuration: 1, nitroPower: 1 },
    phantom_gt: { topSpeed: 1, acceleration: 1, heavyArmor: 1, nitroDuration: 1, nitroPower: 1 },
    vortex_electric: { topSpeed: 1, acceleration: 1, heavyArmor: 1, nitroDuration: 1, nitroPower: 1 },
    titan_crusher: { topSpeed: 1, acceleration: 1, heavyArmor: 1, nitroDuration: 1, nitroPower: 1 },
  },
  stats: {
    racesPlayed: 0,
    racesWon: 0,
    totalBumps: 0,
    bestTimeMs: 0,
  },
};

/**
 * Load local garage for a given username or fallback
 */
export function loadLocalGarage(username?: string): UserGarageData {
  try {
    const key = username ? `${LOCAL_STORAGE_GARAGE_PREFIX}${username}` : LEGACY_STORAGE_KEY;
    const raw = localStorage.getItem(key) || (username ? localStorage.getItem(LEGACY_STORAGE_KEY) : null);
    if (raw) {
      return { ...DEFAULT_USER_GARAGE, ...JSON.parse(raw) };
    }
  } catch (e) {
    console.warn('Failed to load local garage', e);
  }
  return DEFAULT_USER_GARAGE;
}

/**
 * Save garage to local storage
 */
export function saveLocalGarage(data: UserGarageData, username?: string) {
  try {
    const key = username ? `${LOCAL_STORAGE_GARAGE_PREFIX}${username}` : LEGACY_STORAGE_KEY;
    localStorage.setItem(key, JSON.stringify(data));
    // Also update current active key for quick boot
    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Failed to save local garage', e);
  }
}

// -------------------------------------------------------------
// CUSTOM REGISTRATION & LOGIN (DIRECT ON FIREBASE FIRESTORE)
// -------------------------------------------------------------

/**
 * Register a new racer account with Name and Password directly on Firebase Firestore
 */
export async function registerRacer(name: string, password: string): Promise<AuthResponse> {
  const cleanName = name.trim();
  const handle = normalizeUsername(cleanName);

  if (!cleanName || cleanName.length < 2) {
    return {
      success: false,
      session: null,
      error: 'Racer name must be at least 2 characters long.',
    };
  }

  if (!handle) {
    return {
      success: false,
      session: null,
      error: 'Racer name must contain letters or numbers.',
    };
  }

  if (!password || password.length < 3) {
    return {
      success: false,
      session: null,
      error: 'Password must be at least 3 characters long.',
    };
  }

  try {
    const accountRef = doc(db, 'racer_accounts', handle);
    let existingSnap;
    try {
      existingSnap = await getDoc(accountRef);
    } catch {
      // Offline fallback: check local cached vault
      existingSnap = null;
    }

    if (existingSnap && existingSnap.exists()) {
      return {
        success: false,
        session: null,
        error: `Racer name "${cleanName}" is already registered. Please choose another name or log in!`,
      };
    }

    // Check local vault if offline
    if (getLocalCachedAccount(handle)) {
      return {
        success: false,
        session: null,
        error: `Racer name "${cleanName}" already exists on this machine. Please log in!`,
      };
    }

    const hashed = await hashPassword(password);
    const nowIso = new Date().toISOString();

    const newAccount: RacerAccount = {
      username: handle,
      displayName: cleanName,
      passwordHash: hashed,
      createdAt: nowIso,
      lastLoginAt: nowIso,
    };

    // Save to Firestore
    try {
      await setDoc(accountRef, newAccount);
    } catch (fsErr) {
      console.warn('Firestore account save note (local cached):', fsErr);
    }

    cacheAccountLocally(newAccount);

    // Initialize or adapt garage
    const currentLocal = loadLocalGarage();
    const newGarage: UserGarageData = {
      ...currentLocal,
      displayName: cleanName,
      username: handle,
      coins: Math.max(currentLocal.coins, 2500),
      updatedAt: nowIso,
    };

    // Save garage in Firestore & local
    try {
      await setDoc(doc(db, 'users', handle), newGarage, { merge: true });
    } catch (gErr) {
      console.warn('Firestore garage sync note:', gErr);
    }

    saveLocalGarage(newGarage, handle);

    const session: ActiveRacerSession = {
      username: handle,
      displayName: cleanName,
      loggedInAt: nowIso,
    };

    setActiveRacerSession(session);

    return {
      success: true,
      session,
      garage: newGarage,
    };
  } catch (error) {
    console.error('Registration failed:', error);
    return {
      success: false,
      session: null,
      error: error instanceof Error ? error.message : 'Registration failed. Please try again.',
    };
  }
}

/**
 * Log in to an existing racer account with Name and Password directly from Firebase Firestore
 */
export async function loginRacer(name: string, password: string): Promise<AuthResponse> {
  const cleanName = name.trim();
  const handle = normalizeUsername(cleanName);

  if (!cleanName || !password) {
    return {
      success: false,
      session: null,
      error: 'Please enter both your Racer Name and Password.',
    };
  }

  try {
    let accountData: RacerAccount | null = null;

    // 1. Try to fetch from Firebase Firestore
    try {
      const accountRef = doc(db, 'racer_accounts', handle);
      const snap = await getDoc(accountRef);
      if (snap.exists()) {
        accountData = snap.data() as RacerAccount;
      }
    } catch (fsErr) {
      console.warn('Firestore fetch note, checking local vault:', fsErr);
    }

    // 2. Check local vault fallback
    if (!accountData) {
      accountData = getLocalCachedAccount(handle);
    }

    if (!accountData) {
      return {
        success: false,
        session: null,
        error: `Racer "${cleanName}" not found. Please click "REGISTER" to create a new racer account!`,
      };
    }

    // 3. Verify password hash
    const inputHash = await hashPassword(password);
    if (accountData.passwordHash !== inputHash) {
      return {
        success: false,
        session: null,
        error: 'Incorrect password! Please check your credentials and try again.',
      };
    }

    // 4. Update lastLoginAt
    const nowIso = new Date().toISOString();
    try {
      await updateDoc(doc(db, 'racer_accounts', handle), {
        lastLoginAt: nowIso,
      });
    } catch {}

    cacheAccountLocally({ ...accountData, lastLoginAt: nowIso });

    // 5. Load saved garage from Firebase Firestore
    let loadedGarage: UserGarageData = loadLocalGarage(handle);
    try {
      const userDocSnap = await getDoc(doc(db, 'users', handle));
      if (userDocSnap.exists()) {
        loadedGarage = userDocSnap.data() as UserGarageData;
      }
    } catch (gErr) {
      console.warn('Firestore garage load note, using local cache:', gErr);
    }

    loadedGarage = {
      ...loadedGarage,
      displayName: accountData.displayName || cleanName,
      username: handle,
    };

    saveLocalGarage(loadedGarage, handle);

    const session: ActiveRacerSession = {
      username: handle,
      displayName: accountData.displayName || cleanName,
      loggedInAt: nowIso,
    };

    setActiveRacerSession(session);

    return {
      success: true,
      session,
      garage: loadedGarage,
    };
  } catch (error) {
    console.error('Login error:', error);
    return {
      success: false,
      session: null,
      error: error instanceof Error ? error.message : 'Login failed. Please try again.',
    };
  }
}

/**
 * Log out current racer
 */
export function logoutRacer(): void {
  setActiveRacerSession(null);
}

/**
 * Load garage for current active racer from Firebase Firestore or Local Storage
 */
export async function loadUserGarage(session: ActiveRacerSession | null): Promise<UserGarageData> {
  if (!session) {
    return loadLocalGarage();
  }

  const handle = session.username;
  try {
    const snap = await getDoc(doc(db, 'users', handle));
    if (snap.exists()) {
      const data = snap.data() as UserGarageData;
      const merged: UserGarageData = {
        ...data,
        displayName: session.displayName || data.displayName || 'Apex Racer',
        username: handle,
      };
      saveLocalGarage(merged, handle);
      return merged;
    } else {
      const local = loadLocalGarage(handle);
      const initial: UserGarageData = {
        ...local,
        displayName: session.displayName || 'Apex Racer',
        username: handle,
        updatedAt: new Date().toISOString(),
      };
      try {
        await setDoc(doc(db, 'users', handle), initial);
      } catch {}
      saveLocalGarage(initial, handle);
      return initial;
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `users/${handle}`, handle);
    return loadLocalGarage(handle);
  }
}

/**
 * Save user garage both to Local Storage and Firebase Firestore
 */
export async function saveUserGarage(session: ActiveRacerSession | null, data: UserGarageData) {
  const handle = session?.username;
  saveLocalGarage(data, handle);

  if (!handle) return;

  try {
    await setDoc(
      doc(db, 'users', handle),
      {
        ...data,
        displayName: session.displayName || data.displayName,
        username: handle,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${handle}`, handle);
  }
}

// -------------------------------------------------------------
// MULTIPLAYER ROOMS & NETWORK TICKS
// -------------------------------------------------------------

export interface RoomPlayerState {
  playerId: string;
  displayName: string;
  carId: string;
  color: string;
  isHost: boolean;
  isReady: boolean;
  x: number;
  z: number;
  lane: number;
  speed: number;
  nitroActive: boolean;
  finished: boolean;
  finishTime: number;
  rank: number;
  updatedAt?: string;
}

export async function createMultiplayerRoom(
  session: ActiveRacerSession | null,
  code: string,
  trackLength: number,
  trackTheme: string,
  carId: string
): Promise<string> {
  const roomRef = doc(collection(db, 'rooms'));
  const roomId = roomRef.id;
  const playerId = session ? session.username : `guest_${Math.floor(1000 + Math.random() * 9000)}`;
  const displayName = session ? session.displayName : 'Apex Host';

  try {
    await setDoc(roomRef, {
      hostId: playerId,
      code: code.toUpperCase(),
      trackLength,
      trackTheme,
      status: 'waiting',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const playerRef = doc(db, 'rooms', roomId, 'players', playerId);
    await setDoc(playerRef, {
      playerId,
      displayName,
      carId,
      color: '#ef4444',
      isHost: true,
      isReady: true,
      x: 0,
      z: 0,
      lane: 1,
      speed: 0,
      nitroActive: false,
      finished: false,
      finishTime: 0,
      rank: 1,
      updatedAt: new Date().toISOString(),
    });

    return roomId;
  } catch (err) {
    throw handleFirestoreError(err, OperationType.CREATE, `rooms/${roomId}`, playerId);
  }
}

export async function joinMultiplayerRoom(
  session: ActiveRacerSession | null,
  code: string,
  carId: string
): Promise<string> {
  const playerId = session ? session.username : `guest_${Math.floor(1000 + Math.random() * 9000)}`;
  const displayName = session ? session.displayName : 'Apex Racer';

  try {
    const q = query(collection(db, 'rooms'), where('code', '==', code.toUpperCase()));
    const snap = await getDocs(q);
    if (snap.empty) {
      throw new Error(`Room with code "${code}" not found.`);
    }

    const roomDoc = snap.docs[0];
    const roomId = roomDoc.id;

    const playerRef = doc(db, 'rooms', roomId, 'players', playerId);
    await setDoc(playerRef, {
      playerId,
      displayName,
      carId,
      color: '#06b6d4',
      isHost: false,
      isReady: false,
      x: 0,
      z: 0,
      lane: 2,
      speed: 0,
      nitroActive: false,
      finished: false,
      finishTime: 0,
      rank: 2,
      updatedAt: new Date().toISOString(),
    });

    return roomId;
  } catch (err) {
    throw handleFirestoreError(err, OperationType.GET, 'rooms', playerId);
  }
}

export async function updateRoomStatus(roomId: string, status: string) {
  try {
    await updateDoc(doc(db, 'rooms', roomId), {
      status,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    throw handleFirestoreError(err, OperationType.UPDATE, `rooms/${roomId}`);
  }
}

export function updatePlayerRaceTick(
  roomId: string,
  playerId: string,
  tickData: {
    x: number;
    z: number;
    lane: number;
    speed: number;
    nitroActive: boolean;
    finished: boolean;
    finishTime: number;
    rank: number;
  }
) {
  try {
    const playerRef = doc(db, 'rooms', roomId, 'players', playerId);
    updateDoc(playerRef, {
      ...tickData,
      updatedAt: new Date().toISOString(),
    }).catch(() => {});
  } catch {
    // Non-blocking UDP-style network tick
  }
}

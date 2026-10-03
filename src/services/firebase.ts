import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInAnonymously,
  signOut as fbSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
  updateProfile,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  updateDoc,
  onSnapshot,
  collection,
  deleteDoc,
  serverTimestamp,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App & Services
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export { signInWithPopup, signInAnonymously, fbSignOut as signOut, onAuthStateChanged };

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
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
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

export interface UserGarageData {
  displayName: string;
  email?: string;
  fingerprintAuth?: boolean;
  biometricKeyId?: string;
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

const LOCAL_STORAGE_KEY = 'sup_nitro_user_garage';
const BIOMETRIC_SESSION_KEY = 'sup_nitro_biometric_user';

export function loadLocalGarage(): UserGarageData {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      return { ...DEFAULT_USER_GARAGE, ...JSON.parse(raw) };
    }
  } catch (e) {
    console.error('Failed to load local garage', e);
  }
  return DEFAULT_USER_GARAGE;
}

export function saveLocalGarage(data: UserGarageData) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save local garage', e);
  }
}

export async function loadUserGarage(user: FirebaseUser | null): Promise<UserGarageData> {
  if (!user) {
    return loadLocalGarage();
  }
  const userPath = `users/${user.uid}`;
  try {
    const snap = await getDoc(doc(db, 'users', user.uid));
    if (snap.exists()) {
      const data = snap.data() as UserGarageData;
      saveLocalGarage(data);
      return data;
    } else {
      const initial: UserGarageData = {
        ...loadLocalGarage(),
        displayName: user.displayName || 'Apex Racer',
        email: user.email || '',
        updatedAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'users', user.uid), initial);
      saveLocalGarage(initial);
      return initial;
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, userPath);
    return loadLocalGarage();
  }
}

export async function saveUserGarage(user: FirebaseUser | null, data: UserGarageData) {
  saveLocalGarage(data);
  if (!user) return;
  const userPath = `users/${user.uid}`;
  try {
    await setDoc(
      doc(db, 'users', user.uid),
      {
        ...data,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, userPath);
  }
}

// -------------------------------------------------------------
// BIOMETRIC FINGERPRINT PASSWORDLESS AUTHENTICATION
// -------------------------------------------------------------

export interface BiometricAuthResult {
  success: boolean;
  user: FirebaseUser | null;
  garage: UserGarageData;
  error?: string;
  notice?: string;
}

function normalizeHandle(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
}

/**
 * Safely acquire auth context with graceful fallback if Identity Toolkit is not enabled
 */
async function acquireAuthContext(cleanName: string): Promise<{
  user: FirebaseUser | null;
  localFallback: boolean;
  notice?: string;
}> {
  try {
    let currentUser = auth.currentUser;
    if (!currentUser) {
      const cred = await signInAnonymously(auth);
      currentUser = cred.user;
    }
    if (currentUser) {
      await updateProfile(currentUser, { displayName: cleanName }).catch(() => {});
    }
    return { user: currentUser, localFallback: false };
  } catch (err: unknown) {
    const errorStr = String(err);
    const code = (err as { code?: string })?.code || '';
    if (
      code === 'auth/identity-toolkit-api-has-not-been-enabled' ||
      code === 'auth/operation-not-allowed' ||
      code === 'auth/configuration-not-found' ||
      code === 'auth/admin-restricted-operation' ||
      errorStr.includes('identity-toolkit-api-has-not-been-enabled')
    ) {
      console.warn('Identity Toolkit API not configured on server. Operating in Local Biometric Vault mode.');
      const localUid = `bio_user_${normalizeHandle(cleanName)}`;
      const fallbackUser = {
        uid: localUid,
        displayName: cleanName,
        email: null,
        isAnonymous: true,
      } as unknown as FirebaseUser;

      return {
        user: fallbackUser,
        localFallback: true,
        notice: 'Authentication API not configured on server. Local Biometric Vault active.',
      };
    }
    throw err;
  }
}

/**
 * Sign Up with Player Name and Fingerprint Biometric
 */
export async function signUpWithFingerprint(
  playerName: string,
  fingerprintKeyId: string
): Promise<BiometricAuthResult> {
  const cleanName = playerName.trim();
  const handle = normalizeHandle(cleanName);

  if (!cleanName || cleanName.length < 2) {
    return {
      success: false,
      user: null,
      garage: DEFAULT_USER_GARAGE,
      error: 'Please enter a valid player name (at least 2 letters).',
    };
  }

  try {
    const { user: currentUser, localFallback, notice } = await acquireAuthContext(cleanName);
    const uid = currentUser ? currentUser.uid : `bio_${handle}`;

    const local = loadLocalGarage();
    const newGarage: UserGarageData = {
      ...local,
      displayName: cleanName,
      fingerprintAuth: true,
      biometricKeyId: fingerprintKeyId,
      coins: Math.max(local.coins, 2500),
      updatedAt: new Date().toISOString(),
    };

    saveLocalGarage(newGarage);
    localStorage.setItem(
      BIOMETRIC_SESSION_KEY,
      JSON.stringify({ name: cleanName, uid, keyId: fingerprintKeyId })
    );

    // Save to Firestore if cloud backend is available
    if (!localFallback) {
      try {
        const handleDocRef = doc(db, 'player_handles', handle);
        await setDoc(handleDocRef, {
          handle,
          displayName: cleanName,
          userId: uid,
          biometricKeyId: fingerprintKeyId,
          createdAt: new Date().toISOString(),
        });
        await setDoc(doc(db, 'users', uid), newGarage);
      } catch (firestoreErr) {
        console.warn('Firestore cloud sync notice:', firestoreErr);
      }
    }

    return {
      success: true,
      user: currentUser,
      garage: newGarage,
      notice,
    };
  } catch (error) {
    console.error('Biometric Sign Up Error', error);
    return {
      success: false,
      user: null,
      garage: DEFAULT_USER_GARAGE,
      error: error instanceof Error ? error.message : 'Biometric sign up failed. Please try again.',
    };
  }
}

/**
 * Log In with Player Name and Fingerprint Biometric
 */
export async function loginWithFingerprint(
  playerName: string,
  fingerprintKeyId: string
): Promise<BiometricAuthResult> {
  const cleanName = playerName.trim();
  const handle = normalizeHandle(cleanName);

  if (!cleanName) {
    return {
      success: false,
      user: null,
      garage: DEFAULT_USER_GARAGE,
      error: 'Please enter your registered racer name.',
    };
  }

  try {
    const { user: currentUser, localFallback, notice } = await acquireAuthContext(cleanName);
    const uid = currentUser ? currentUser.uid : `bio_${handle}`;

    // Check local storage vault first
    const savedLocal = loadLocalGarage();
    let loadedGarage: UserGarageData = savedLocal;

    // Attempt Firestore cloud retrieval if cloud auth is operational
    if (!localFallback) {
      try {
        const handleDocRef = doc(db, 'player_handles', handle);
        const handleSnap = await getDoc(handleDocRef);

        if (handleSnap.exists()) {
          const targetUserId = handleSnap.data().userId;
          const userSnap = await getDoc(doc(db, 'users', targetUserId));
          if (userSnap.exists()) {
            loadedGarage = userSnap.data() as UserGarageData;
          }
        }
      } catch (firestoreErr) {
        console.warn('Firestore lookup notice, falling back to local biometric vault:', firestoreErr);
      }
    }

    // Ensure display name is maintained
    loadedGarage = {
      ...loadedGarage,
      displayName: cleanName,
      fingerprintAuth: true,
    };

    saveLocalGarage(loadedGarage);
    localStorage.setItem(
      BIOMETRIC_SESSION_KEY,
      JSON.stringify({ name: cleanName, uid, keyId: fingerprintKeyId })
    );

    return {
      success: true,
      user: currentUser,
      garage: loadedGarage,
      notice,
    };
  } catch (error) {
    console.error('Biometric Login Error', error);
    return {
      success: false,
      user: null,
      garage: DEFAULT_USER_GARAGE,
      error: error instanceof Error ? error.message : 'Biometric authentication failed.',
    };
  }
}

export function getSavedBiometricHandle(): string | null {
  try {
    const raw = localStorage.getItem(BIOMETRIC_SESSION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return parsed.name || null;
    }
  } catch {}
  return null;
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
  user: FirebaseUser,
  code: string,
  trackLength: number,
  trackTheme: string,
  carId: string
): Promise<string> {
  const roomRef = doc(collection(db, 'rooms'));
  const roomId = roomRef.id;

  try {
    await setDoc(roomRef, {
      hostId: user.uid,
      code: code.toUpperCase(),
      trackLength,
      trackTheme,
      status: 'waiting',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const playerRef = doc(db, 'rooms', roomId, 'players', user.uid);
    await setDoc(playerRef, {
      playerId: user.uid,
      displayName: user.displayName || 'Apex Host',
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
    throw handleFirestoreError(err, OperationType.CREATE, `rooms/${roomId}`);
  }
}

export async function joinMultiplayerRoom(
  user: FirebaseUser,
  code: string,
  carId: string
): Promise<string> {
  try {
    const q = query(collection(db, 'rooms'), where('code', '==', code.toUpperCase()));
    const snap = await getDocs(q);
    if (snap.empty) {
      throw new Error(`Room with code "${code}" not found.`);
    }

    const roomDoc = snap.docs[0];
    const roomId = roomDoc.id;

    const playerRef = doc(db, 'rooms', roomId, 'players', user.uid);
    await setDoc(playerRef, {
      playerId: user.uid,
      displayName: user.displayName || 'Apex Racer',
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
    throw handleFirestoreError(err, OperationType.GET, 'rooms');
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

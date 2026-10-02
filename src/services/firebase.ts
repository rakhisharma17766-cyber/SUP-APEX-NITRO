import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
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
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export { signInWithPopup, fbSignOut as signOut, onAuthStateChanged };

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
  email: string;
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
  displayName: 'Apex Driver',
  email: '',
  coins: 1500,
  activeCarId: 'red_storm',
  unlockedCars: ['red_storm'],
  upgrades: {
    red_storm: {
      topSpeed: 1,
      acceleration: 1,
      heavyArmor: 1,
      nitroDuration: 1,
      nitroPower: 1,
    },
    cyber_beast: {
      topSpeed: 1,
      acceleration: 1,
      heavyArmor: 1,
      nitroDuration: 1,
      nitroPower: 1,
    },
    nitro_apex: {
      topSpeed: 1,
      acceleration: 1,
      heavyArmor: 1,
      nitroDuration: 1,
      nitroPower: 1,
    },
  },
  stats: {
    racesPlayed: 0,
    racesWon: 0,
    totalBumps: 0,
    bestTimeMs: 0,
  },
};

const LOCAL_STORAGE_KEY = 'sup_nitro_user_garage';

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
    handleFirestoreError(err, OperationType.UPDATE, userPath);
  }
}

// Multiplayer Room Models
export interface RoomData {
  id: string;
  code: string;
  hostId: string;
  hostName: string;
  trackLength: number; // 1000, 2500, 5000
  trackTheme: 'cyber' | 'desert' | 'beach';
  status: 'waiting' | 'countdown' | 'in_race' | 'finished';
  createdAt: string;
  updatedAt: string;
}

export interface RoomPlayerState {
  playerId: string;
  displayName: string;
  carId: string;
  color: string;
  isHost: boolean;
  isReady: boolean;
  isBot?: boolean;
  x: number;
  z: number;
  lane: number;
  speed: number;
  nitroActive: boolean;
  finished: boolean;
  finishTime?: number;
  rank: number;
  updatedAt: string;
}

export async function createMultiplayerRoom(
  hostUser: FirebaseUser,
  code: string,
  trackLength: number,
  trackTheme: 'cyber' | 'desert' | 'beach',
  carId: string
): Promise<string> {
  const roomId = 'room_' + code;
  const roomPath = `rooms/${roomId}`;
  const now = new Date().toISOString();

  try {
    const roomRef = doc(db, 'rooms', roomId);
    await setDoc(roomRef, {
      code,
      hostId: hostUser.uid,
      hostName: hostUser.displayName || 'Host Racer',
      trackLength,
      trackTheme,
      status: 'waiting',
      createdAt: now,
      updatedAt: now,
    });

    const playerRef = doc(db, 'rooms', roomId, 'players', hostUser.uid);
    await setDoc(playerRef, {
      playerId: hostUser.uid,
      displayName: hostUser.displayName || 'Host Racer',
      carId,
      color: '#06b6d4',
      isHost: true,
      isReady: true,
      x: 0,
      z: 0,
      lane: 1,
      speed: 0,
      nitroActive: false,
      finished: false,
      rank: 1,
      updatedAt: now,
    });

    return roomId;
  } catch (err) {
    throw handleFirestoreError(err, OperationType.CREATE, roomPath);
  }
}

export async function joinMultiplayerRoom(
  user: FirebaseUser,
  code: string,
  carId: string
): Promise<string | null> {
  const roomId = 'room_' + code;
  const roomPath = `rooms/${roomId}`;
  try {
    const roomSnap = await getDoc(doc(db, 'rooms', roomId));
    if (!roomSnap.exists()) {
      return null;
    }
    const now = new Date().toISOString();
    const playerRef = doc(db, 'rooms', roomId, 'players', user.uid);
    await setDoc(playerRef, {
      playerId: user.uid,
      displayName: user.displayName || 'Challenger',
      carId,
      color: '#f43f5e',
      isHost: false,
      isReady: true,
      x: 0,
      z: 0,
      lane: 2,
      speed: 0,
      nitroActive: false,
      finished: false,
      rank: 2,
      updatedAt: now,
    });
    return roomId;
  } catch (err) {
    throw handleFirestoreError(err, OperationType.GET, roomPath);
  }
}

export async function updatePlayerRaceTick(
  roomId: string,
  playerId: string,
  data: Partial<RoomPlayerState>
) {
  const path = `rooms/${roomId}/players/${playerId}`;
  try {
    await updateDoc(doc(db, 'rooms', roomId, 'players', playerId), {
      ...data,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    // Non-blocking tick failure
    console.debug('Player tick update skipped:', err);
  }
}

export async function updateRoomStatus(
  roomId: string,
  status: 'waiting' | 'countdown' | 'in_race' | 'finished'
) {
  const path = `rooms/${roomId}`;
  try {
    await updateDoc(doc(db, 'rooms', roomId), {
      status,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

import React, { useState, useEffect } from 'react';
import {
  createMultiplayerRoom,
  joinMultiplayerRoom,
  RoomPlayerState,
  db,
  updateRoomStatus,
  ActiveRacerSession,
} from '../services/firebase';
import { collection, onSnapshot, doc } from 'firebase/firestore';
import { TrackThemeId, TRACK_THEMES } from '../game/trackGenerator';
import { VEHICLES } from '../game/cars';
import { X, Users, Play, Copy, Check, Radio, Sparkles, UserCheck } from 'lucide-react';
import { soundSynth } from '../game/audio';

interface MultiplayerLobbyModalProps {
  session: ActiveRacerSession | null;
  activeCarId: string;
  onStartMultiplayerRace: (roomId: string, trackLength: number, trackTheme: TrackThemeId) => void;
  onClose: () => void;
  onOpenAuthModal?: () => void;
}

export const MultiplayerLobbyModal: React.FC<MultiplayerLobbyModalProps> = ({
  session,
  activeCarId,
  onStartMultiplayerRace,
  onClose,
  onOpenAuthModal,
}) => {
  const [tab, setTab] = useState<'host' | 'join'>('host');
  const [roomCode, setRoomCode] = useState<string>(() =>
    Math.floor(1000 + Math.random() * 9000).toString()
  );
  const [joinCodeInput, setJoinCodeInput] = useState<string>('');
  const [trackLength, setTrackLength] = useState<number>(2500);
  const [trackTheme, setTrackTheme] = useState<TrackThemeId>('cyber');
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [isHost, setIsHost] = useState<boolean>(true);
  const [playersInLobby, setPlayersInLobby] = useState<RoomPlayerState[]>([]);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Subscribe to room players when in room
  useEffect(() => {
    if (!activeRoomId) return;

    const unsubPlayers = onSnapshot(
      collection(db, 'rooms', activeRoomId, 'players'),
      (snapshot) => {
        const list: RoomPlayerState[] = [];
        snapshot.forEach((docSnap) => {
          list.push(docSnap.data() as RoomPlayerState);
        });
        setPlayersInLobby(list);
      },
      (err) => {
        console.warn('Lobby players snapshot error:', err);
      }
    );

    const unsubRoom = onSnapshot(
      doc(db, 'rooms', activeRoomId),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.status === 'in_race' || data.status === 'countdown') {
            onStartMultiplayerRace(activeRoomId, data.trackLength || 2500, data.trackTheme || 'cyber');
          }
        }
      },
      (err) => {
        console.warn('Room snapshot error:', err);
      }
    );

    return () => {
      unsubPlayers();
      unsubRoom();
    };
  }, [activeRoomId, onStartMultiplayerRace]);

  const handleCreateRoom = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const roomId = await createMultiplayerRoom(
        session,
        roomCode,
        trackLength,
        trackTheme,
        activeCarId
      );
      setActiveRoomId(roomId);
      setIsHost(true);
      soundSynth.playCoinSound();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg('Failed to create room: ' + msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!joinCodeInput || joinCodeInput.trim().length < 4) {
      setErrorMsg('Please enter a valid 4-digit room code');
      return;
    }
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const roomId = await joinMultiplayerRoom(session, joinCodeInput.trim(), activeCarId);
      if (!roomId) {
        setErrorMsg('Room not found! Verify code and try again.');
      } else {
        setActiveRoomId(roomId);
        setIsHost(false);
        soundSynth.playCoinSound();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg('Failed to join room: ' + msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLaunchRace = async () => {
    if (!activeRoomId || !isHost) return;
    try {
      await updateRoomStatus(activeRoomId, 'countdown');
      onStartMultiplayerRace(activeRoomId, trackLength, trackTheme);
    } catch (e) {
      console.warn('Launch room status failed:', e);
      onStartMultiplayerRace(activeRoomId, trackLength, trackTheme);
    }
  };

  const copyToClipboard = () => {
    const code = activeRoomId ? activeRoomId.replace('room_', '') : roomCode;
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
      <div className="w-full max-w-xl max-h-[90dvh] overflow-y-auto bg-slate-900 border border-slate-700/80 rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col gap-5 text-white relative my-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full bg-slate-800/80 hover:bg-slate-700 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Title */}
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-500/20 rounded-2xl border border-indigo-400/40 text-indigo-400">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-arcade text-xl font-bold tracking-wide text-glow text-cyan-400">
              SUP MULTIPLAYER PADDOCK
            </h3>
            <p className="text-xs text-slate-400">Real-time room matchmaking & bot fill engine</p>
          </div>
        </div>

        {!session && (
          <div className="bg-indigo-950/70 border border-indigo-500/50 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
            <div>
              <p className="font-arcade text-xs font-bold text-white">Cloud Racer Profile</p>
              <p className="text-[11px] text-slate-300">Log in or create a Racer Profile to sync your trophies, stats & rewards across devices.</p>
            </div>
            {onOpenAuthModal && (
              <button
                onClick={onOpenAuthModal}
                className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-arcade font-bold text-xs rounded-xl shadow-md flex items-center gap-2 flex-shrink-0 transition active:scale-95"
              >
                <UserCheck className="w-4 h-4" />
                <span>RACER LOGIN / REGISTER</span>
              </button>
            )}
          </div>
        )}

        {errorMsg && (
          <div className="bg-rose-950/80 border border-rose-500 text-rose-300 text-xs px-3.5 py-2 rounded-xl">
            {errorMsg}
          </div>
        )}

        {!activeRoomId ? (
          <>
            {/* Host / Join Tabs */}
            <div className="flex bg-slate-950/80 p-1 rounded-2xl border border-slate-800">
              <button
                onClick={() => setTab('host')}
                className={`flex-1 py-2.5 rounded-xl font-arcade text-xs md:text-sm font-bold transition ${
                  tab === 'host'
                    ? 'bg-cyan-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                HOST ROOM
              </button>
              <button
                onClick={() => setTab('join')}
                className={`flex-1 py-2.5 rounded-xl font-arcade text-xs md:text-sm font-bold transition ${
                  tab === 'join'
                    ? 'bg-cyan-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                JOIN WITH CODE
              </button>
            </div>

            {tab === 'host' ? (
              <div className="flex flex-col gap-4">
                {/* 4-Digit Room Code Display */}
                <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-400">Your 4-Digit Room Code</span>
                    <div className="font-arcade text-3xl font-black text-amber-400 tracking-widest">
                      {roomCode}
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      setRoomCode(Math.floor(1000 + Math.random() * 9000).toString())
                    }
                    className="text-xs px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                  >
                    Randomize
                  </button>
                </div>

                {/* Track Length Selector */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-slate-300">Track Distance</span>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { len: 1000, label: 'Short (1,000m)' },
                      { len: 2500, label: 'Medium (2,500m)' },
                      { len: 5000, label: 'Ultra Big (5,000m)' },
                    ].map((opt) => (
                      <button
                        key={opt.len}
                        onClick={() => setTrackLength(opt.len)}
                        className={`p-2.5 rounded-xl border text-xs font-bold transition ${
                          trackLength === opt.len
                            ? 'bg-cyan-950 border-cyan-400 text-cyan-300 shadow-md'
                            : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:bg-slate-800'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Track Theme Selector */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-slate-300">Track Theme</span>
                  <div className="grid grid-cols-3 gap-2">
                    {Object.values(TRACK_THEMES).map((th) => (
                      <button
                        key={th.id}
                        onClick={() => setTrackTheme(th.id)}
                        className={`p-2.5 rounded-xl border text-xs font-bold transition ${
                          trackTheme === th.id
                            ? 'bg-cyan-950 border-cyan-400 text-cyan-300 shadow-md'
                            : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:bg-slate-800'
                        }`}
                      >
                        {th.name}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleCreateRoom}
                  disabled={isLoading}
                  className="w-full py-3.5 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 rounded-2xl font-arcade font-bold text-sm tracking-wider text-white shadow-xl transition active:scale-95 disabled:opacity-50 neon-glow-cyan"
                >
                  {isLoading ? 'OPENING PADDOCK...' : 'CREATE ROOM LOBBY'}
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    Enter Host 4-Digit Room Code:
                  </label>
                  <input
                    type="text"
                    maxLength={4}
                    value={joinCodeInput}
                    onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                    placeholder="e.g. 7429"
                    className="w-full py-3 px-4 bg-slate-950 border border-slate-700 rounded-2xl text-center font-arcade text-3xl tracking-widest text-amber-400 focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <button
                  onClick={handleJoinRoom}
                  disabled={isLoading}
                  className="w-full py-3.5 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 rounded-2xl font-arcade font-bold text-sm tracking-wider text-white shadow-xl transition active:scale-95 disabled:opacity-50 neon-glow-cyan"
                >
                  {isLoading ? 'SEARCHING ROOM...' : 'JOIN ROOM'}
                </button>
              </div>
            )}
          </>
        ) : (
          /* Active Room Waiting Area */
          <div className="flex flex-col gap-5">
            <div className="bg-slate-950/80 border border-cyan-500/40 rounded-2xl p-4 flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-xs text-slate-400">Share this Room Code with friends:</span>
                <span className="font-arcade text-3xl font-black text-amber-400 tracking-widest">
                  {activeRoomId.replace('room_', '')}
                </span>
              </div>
              <button
                onClick={copyToClipboard}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition"
              >
                {copiedCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span>{copiedCode ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            {/* Racers Grid */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                <span>Racers Connected ({playersInLobby.length}/4)</span>
                <span className="text-cyan-400 font-semibold">Unfilled slots will be AI Bots</span>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {[...Array(4)].map((_, i) => {
                  const p = playersInLobby[i];
                  return (
                    <div
                      key={i}
                      className={`p-3 rounded-2xl border flex items-center gap-3 transition ${
                        p
                          ? 'bg-slate-950/70 border-cyan-500/50'
                          : 'bg-slate-950/30 border-slate-800/80 border-dashed'
                      }`}
                    >
                      {p ? (
                        <>
                          <div
                            className="w-4 h-4 rounded-full border border-white"
                            style={{ backgroundColor: p.color }}
                          />
                          <div className="flex flex-col overflow-hidden">
                            <span className="text-xs font-bold truncate text-slate-100">
                              {p.displayName} {p.isHost && '(Host)'}
                            </span>
                            <span className="text-[10px] text-cyan-400 uppercase">
                              {VEHICLES[p.carId]?.name || 'Racer'}
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="flex items-center gap-2 text-slate-500 text-xs">
                          <Radio className="w-4 h-4 animate-pulse" />
                          <span>AI Bot Fill</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {isHost ? (
              <button
                onClick={handleLaunchRace}
                className="w-full py-4 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-white font-arcade font-black text-base tracking-wider rounded-2xl flex items-center justify-center gap-2 shadow-2xl transition active:scale-95 neon-glow-cyan"
              >
                <Play className="w-5 h-5 fill-current" />
                <span>LAUNCH MULTIPLAYER RACE</span>
              </button>
            ) : (
              <div className="py-3 px-4 bg-slate-950/60 border border-slate-800 rounded-2xl text-center font-arcade text-xs text-cyan-300 animate-pulse">
                WAITING FOR HOST TO LAUNCH RACE...
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

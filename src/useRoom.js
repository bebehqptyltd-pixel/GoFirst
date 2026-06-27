import { useState, useEffect, useCallback, useRef } from "react";
import { ref, set, update, onValue, off, remove, get } from "firebase/database";
import { db } from "./firebase";

const PLAYER_ID_KEY = "gofirst_player_id";

function generateCode() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

function getOrCreatePlayerId() {
  let id = localStorage.getItem(PLAYER_ID_KEY);
  if (!id) {
    id = Math.random().toString(36).slice(2, 10);
    localStorage.setItem(PLAYER_ID_KEY, id);
  }
  return id;
}

export function useRoom() {
  const [roomCode, setRoomCode] = useState(null);
  const [roomState, setRoomState] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [playerId] = useState(() => getOrCreatePlayerId());
  const [error, setError] = useState(null);
  const [status, setStatus] = useState("idle");
  const listenerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (listenerRef.current) {
        off(listenerRef.current);
      }
    };
  }, []);

  const subscribeToRoom = useCallback((code) => {
    const roomRef = ref(db, `rooms/${code}`);
    listenerRef.current = roomRef;
    onValue(roomRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        setError("Room not found.");
        setStatus("error");
        return;
      }
      setRoomState(data);
      if (data.guestId && data.status === "connected") {
        setStatus("connected");
      }
    });
  }, []);

  const createRoom = useCallback(async (deckConfig) => {
    setStatus("creating");
    setError(null);
    const code = generateCode();
    const roomRef = ref(db, `rooms/${code}`);
    await set(roomRef, {
      hostId: playerId,
      guestId: null,
      hostPresent: true,
      guestPresent: false,
      status: "waiting",
      stage: deckConfig.stage || null,
      spicyLevel: deckConfig.spicyLevel || 0,
      activeCats: deckConfig.activeCats || [],
      currentQuestion: deckConfig.currentQuestion || null,
      nextQuestion: deckConfig.nextQuestion || null,
      seenQuestions: deckConfig.seenQuestions || [],
      flipped: false,
      perspectiveFlipped: false,
      lastAction: null,
      lastActionBy: null,
      createdAt: Date.now(),
    });
    setRoomCode(code);
    setIsHost(true);
    setStatus("waiting");
    subscribeToRoom(code);
    return code;
  }, [playerId, subscribeToRoom]);

  const joinRoom = useCallback(async (code) => {
    setStatus("joining");
    setError(null);
    const roomRef = ref(db, `rooms/${code}`);
    const snapshot = await get(roomRef);
    const data = snapshot.val();

    if (!data) {
      setError("Code expired. Ask them to create a new room.");
      setStatus("error");
      return false;
    }

    // Rejoin as host
    if (data.hostId === playerId) {
      await update(roomRef, { hostPresent: true });
      setRoomCode(code);
      setIsHost(true);
      setStatus(data.guestId ? "connected" : "waiting");
      subscribeToRoom(code);
      return true;
    }

    // Rejoin as guest
    if (data.guestId === playerId) {
      await update(roomRef, { guestPresent: true, status: "connected" });
      setRoomCode(code);
      setIsHost(false);
      setStatus("connected");
      subscribeToRoom(code);
      return true;
    }

    // Room already has a different guest
    if (data.guestId && data.guestId !== playerId) {
      setError("That room is already full.");
      setStatus("error");
      return false;
    }

    // Fresh join as guest
    await update(roomRef, { guestId: playerId, guestPresent: true, status: "connected" });
    setRoomCode(code);
    setIsHost(false);
    setStatus("connected");
    subscribeToRoom(code);
    return true;
  }, [playerId, subscribeToRoom]);

  const syncAction = useCallback(async (updates) => {
    if (!roomCode) return;
    await update(ref(db, `rooms/${roomCode}`), {
      ...updates,
      lastAction: Date.now(),
      lastActionBy: playerId,
    });
  }, [roomCode, playerId]);

  // Leaving never deletes the room outright -- it marks the leaver as away.
  // The room is only removed once BOTH players are gone, so either can rejoin
  // with the same code.
  const leaveRoom = useCallback(async () => {
    if (listenerRef.current) {
      off(listenerRef.current);
      listenerRef.current = null;
    }
    if (roomCode) {
      try {
        const roomRef = ref(db, `rooms/${roomCode}`);
        const snapshot = await get(roomRef);
        const data = snapshot.val();
        if (data) {
          const iAmHost = data.hostId === playerId;
          const otherPresent = iAmHost ? data.guestPresent : data.hostPresent;
          if (otherPresent) {
            // Other player still here -- just mark myself away, keep room alive
            await update(roomRef, iAmHost ? { hostPresent: false } : { guestPresent: false, status: "waiting" });
          } else {
            // Nobody left -- safe to delete
            await remove(roomRef);
          }
        }
      } catch (e) {
        // best effort -- if cleanup fails, room will simply linger
      }
    }
    setRoomCode(null);
    setRoomState(null);
    setIsHost(false);
    setStatus("idle");
    setError(null);
  }, [roomCode, playerId]);

  return {
    roomCode,
    roomState,
    isHost,
    playerId,
    status,
    error,
    createRoom,
    joinRoom,
    syncAction,
    leaveRoom,
  };
}

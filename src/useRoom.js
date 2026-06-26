import { useState, useEffect, useCallback, useRef } from "react";
import { ref, set, update, onValue, off, remove, get } from "firebase/database";
import { db } from "./firebase";

const PLAYER_ID_KEY = "gofirst_player_id";

function generateCode() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// Persist player ID across sessions so rejoin works
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
  const lastSentRef = useRef(null);

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
      // Ignore our own echoes to prevent re-render loop fighting drag state
      if (lastSentRef.current &&
          data.lastActionBy === playerId &&
          data.lastAction === lastSentRef.current) {
        return;
      }
      setRoomState(data);
      if (data.guestId && data.status === "connected") {
        setStatus("connected");
      }
    });
  }, [playerId]);

  const createRoom = useCallback(async (deckConfig) => {
    setStatus("creating");
    setError(null);
    const code = generateCode();
    const roomRef = ref(db, `rooms/${code}`);
    await set(roomRef, {
      hostId: playerId,
      guestId: null,
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
      setRoomCode(code);
      setIsHost(true);
      setStatus(data.status === "connected" ? "connected" : "waiting");
      subscribeToRoom(code);
      return true;
    }

    // Rejoin as guest
    if (data.guestId === playerId) {
      await update(roomRef, { status: "connected" });
      setRoomCode(code);
      setIsHost(false);
      setStatus("connected");
      subscribeToRoom(code);
      return true;
    }

    // New guest -- room already has someone else
    if (data.guestId && data.guestId !== playerId) {
      setError("Code expired. Ask them to create a new room.");
      setStatus("error");
      return false;
    }

    // Fresh join
    await update(roomRef, { guestId: playerId, status: "connected" });
    setRoomCode(code);
    setIsHost(false);
    setStatus("connected");
    subscribeToRoom(code);
    return true;
  }, [playerId, subscribeToRoom]);

  const syncAction = useCallback(async (updates) => {
    if (!roomCode) return;
    const ts = Date.now();
    lastSentRef.current = ts;
    await update(ref(db, `rooms/${roomCode}`), {
      ...updates,
      lastAction: ts,
      lastActionBy: playerId,
    });
  }, [roomCode, playerId]);

  const leaveRoom = useCallback(async () => {
    if (listenerRef.current) {
      off(listenerRef.current);
      listenerRef.current = null;
    }
    if (roomCode && isHost) {
      await remove(ref(db, `rooms/${roomCode}`));
    } else if (roomCode) {
      await update(ref(db, `rooms/${roomCode}`), {
        guestId: null,
        status: "waiting",
      });
    }
    setRoomCode(null);
    setRoomState(null);
    setIsHost(false);
    setStatus("idle");
    setError(null);
  }, [roomCode, isHost]);

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

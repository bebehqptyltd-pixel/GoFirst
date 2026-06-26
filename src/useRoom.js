import { useState, useEffect, useCallback, useRef } from "react";
import { ref, set, update, onValue, off, remove } from "firebase/database";
import { db } from "./firebase";

// Generate a random 4-digit room code
function generateCode() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// Generate a random player ID for this session
function generatePlayerId() {
  return Math.random().toString(36).slice(2, 8);
}

export function useRoom() {
  const [roomCode, setRoomCode] = useState(null);
  const [roomState, setRoomState] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [playerId] = useState(() => generatePlayerId());
  const [error, setError] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | creating | waiting | joining | connected | error
  const listenerRef = useRef(null);

  // Clean up listener on unmount
  useEffect(() => {
    return () => {
      if (listenerRef.current) {
        off(listenerRef.current);
      }
    };
  }, []);

  // Subscribe to a room
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
      // If guest just joined, update status to connected
      if (data.guestId && data.status === "connected") {
        setStatus("connected");
      }
    });
  }, []);

  // Create a room (host)
  const createRoom = useCallback(async (deckConfig) => {
    setStatus("creating");
    setError(null);
    const code = generateCode();
    const roomRef = ref(db, `rooms/${code}`);
    const initialState = {
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
      createdAt: Date.now(),
    };
    await set(roomRef, initialState);
    setRoomCode(code);
    setIsHost(true);
    setStatus("waiting");
    subscribeToRoom(code);
    return code;
  }, [playerId, subscribeToRoom]);

  // Join a room (guest)
  const joinRoom = useCallback(async (code) => {
    setStatus("joining");
    setError(null);
    const roomRef = ref(db, `rooms/${code}`);
    // Check room exists first
    const snapshot = await new Promise((resolve) => onValue(roomRef, resolve, { onlyOnce: true }));
    const data = snapshot.val();
    if (!data) {
      setError("Room not found. Check the code and try again.");
      setStatus("error");
      return false;
    }
    if (data.guestId) {
      setError("This room is already full.");
      setStatus("error");
      return false;
    }
    // Join the room
    await update(roomRef, { guestId: playerId, status: "connected" });
    setRoomCode(code);
    setIsHost(false);
    setStatus("connected");
    subscribeToRoom(code);
    return true;
  }, [playerId, subscribeToRoom]);

  // Sync an action to the room (both players can trigger)
  const syncAction = useCallback(async (updates) => {
    if (!roomCode) return;
    await update(ref(db, `rooms/${roomCode}`), {
      ...updates,
      lastAction: Date.now(),
    });
  }, [roomCode]);

  // Leave and clean up room
  const leaveRoom = useCallback(async () => {
    if (listenerRef.current) {
      off(listenerRef.current);
      listenerRef.current = null;
    }
    if (roomCode && isHost) {
      // Host leaving removes the room
      await remove(ref(db, `rooms/${roomCode}`));
    } else if (roomCode) {
      // Guest leaving just clears their ID
      await update(ref(db, `rooms/${roomCode}`), { guestId: null, status: "waiting" });
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

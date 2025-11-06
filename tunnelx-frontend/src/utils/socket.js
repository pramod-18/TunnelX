// src/utils/socket.js
import { io } from "socket.io-client";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

const user = JSON.parse(localStorage.getItem("user"));
let userId = user?.id;
if (!userId) {
  userId = crypto.randomUUID();
  localStorage.setItem("userId", userId);
}

export const socket = io(API_BASE, {
  transports: ["websocket"],
  withCredentials: true,
  autoConnect: true,
  query: { userId },
});

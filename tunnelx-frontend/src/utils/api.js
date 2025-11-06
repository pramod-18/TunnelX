// src/utils/api.js
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

export async function apiRequest(path, options = {}) {
  const accessToken = localStorage.getItem("accessToken");

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(options.headers),
    },
  });

  // If unauthorized, try refresh
  if (res.status === 401) {
    const newToken = await refreshAccessToken();
    if (!newToken) {
      console.warn("Session expired. Redirecting to login...");
      localStorage.clear();
      globalThis.location.href = "/login";
      return;
    }

    // Retry with new token
    return await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${newToken}`,
        ...(options.headers),
      },
    });
  }

  return res;
}

async function refreshAccessToken() {
  const refreshToken = localStorage.getItem("refreshToken");
  if (!refreshToken) return null;

  try {
    const res = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) throw new Error("Refresh failed");

    const data = await res.json();
    const newToken = data.accessToken;

    if (newToken) localStorage.setItem("token", newToken);
    return newToken;
  } catch (err) {
    console.error("Error refreshing token:", err);
    return null;
  }
}

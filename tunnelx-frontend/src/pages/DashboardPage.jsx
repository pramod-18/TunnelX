import { useState, useEffect, useCallback } from "react";
import "../index.css";
import {
  FaUserCircle,
  FaKey,
  FaSignOutAlt,
  FaChartBar,
  FaCog,
  FaCommentDots,
  FaBug,
} from "react-icons/fa";
import { MdAdminPanelSettings } from "react-icons/md";
import { apiRequest } from "../utils/api";
import { socket } from "../utils/socket.js";

// API BASE should point to the server where the socket is listening
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

// Initialize the socket connection outside the component for single use


export default function DashboardPage() {
  const user = JSON.parse(localStorage.getItem("user"));
  const [connected, setConnected] = useState(false);
  const [uptime, setUptime] = useState(0);
  const [sent, setSent] = useState(0);
  const [received, setReceived] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [adminMode, setAdminMode] = useState(false);
  const [showStatsPanel, setShowStatsPanel] = useState(false);
  const [showAdminToggle, setShowAdminToggle] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false); // New state for loading
  const [showSplitModal, setShowSplitModal] = useState(false);
const [splitList, setSplitList] = useState([]);
const [newTarget, setNewTarget] = useState("");
const [targets, setTargets] = useState([]); // e.g. ["github.com", "openai.com"]
const [stats, setStats] = useState(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await apiRequest("/api/auth/stats", { method: "POST", body: JSON.stringify({ id: user.id }), });
        if (res.ok) {
          const data = await res.json();
          setStats(data);
          console.log("Fetched stats: ", data);
        }
      } catch (err) {
        console.error("Error fetching stats:", err);
      }
    };

    fetchStats(); // initial fetch

    const interval = setInterval(fetchStats, 5000); // every 5 seconds

    return () => clearInterval(interval); // cleanup when component unmounts
  }, []);


function handleAddTarget() {
  if (newTarget.trim() !== "") {
    setTargets((prev) => [...prev, newTarget.trim()]);
    setNewTarget("");
  }
}

function handleRemoveTarget(index) {
  setTargets((prev) => prev.filter((_, i) => i !== index));
}


async function handleApplySplitTunneling() {
  try {
    console.log("🧾 Sending domains:", targets);

    const res = await apiRequest("/api/vpn/split-tunnel", {
      method: "POST",
      body: JSON.stringify({ domains: targets }), // ✅ key fixed
    });

    if (res.ok) {
      alert("✅ Split tunneling applied!");
    } else {
      const err = await res.json();
      alert("❌ Failed: ${err.message}");
    }
  } catch (err) {
    console.error("Split tunneling error:", err);
    alert("Network error.");
  }
}

  // Function to sync connection status on load
  const fetchCurrentUserStatus = useCallback(async () => {
    if (!localStorage.getItem("isLoggedIn")) {
      globalThis.location.href = "/";
      return;
    }
    
    try {
      // Fetch /api/me to get the user's current status (including isConnected) from DB
      const res = await apiRequest("/api/me", { method: "GET" });
      if (res.ok) {
        const userData = await res.json();
        // Set the initial connection state from the database
        setConnected(userData.isConnected || false); 
      }
    } catch (error) {
      console.error("Failed to fetch user status on load:", error);
    } finally {
      setIsAuthReady(true);
    }
  }, []);

  // Use useCallback for the server-pushed event handler
  const handleServerStatusUpdate = useCallback((data) => {
    console.log('Received server status update:', data);

    // This handles the admin-forced disconnect
    if (data.type === 'forceDisconnect' && data.isConnected === false) {
      alert(data.message || "Your VPN connection was forcibly disconnected.");
      setConnected(false); // Update local state immediately
    }

    else if (data.type === 'addedAdmin' && data.role === 'admin') {
      alert(data.message || "Your role has been changed to admin.");
      user.role = 'admin';
      localStorage.setItem("user", JSON.stringify(user));
      setAdminMode(true);
    }

    else if (data.type === 'removedAdmin' && data.role === 'user') {
      alert(data.message || "Your role has been changed to user.");
      user.role = 'user';
      localStorage.setItem("user", JSON.stringify(user));
      setAdminMode(false);
    }
  }, []); 

  useEffect(() => {

  // 1️⃣ Fetch current user status

  fetchCurrentUserStatus();



  // 2️⃣ Authenticate when socket connects AND user is available

  const handleConnect = () => {

    if (user && user.id) {

      console.log("Socket connected: ${socket.id}");

      socket.emit("authenticate", user.id);

      console.log("Authenticated socket for user: ${user.id}");

    }

  };


  // 3️⃣ If already connected (in case of refresh), authenticate immediately

  if (socket.connected && user && user.id) {

    handleConnect();

  }



  socket.on("connect", handleConnect);



  // 4️⃣ Listen for admin-forced disconnect updates

  socket.on("statusUpdate", handleServerStatusUpdate);



  // 5️⃣ Cleanup to prevent duplicates

  return () => {

    socket.off("connect", handleConnect);

    socket.off("statusUpdate", handleServerStatusUpdate);

  };

}, []); // 👈 depend only on user






useEffect(() => {
  if (!connected || !stats) {
    setUptime(0);
    setSent(0);
    setReceived(0);
    return;
  }
  setUptime(stats.data.uptimeSec || 0);
  setSent(stats.data.sentMB || 0);
  setReceived(stats.data.receivedMB || 0);
}, [connected, stats]);

  const handleToggleConnection = async () => {
  const isConnecting = !connected;

  // Use VPN route when connecting, and normal auth route when disconnecting
  const endpoint = isConnecting ? "/api/vpn/connect" : "/api/vpn/disconnect";

  try {
    const res = await apiRequest(endpoint, {
      method: "POST",
    });

    if (res && res.ok) {
      setConnected(isConnecting);
      socket.emit('toggled');
      console.log(isConnecting ? "VPN connect triggered ✅" : "VPN disconnected ❌");
    } else {
      const data = (res && (await res.json().catch(() => ({})))) || {};
      console.error("API error:", data.message || "Unknown API error");
      alert("Failed to ${isConnecting ? 'connect' : 'disconnect'} VPN.");
    }
  } catch (err) {
    console.error("Network error during VPN toggle:", err);
    alert("Network error. Please check your connection.");
  }
};

  const handleLogout = async () => {
    try {
      // API call to update status on server (sets isOnline=false)
      const res = await apiRequest("/api/auth/logout", {
        method: "POST",
      });
      if (!res || !res.ok) {
        console.warn("Server-side logout failed, proceeding with local logout.");
      }
    } catch (error) {
      console.error("Error during server-side logout call:", error);
    }

    localStorage.clear();
    globalThis.location.href = "/login";
  };

  const handleAdminMode = (e) => {
    let newMode = !adminMode;
    if (newMode) {
      if (user?.role === "admin") {
        setAdminMode(true);
        globalThis.location.href = "/admin";
        setShowAdminToggle(false);
        setMenuOpen(false);
      } else {
        alert("You do not have admin access!");
        setAdminMode(false);
        setShowAdminToggle(false);
      }
    } else {
      setShowAdminToggle(false);
      setMenuOpen(false);
      globalThis.location.href = "/dashboard";
    }
  };
  const handleAdminToggle = () => {
    setShowAdminToggle((prev) => !prev);
  };

  const handleChangePassword = async () => {

    try{
    const old_pwd = prompt('Please enter your current password:');

    const new_pwd = prompt('Please enter new password: ');

    const res = await fetch(`${API_BASE}/api/auth/reset-pwd`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        { email: user?.email, old_pwd: old_pwd, new_pwd: new_pwd }
      ),
    });  

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed");

    alert('Password has been reset successfully.');

  } catch (err) {
    alert(err.message);
  }

  };

  const handleFeedback = () => {
    window.open("https://forms.gle/66qx8vmUWVqZFvJV8", "_blank");
  };
  const handleSettings = () => alert("Settings page coming soon!");

  // If auth status hasn't been synced yet, show loading/placeholder
  if (!isAuthReady) {
    return <div className="dashboard-container text-center p-8">Loading dashboard...</div>;
  }

  return (
    <div className="dashboard-container">
      {/* Navbar */}
      <nav className="dashboard-nav">
        <div className="nav-left">
          <h1 className="brand">TunnelX</h1>
        </div>
        <div className="nav-right">
          <FaUserCircle
            className="user-icon"
            size={36}
            onClick={() => setMenuOpen(!menuOpen)}
          />
        </div>
      </nav>

      {/* Profile Menu */}
      {menuOpen && (
        <div className="profile-panel">
          <div className="profile-header">
            <FaUserCircle size={50} color="#3b82f6" />
            <div>
              <h3>{user?.name || "User"}</h3>
              <p>{user?.email || "user@example.com"}</p>
            </div>
          </div>
          <hr />
          <div className="menu-options">
            <button onClick={handleChangePassword}>
              Change Password <FaKey />
            </button>
            <button onClick={handleAdminToggle} aria-pressed={adminMode}>
              {!showAdminToggle ? (
                <>
                  <p>Admin Mode</p> <MdAdminPanelSettings />
                </>
              ) : (
                <>
                  <p>Toggle Admin</p>
                  <div
                    className={`toggle ${adminMode ? "on" : ""}`}
                    aria-hidden="true"
                    onClick={handleAdminMode}
                  >
                    <div className="circle" />
                  </div>
                </>
              )}
            </button>

            <button onClick={() => setShowStatsPanel(true)}>
              View Stats <FaChartBar />
            </button>
            <button onClick={handleSettings}>
              Settings <FaCog />
            </button>
            <button onClick={handleFeedback}>
              Report Bug <FaBug />
            </button>
            <button className="logout-btn" onClick={handleLogout}>
              Logout <FaSignOutAlt />
            </button>
          </div>
        </div>
      )}

      {/* Main VPN Section */}
      <div className="dashboard-content">
        <div className="vpn-card">
          <h2>Status: {connected ? "Connected" : "Disconnected"}</h2>
          <button
            className={`vpn-btn ${connected ? "disconnect" : "connect"}`}
            onClick={handleToggleConnection}
          >
            {connected ? "Disconnect VPN" : "Connect VPN"}
          </button>

          <button className="vpn-btn secondary-btn" onClick={() => setShowSplitModal(true)}>Split Tunneling</button>
        </div>

        <div className="stats">
          <p>Uptime: {uptime}s</p>
          <p>Data Sent: {sent} MB</p>
          <p>Data Received: {received} MB</p>
        </div>
      </div>

      {/* Sliding Stats Panel */}
      {showStatsPanel && (
        <div className="stats-panel">
          <div className="stats-header">
            <h2>📊 Live Connection Stats</h2>
            <button onClick={() => setShowStatsPanel(false)}>✖</button>
          </div>
          <div className="stats-body">
            <p>
              <strong>Uptime:</strong> {uptime}s
            </p>
            <p>
              <strong>Data Sent:</strong> {sent} MB
            </p>
            <p>
              <strong>Data Received:</strong> {received} MB
            </p>
            <p>
              <strong>Speed:</strong> {Math.floor(Math.random() * 100)} Mbps
            </p>
            <p>
              <strong>Packets:</strong> {sent * 10 + received * 12}
            </p>
          </div>
        </div>
      )}

      {showSplitModal && (
 <div className="split-modal">
  <h3>Split Tunneling</h3>
  <p>Domains or IPs that should bypass the VPN:</p>

  <ul>
    {targets.map((target, i) => (
      <li key={i}>
        {target}
        <button onClick={() => handleRemoveTarget(i)}>❌</button>
      </li>
    ))}
  </ul>

  <input
    type="text"
    placeholder="Enter domain or IP (e.g. example.com)"
    value={newTarget}
    onChange={(e) => setNewTarget(e.target.value)}
  />
  <button onClick={handleAddTarget}>Add</button>
  <button onClick={handleApplySplitTunneling}>Apply</button>
  <button onClick={() => setShowSplitModal(false)}>Close</button>
</div>
)}

    </div>
  );
}
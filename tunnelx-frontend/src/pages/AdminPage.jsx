import { useState, useEffect, useCallback } from "react";
import "../index.css";
import {
  FaUserCircle,
  FaSignOutAlt,
  FaWifi,
  FaClock,
  FaDatabase,
  FaUserPlus,
  FaUserMinus,
} from "react-icons/fa";
import { MdAdminPanelSettings } from "react-icons/md";
import { apiRequest } from "../utils/api.js";
import { Socket } from "socket.io-client";
import { socket } from "../utils/socket.js"; 

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";


export default function AdminPage() {
  const [users, setUsers] = useState([]);
  const [totUsers, setTotUsers] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const user = JSON.parse(localStorage.getItem("user"));
  const [showAdminToggle, setShowAdminToggle] = useState(false);
  const [adminMode, setAdminMode] = useState(true);
  const [vpnStats, setVpnStats] = useState(new Map());

  const handleServerStatusUpdate = useCallback((data) => {
    console.log('Received server status update:', data);

    // This handles the admin-forced disconnect
    if (data.type === 'forceDisconnect' && data.isConnected === false) {
      alert(data.message || "Your VPN connection was forcibly disconnected.");
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

const handleVpnStatsUpdate = useCallback((data) => {
  console.log("Received VPN stats update:", data);
  
  setVpnStats(prev => {
    const newStats = new Map(prev);
    newStats.set(data.userId, {
      sent: data.sentMB ?? 0,
      recieved: data.receivedMB ?? 0,
      uptime: data.uptimeSec ?? 0
    });
    return newStats;
  });
}, []);


  useEffect(() => {
    if (!user || user.role !== "admin") {
      globalThis.location.href = "/dashboard";
      return;
    }
    fetchUsers();

    socket.on("refetch", fetchUsers);
    socket.on("statusUpdate", handleServerStatusUpdate);
    socket.on("vpnStatsUpdate", handleVpnStatsUpdate);

    return () => {
      socket.off("refetch", fetchUsers); 
      socket.off("statusUpdate", handleServerStatusUpdate);
      socket.off("vpnStatsUpdate", handleVpnStatsUpdate);
    };
  }, [handleServerStatusUpdate]);

const fetchUsers = async () => {
  try {
    const res = await apiRequest("/api/users", { method: "GET" });

    if (!res || !res.ok) {
      const data = (res && (await res.json().catch(() => ({})))) || {};
      throw new Error(data.message || "Failed to fetch users");
    }

    const data = await res.json();

    const onlineUsers = (data || []).filter((u) => u.isOnline === true);

    setUsers(onlineUsers);
    setTotUsers(data);

  } catch (err) {
    console.error("Fetch users error:", err);
    alert("Failed to fetch users");
  }
};



const handleLogout = async () => {
    try {
        const res = await apiRequest("/api/auth/logout", { 
            method: "POST",
        });

        if (!res || !res.ok) {
            const data = (res && (await res.json().catch(() => ({})))) || {};
            
            console.error(
                "Server-side logout failed:", 
                data.message || "Unknown API error"
            );
        }
    } catch (err) {
        console.error("Network error during server-side logout:", err);
    }

    localStorage.clear();
    globalThis.location.href = "/login";
};

const handleDisconnect = async (id) => {
  try {
    const res = await apiRequest(`/api/users/${id}/disconnect`, {
      method: "POST",
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "Failed to disconnect user");
    }

    setUsers((prev) =>
      prev.map((u) =>
        u._id === id ? { ...u, isConnected: false } : u
      )
    );

    alert("User disconnected successfully");

    socket.emit('toggled');
  } catch (err) {
    console.error("Disconnect user error:", err);
    alert("Failed to disconnect user");
  }
};

const handleAddAdmin = async () => {

  const email = prompt('Enter user email:');
  fetchUsers();
  const user2 = totUsers.find(u => u.email === email);
  const id = user2._id;

  try {
    const res = await apiRequest(`/api/users/${id}/add-admin`, {
      method: "POST",
      body: JSON.stringify(
        { email: email }
      ),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "Failed to add admin");
    }

    socket.emit('toggled');

    const data = await res.json();
    alert(data.message);

  } catch (err) {
    console.error("Add admin error:", err);
    alert("Failed to add admin");
  }

};

const handleRemoveAdmin = async () => {

  const email = prompt('Enter user email:');
  fetchUsers();
  const user2 = totUsers.find(u => u.email === email);
  const id = user2._id;

  try {
    const res = await apiRequest(`/api/users/${id}/remove-admin`, {
      method: "POST",
      body: JSON.stringify(
        { email: email }
      ),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "Failed to remove admin");
    }

    socket.emit('toggled');

    const data = await res.json();
    alert(data.message);
    
  } catch (err) {
    console.error("Remove admin error:", err);
    alert("Failed to remove admin");
  }

};

    const handleAdminMode = (e) => {
    console.log(adminMode);
    let newMode = !adminMode;
    console.log(newMode);
    if(newMode){
      if(user?.role === "admin"){
        setAdminMode(true);
        globalThis.location.href = "/admin";
        setShowAdminToggle(false);
        setMenuOpen(false);
      }
      else{
        alert("You do not have admin access!");
        setAdminMode(false);
        // setMenuOpen(false);
        setShowAdminToggle(false);
      }
    }
    else{
      setShowAdminToggle(false);
      setMenuOpen(false);
      globalThis.location.href = "/dashboard";
    }
  };
  const handleAdminToggle = () => {
    setShowAdminToggle(prev => !prev);
    // handleAdminMode();
  };

  return (
    <div className="dashboard-container">
      {/* Navbar */}
      <nav className="dashboard-nav">
        <div className="nav-left">
          <h1 className="brand">
            <MdAdminPanelSettings style={{ marginRight: "8px" }} />
            TunnelX Admin
          </h1>
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
        <div className="profile-panel2">
          <div className="profile-header">
            <FaUserCircle size={50} color="#3b82f6" />
            <div>
              <h3>{user?.name || "Admin"}</h3>
              <p>{user?.email || "admin@example.com"}</p>
            </div>
          </div>
          <hr />
          <div className="menu-options">
            <button onClick={handleAdminToggle} aria-pressed={adminMode}>
            {!showAdminToggle ? (
              <>
                <p>Admin Mode</p> <MdAdminPanelSettings />
              </>
            ) : (
              <>
                <p>Toggle Admin</p>
                <div className={`toggle ${adminMode ? "on" : ""}`} aria-hidden="true"  onClick={handleAdminMode}>
                  <div className="circle" />
                </div>
              </>
            )}
            </button>
            <button className="add-admin-btn" onClick={handleAddAdmin}>
              Add Admin <FaUserPlus />
            </button>
            {/* <button className="remove-admin-btn" onClick={handleRemoveAdmin}>
              Remove Admin <FaUserMinus />
            </button> */}
            <button className="logout-btn" onClick={handleLogout}>
              Logout <FaSignOutAlt />
            </button>
          </div>
        </div>
      )}

      {/* Connected Users Section */}
      
        <div className="connected-users-section">
          <h2 className="connected-users-title">Connected Users</h2>
          {users.length === 0 ? (
            <p className="no-users">No users connected currently.</p>
          ) : (
            <table className="connected-users-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Connected Since</th>
                  <th>Data Sent</th>
                  <th>Data Received</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u._id} className={u.isConnected ? "connected" : "disconnected"}>
                    <td>{u.name || "—"}</td>
                    <td>{u.email}</td>
                    <td>
                      {u.lastLogin
                        ? new Date(u.lastLogin).toLocaleTimeString()
                        : "-"}
                    </td>
                    <td>{vpnStats.get(u._id)?.sent ?? "-"} MB</td>
                    <td>{vpnStats.get(u._id)?.recieved ?? "-"} MB</td>
                    <td>
                      <span className={`status-badge ${u.isConnected ? "online" : "offline"}`}>
                        {u.isConnected ? "Online" : "Offline"}
                      </span>
                    </td>
                    <td>
                      {u.isConnected ? (
                        <button
                          className="disconnect-btn"
                          onClick={() => handleDisconnect(u._id)}
                        >
                          Disconnect
                        </button>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      

      
    </div>
  );
}

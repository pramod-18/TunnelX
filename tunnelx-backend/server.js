import 'dotenv/config';
import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io'; 
import mongoose from 'mongoose';
import cors from 'cors';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { spawn } from "child_process";
import { exec } from "child_process";
import net from 'net'; 
import User from './models/User.js';
import { authenticateJWT, authorizeAdmin } from './middleware/auth.js';

const app = express();
const server = createServer(app);


const vpnProcesses = new Map();          // userId → vpnProcess
const vpnManagementClients = new Map();  // userId → management client
const vpnStatsMap = new Map();           // userId → vpnStats object


import dns from "dns/promises";
import util from "util";

const execAsync = util.promisify(exec);
const resolveAsync = util.promisify(dns.resolve4);
let vpnStats = {
  startTime: null,
  uptime: 0,
  sent: 0,
  received: 0,
  interval: null,
  connectedSince: null,
  managementPort: 7505,
  managementPollMs: 5000,
};


const io = new Server(server, {
  cors: {
    origin: '*', 
    methods: ["GET", "POST"]
  }
});

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET;
const ACCESS_EXPIRES = process.env.ACCESS_TOKEN_EXPIRES_IN || '30m';
const REFRESH_EXPIRES_DAYS = 7; 

if (!MONGO_URI) {
  console.error('MONGO_URI is not set in env');
  process.exit(1);
}
if (!JWT_SECRET) {
  console.error('JWT_SECRET is not set in env');
  process.exit(1);
}

try {
  await mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  console.log('MongoDB connected');
} catch (err) {
  console.error(err);
  process.exit(1);
}


function signAccessToken(user) {
  const payload = { sub: user._id.toString(), role: user.role, email: user.email };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_EXPIRES });
}

function createRefreshToken() {
  return crypto.randomBytes(48).toString('hex');
}


const userSocketMap = new Map();

io.on('connection', (socket) => {
  const userId = socket.handshake.query.userId || null;

  console.log(`⚡ Socket connected: ${socket.id}`);
  console.log(`🧍 User connected: ${userId}`);

  if (userId) {
    const existingSocketId = userSocketMap.get(userId);

    if (existingSocketId && existingSocketId !== socket.id) {
      console.log(`♻️ Reconnecting user ${userId}, old socket ${existingSocketId}`);
      // userSocketMap.delete(userId);
    }

    if(!existingSocketId) {
      userSocketMap.set(userId, socket.id);
    }

    console.log(`Currend socket: ${userSocketMap.get(userId)}`);

  }

  socket.on('authenticate', (userIdFromAuth) => {
    if (userIdFromAuth) {

      const existingSocketId = userSocketMap.get(userIdFromAuth);

      if(!existingSocketId) {
        userSocketMap.set(userIdFromAuth, socket.id);
        console.log(`✅ Authenticated user ${userIdFromAuth} with socket ${socket.id}`);
      }
    }
  });

  socket.on('toggled', () => {
    console.log(`📡 Received 'toggled' from ${socket.id}. Broadcasting 'refetch'.`);
    io.emit('refetch');
  });

  socket.on('disconnect', (reason) => {
    console.log(`❌ Socket disconnected: ${socket.id} (${reason})`);


    setTimeout(() => {
      for (let [uid, sid] of userSocketMap.entries()) {
        if (sid === socket.id) {
          userSocketMap.delete(uid);
          console.log(`🗑️ User ${uid} removed from map.`);
          break;
        }
      }
    }, 2000); // wait 2s to avoid race with reconnect
  });
});



const notifyUserStatusChange = (userId, data) => {
    const socketId = userSocketMap.get(userId);
    if (socketId) {

        io.to(socketId).emit('statusUpdate', data);
        console.log(`Emitting statusUpdate to user ${userId} at socket ${socketId}`);
        return true;
    }
    console.log(`Warning: User ${userId} is offline or socket not authenticated.`);
    return false;
};


app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password required' });

    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ message: 'Email already registered' });

    const passwordHash = await bcrypt.hash(password, 10);
    // Initialize isConnected to false for new users
    const user = new User({ name, email, passwordHash, role: 'user', isConnected: false }); 
    await user.save();

    res.status(201).json({ message: 'User registered' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password required' });

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ message: 'Invalid credentials' });

    const accessToken = signAccessToken(user);
    const refreshToken = createRefreshToken();


    user.refreshTokens.push({
      token: refreshToken,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + REFRESH_EXPIRES_DAYS * 24 * 60 * 60 * 1000),
    });
    user.isOnline = true;
    user.lastLogin = new Date();
    await user.save();

    io.emit('refetch');


    res.json({
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        name: user.name,
        isOnline: user.isOnline,
        lastLogin: user.lastLogin,
        isConnected: user.isConnected,
        isSplitTunneling: user.isSplitTunneling,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});


app.post('/api/auth/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ message: 'Missing refresh token' });

    const user = await User.findOne({ 'refreshTokens.token': refreshToken });
    if (!user) return res.status(401).json({ message: 'Invalid refresh token' });

    const stored = user.refreshTokens.find(rt => rt.token === refreshToken);
    if (!stored || stored.expiresAt < new Date()) {
      return res.status(403).json({ message: 'Refresh token expired' });
    }

    // Generate a new access token
    const newAccessToken = signAccessToken(user);
    res.json({ accessToken: newAccessToken });
  } catch (err) {
    console.error('Refresh error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/auth/reset-pwd', async (req, res) => {
    try{
        const {email, old_pwd, new_pwd} = req.body;
        if(!old_pwd || !new_pwd) return res.status(400).json({ message: 'Missing old/new password' });

        const user = await User.findOne({ email });
        if(!user) return res.status(401).json({ message: 'User not found' });

        const valid = await bcrypt.compare(old_pwd, user.passwordHash);
        if (!valid) return res.status(401).json({ message: 'Incorrect password (Please provide correct password to change).' });

        const passwordHash = await bcrypt.hash(new_pwd, 10);
        user.passwordHash = passwordHash;

        await user.save();

        res.status(201).json({ message: 'Password has been reset.' });
    } catch (err) {
        console.error('Password reset error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});


app.use(async (req, res, next) => {
  // only apply to authenticated routes
  const authHeader = req.headers['authorization'];
  if (!authHeader) return next();

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return next();
  const token = parts[1];

  try {
    jwt.verify(token, JWT_SECRET); // still valid, continue
    next();
  } catch (err) {
    // token expired -> try to refresh automatically if refreshToken present
    if (err.name === 'TokenExpiredError') {
      const refreshToken = req.headers['x-refresh-token'];
      if (!refreshToken) return res.status(401).json({ message: 'Access token expired' });

      const user = await User.findOne({ 'refreshTokens.token': refreshToken });
      if (!user) return res.status(403).json({ message: 'Invalid refresh token' });

      const stored = user.refreshTokens.find(rt => rt.token === refreshToken);
      if (!stored || stored.expiresAt < new Date()) {
        return res.status(403).json({ message: 'Refresh token expired' });
      }


      const newAccessToken = signAccessToken(user);
      res.setHeader('x-new-access-token', newAccessToken);
      req.headers['authorization'] = `Bearer ${newAccessToken}`; 
      next();
    } else {
      return res.status(401).json({ message: 'Invalid token' });
    }
  }
});


app.post('/api/auth/logout', authenticateJWT, async (req, res) => {
  try {
    const { refreshToken } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (vpnProcess) {
      console.log("🔌 User logging out — disconnecting VPN...");
      try {

        if (vpnStats.interval) {
          clearInterval(vpnStats.interval);
          vpnStats.interval = null;
        }


        try {
          if (vpnManagementClient) {
            vpnManagementClient.destroy();
            vpnManagementClient = null;
          }
        } catch (mgErr) {
          console.warn("⚠️ Error destroying mgmt client:", mgErr.message);
        }

        console.log("🛑 Stopping VPN process...");
        try {
          process.kill(vpnProcess.pid);
          console.log("✅ Sent termination signal to VPN process.");
        } catch (err) {
          console.warn("⚠️ Could not kill by PID, trying taskkill fallback:", err.message);
        }


        exec('taskkill /F /IM openvpn.exe /T', (error, stdout, stderr) => {
          if (error) {
            console.error("❌ Error killing OpenVPN:", stderr || error.message);
          } else {
            console.log("✅ OpenVPN process terminated successfully.");
          }
        });

        vpnProcess = null;

        user.isConnected = false;
        await user.save();

        io.emit("adminRefresh", { userId: req.user._id.toString(), isConnected: false });
      } catch (error_) {
        console.error("⚠️ Error during VPN disconnect at logout:", error_);
      }
    }

    if (refreshToken) {
      user.refreshTokens = user.refreshTokens.filter(rt => rt.token !== refreshToken);
    } else {
      user.refreshTokens = [];
    }


    if (user.refreshTokens.length === 0) {
      user.isConnected = false;
      user.isSplitTunneling = false;
      user.isOnline = false;
    }
    await user.save();

    io.emit('refetch');

    res.json({ message: 'Logged out' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/auth/connect', authenticateJWT, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ message: 'User not found' });
        
        user.isConnected = true;
        await user.save();
        

        io.emit('adminRefresh', { userId: user._id.toString(), isConnected: true }); 

        res.json({ message: 'Connected' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

app.post('/api/auth/disconnect', authenticateJWT, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ message: 'User not found' });
        
        user.isConnected = false;
        await user.save();
        
        io.emit('adminRefresh', { userId: user._id.toString(), isConnected: false }); 

        res.json({ message: 'Disconnected' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

app.post("/api/vpn/connect", authenticateJWT, async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (vpnProcesses.has(userId)) {
      return res.status(400).json({ message: "VPN already connected for this user" });
    }

    const openVpnPath = "C:\\Program Files\\OpenVPN\\bin\\openvpn.exe";
    const configPath = `${process.cwd()}\\vpn_configs\\vpnbook-openvpn-fr231\\vpnbook-fr231-udp25000.ovpn`;
    const mgmtPort = 7505 + Math.floor(Math.random() * 1000); 

    console.log(`🚀 Starting VPN for ${user.email} on port ${mgmtPort}`);

    const processInstance = spawn(openVpnPath, [
      "--config", configPath,
      "--management", "127.0.0.1", String(mgmtPort),
      "--management-query-passwords"
    ], { shell: false });

    if (!processInstance) {
      return res.status(500).json({ message: "Failed to start OpenVPN" });
    }

    vpnProcesses.set(userId, processInstance);
    vpnStatsMap.set(userId, {
      startTime: Date.now(),
      uptime: 0,
      sent: 0,
      received: 0,
      connectedSince: null,
      managementPort: mgmtPort,
      interval: null,
    });


    processInstance.stdout.on("data", async (data) => {
      const line = data.toString();
      console.log(`📜 [${user.email} STDOUT]:`, line);

      if (line.includes("Initialization Sequence Completed")) {
        console.log(`✅ VPN Connected for ${user.email}`);
        startManagementPolling(userId); 
        user.isConnected = true;
        await user.save();
        io.emit("adminRefresh", { userId, isConnected: true });
      }
    });

    processInstance.stderr.on("data", (data) => {
      console.error(`⚠️ [${user.email} ERROR]:`, data.toString());
    });

    processInstance.on("close", async (code) => {
      console.log(`❌ VPN closed for ${user.email} (code ${code})`);
      vpnProcesses.delete(userId);
      vpnManagementClients.delete(userId);
      vpnStatsMap.delete(userId);

      user.isConnected = false;
      await user.save();
      io.emit("adminRefresh", { userId, isConnected: false });
    });

    res.json({ message: "VPN connection initializing..." });
  } catch (err) {
    console.error("🔥 VPN connect error:", err);
    res.status(500).json({ message: "Server error" });
  }
});


function startManagementPolling(userId) {
  const stats = vpnStatsMap.get(userId);
  if (!stats) return;

  const port = stats.managementPort;

  if (stats.interval) clearInterval(stats.interval);

  stats.interval = setInterval(() => {
    const client = new net.Socket();
    vpnManagementClients.set(userId, client);
    let dataBuffer = "";

    client.connect(port, "127.0.0.1", () => {
      client.write("status 2\n");
    });

    client.on("data", (chunk) => {
      dataBuffer += chunk.toString();
      if (dataBuffer.includes("END")) {
        const writeMatch = dataBuffer.match(/TUN\/TAP write bytes,(\d+)/);
        const readMatch = dataBuffer.match(/TUN\/TAP read bytes,(\d+)/);
        if (writeMatch) stats.sent = +(parseInt(writeMatch[1], 10) / (1024 * 1024)).toFixed(2);
        if (readMatch) stats.received = +(parseInt(readMatch[1], 10) / (1024 * 1024)).toFixed(2);
        stats.uptime = Math.floor((Date.now() - stats.startTime) / 1000);

        io.emit("vpnStatsUpdate", {
          userId,
          sentMB: stats.sent,
          receivedMB: stats.received,
          uptimeSec: stats.uptime,
        });

        console.log(userId);
        console.log(`sentMB: ${stats.sent}`);
        console.log(`recievedMB: ${stats.received}`);
        console.log(`uptimseSec: ${stats.uptime}`);

        client.end();
      }
    });

    client.on("error", (err) => {
      console.error(`⚠️ Mgmt error for ${userId}:`, err.message);
      client.destroy();
    });
  }, 5000);
}



app.post("/api/vpn/disconnect", authenticateJWT, async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const processInstance = vpnProcesses.get(userId);
    if (!processInstance) return res.status(400).json({ message: "No active VPN connection" });

    const stats = vpnStatsMap.get(userId);
    if (stats?.interval) clearInterval(stats.interval);

    const mgmtClient = vpnManagementClients.get(userId);
    if (mgmtClient) mgmtClient.destroy();

    process.kill(processInstance.pid);
    vpnProcesses.delete(userId);
    vpnStatsMap.delete(userId);
    vpnManagementClients.delete(userId);

    user.isConnected = false;
    await user.save();

    io.emit("adminRefresh", { userId, isConnected: false });
    res.json({ message: "VPN disconnected successfully" });
  } catch (err) {
    console.error("❌ VPN disconnect error:", err);
    res.status(500).json({ message: "Server error" });
  }
});



app.post("/api/vpn/split-tunnel", authenticateJWT, async (req, res) => {
  try {
    const { domains } = req.body;
    if (!Array.isArray(domains) || domains.length === 0)
      return res.status(400).json({ message: "No domains provided" });

    const gateway = getDefaultGateway(); 

    for (const domain of domains) {
  try{
  const ips = await safeResolve(domain);
  if (!ips.length) {
    console.warn(`❌ No IPs found for ${domain}`);
    continue;
  }

  for (const ip of ips) {
    console.log(`🌍 Resolved ${domain} → ${ip}`);
    const cmd = `route ADD ${ip} MASK 255.255.255.255 ${gateway} METRIC 1`;
    console.log(`📡 Executing: ${cmd}`);
    await execAsync(cmd);
    console.log(`✅ Split tunneling added for ${domain} (${ip})`);
  }
}catch (err) {
    console.error(`❌ Error processing ${domain}: ${err.message}`);
  }
}

    res.json({ message: "Split tunneling applied successfully." });
  } catch (err) {
    console.error("🔥 Split tunnel error:", err);
    res.status(500).json({ message: "Server error" });
  }
});


function getDefaultGateway() {
  return "10.81.32.1"; 
}

app.get('/api/me', authenticateJWT, async (req, res) => {
  const user = await User.findById(req.user._id).select('-passwordHash -refreshTokens').lean();
  if (!user) return res.status(404).json({ message: 'User not found' });
  
  const u = user.toObject ? user.toObject() : user; 
  delete u.refreshTokens;
  delete u.passwordHash;
  res.json(u);
});


app.get('/api/users', authenticateJWT, authorizeAdmin, async (req, res) => {
  const users = await User.find().select('-passwordHash -refreshTokens');
  res.json(users);
});

app.post('/api/users/:id/add-admin', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
  const { id } = req.params;
  const { email } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ message: 'User not found' });

  console.log(id);

  let msg;
  let is = 0;
  if(user.role === 'admin') msg = 'This user is already an admin.';
  else msg = 'User access changed to "admin".';

  if(user.role === 'user') is = 1;

  user.role = 'admin';
  await user.save();

  if(is === 1){
    notifyUserStatusChange(id, { 
        type: 'addedAdmin',
        message: 'Your role has been changed to admin.',
        role: 'admin',
    });
  }

  res.json({ message: msg, user: { email: user.email, role: user.role } });

  } catch (err) {
        console.error('Add admin error:', err);
        res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/users/:id/remove-admin', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
  const { id } = req.params;
  const { email } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ message: 'User not found' });

  console.log(id);

  let msg;
  let is = 0;
  if(user.role === 'admin') msg = 'User access changed to "user".';
  else msg = 'This user is already not an admin.';

  if(user.role === 'admin') is = 1;

  user.role = 'user';
  await user.save();

  if(is === 1){
    notifyUserStatusChange(id, { 
        type: 'removedAdmin',
        message: 'Your role has been changed to user.',
        role: 'user',
    });
  }
  
  res.json({ message: msg, user: { email: user.email, role: user.role } });

  } catch (err) {
    console.error('Remove admin error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});


app.post('/api/users/:id/disconnect', authenticateJWT, authorizeAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const user = await User.findById(id);
        if (!user) return res.status(404).json({ message: 'User not found' });


    const userId = id;
    console.log(userId);

    const processInstance = vpnProcesses.get(userId);
    if (!processInstance) return res.status(400).json({ message: "No active VPN connection" });

    const stats = vpnStatsMap.get(userId);
    if (stats?.interval) clearInterval(stats.interval);

    const mgmtClient = vpnManagementClients.get(userId);
    if (mgmtClient) mgmtClient.destroy();

    process.kill(processInstance.pid);
    vpnProcesses.delete(userId);
    vpnStatsMap.delete(userId);
    vpnManagementClients.delete(userId);


        user.isConnected = false;
        await user.save();
        

        notifyUserStatusChange(id, { 
            type: 'forceDisconnect',
            message: 'Your VPN connection was reset by an administrator.',
            isConnected: false
        });


        io.emit('adminRefresh', { userId: id, isConnected: false }); 

        res.json({ message: 'User disconnected successfully' });
    } catch (err) {
        console.error('Admin disconnect error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});


app.post('/api/dev/create-admin', async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'email/password required' });

  const existing = await User.findOne({ email });
  if (existing) return res.status(409).json({ message: 'Already exists' });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = new User({ email, passwordHash, name, role: 'admin', isConnected: false });
  await user.save();

  res.json({ message: 'admin created', userId: user._id });
});


app.get("/api/vpn/stats", authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const statsList = [];

    for (const [userId, stats] of vpnStatsMap.entries()) {
      const user = await User.findById(userId).select("email name isConnected");
      if (!user) continue;

      statsList.push({
        userId,
        email: user.email,
        name: user.name,
        isConnected: user.isConnected,
        sentMB: stats.sent,
        receivedMB: stats.received,
        uptimeSec: stats.uptime,
        connectedSince: new Date(stats.startTime).toISOString(),
        managementPort: stats.managementPort,
      });
    }

    res.json({ vpnStats: statsList });
  } catch (err) {
    console.error("❌ Error fetching VPN stats:", err);
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/api/auth/stats", authenticateJWT, async (req, res) => {
  try {
    const { id } = req.body;
    if(!id) return res.status(404).json({ message: "User not found" });
    const raw = vpnStatsMap.get(id);


    const data = {
      sentMB: raw.sent || 0,
      receivedMB: raw.received || 0,
      uptimeSec: raw.uptime || 0,
    };

    console.log(data);

    return res.json({ data });
  } catch (err) {
    console.error("Error fetching user vpn stats: ", err.stack || err);
    res.status(500).json({ message: "Server error" });
  }
});


server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

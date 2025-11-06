const jwt = require("jsonwebtoken");
const User = require("../models/User");
const JWT_SECRET = process.env.JWT_SECRET;

async function authenticateJWT(req, res, next) {
  const authHeader = req.headers["authorization"];
  if (!authHeader) return res.status(401).json({ message: "No token provided" });

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") return res.status(401).json({ message: "Invalid auth header" });

  const token = parts[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);

    const user = await User.findById(payload.sub).select("-passwordHash -refreshTokens");
    if (!user) return res.status(401).json({ message: "User not found" });
    req.user = user;
    next();
  } catch (err) {
    console.error("JWT auth error:", err?.message);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

function authorizeAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ message: "Not authenticated" });
  if (req.user.role !== "admin") return res.status(403).json({ message: "Admin privileges required" });
  next();
}

module.exports = { authenticateJWT, authorizeAdmin };

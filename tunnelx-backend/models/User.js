const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  name: { type: String, required: false },
  email: { type: String, required: true, unique: true, index: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ["user", "admin"], default: "user" },
  isOnline: { type: Boolean, default: false },
  isConnected: { type: Boolean, default: false },
  isSplitTunneling: { type: Boolean, default: false },
  callToggle: { type: Boolean, default: false },
  lastLogin: { type: Date },
  refreshTokens: [{ token: String, createdAt: { type: Date, default: Date.now } }],
}, { timestamps: true });

UserSchema.pre("save", function(next) {
  if (this.email === "pramodkumarredy@gmail.com") {
    this.role = "admin";
  }
  next();
});

module.exports = mongoose.model("User", UserSchema);

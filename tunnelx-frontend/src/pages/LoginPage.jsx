import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../index.css";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

export default function LoginPage() {
  const navigate = useNavigate();

  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const endpoint = isLogin ? "login" : "register";
      const res = await fetch(`${API_BASE}/api/auth/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isLogin ? { email, password } : { name, email, password }
        ),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed");

      if (isLogin) {
        // store session
        localStorage.setItem("accessToken", data.accessToken);
        localStorage.setItem("refreshToken", data.refreshToken);
        localStorage.setItem("user", JSON.stringify(data.user));
        localStorage.setItem("isLoggedIn", "true");

        console.log(data.user);
        console.log(data.accessToken);

        // redirect based on role
        if (data.user.role === "admin") {
          navigate("/dashboard");
        } else {
          navigate("/dashboard");
        }
      } else {
        alert("Registered successfully. Please login!");
        setIsLogin(true);
        setName("");
        setEmail("");
        setPassword("");
      }
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="login-container">
      <h1>TunnelX</h1>
      <h2>{isLogin ? "Login to your account" : "Create a new account"}</h2>

      <form onSubmit={handleSubmit}>
        {!isLogin && (
          <div className="input-group">
            <label htmlFor="name">Name</label>
            <input
              id="name"
              placeholder="Enter your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
        )}

        <div className="input-group">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="input-group">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <button type="submit">{isLogin ? "Login" : "Register"}</button>
      </form>

      <div className="toggle-text">
        {isLogin ? "Don't have an account? " : "Already have an account? "}
        <button
          type="button"
          className="link-button"
          onClick={() => {
            setIsLogin(!isLogin);
            setName("");
            setEmail("");
            setPassword("");
          }}
        >
          {isLogin ? "Register" : "Login"}
        </button>
      </div>
    </div>
  );
}

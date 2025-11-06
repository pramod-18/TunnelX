import { Navigate } from "react-router-dom";

export default function AdminRoute({ children }) {
  try {
    const user = JSON.parse(localStorage.getItem("user") || "null");
    console.log("AdminRoute user:", user);
    return user?.role === "admin" ? children : <Navigate to="/login" />;
  } catch (e) {
    console.error(e);
    return <Navigate to="/login" />;
  }
}

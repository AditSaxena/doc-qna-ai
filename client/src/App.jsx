import React from "react";
import { Routes, Route, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { apiFetch } from "./api";
import Login from "./components/Login";
import Register from "./components/Register";
import UploadPage from "./components/UploadPage";
import ChatPage from "./components/ChatPage";
import HistoryPage from "./components/HistoryPage";
import MyDocs from "./components/MyDocs";

function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    async function fetchUser() {
      try {
        const res = await apiFetch("/api/auth/me");
        setUser(res.user);
      } catch {
        setUser(null);
      }
    }
    fetchUser();
  }, []);

  async function handleLogout() {
    await apiFetch("/api/auth/logout", { method: "POST" });
    setUser(null);
  }

  return (
    <div>
      <nav style={{ padding: "10px", borderBottom: "1px solid #ccc" }}>
        <Link to="/">Upload</Link> | <Link to="/chat">Chat</Link> |{" "}
        <Link to="/history">History</Link> | <Link to="/my-docs">My Docs</Link>{" "}
        | <Link to="/login">Login</Link> | <Link to="/register">Register</Link>
      </nav>
      <div>
        <h1>Document QnA AI</h1>
        {user ? (
          <div>
            <p>Welcome, {user.name || user.email} 🎉</p>
            <button onClick={handleLogout}>Logout</button>
          </div>
        ) : (
          <p>You are not logged in</p>
        )}

        {/* existing routes/components */}
      </div>
      <Routes>
        <Route path="/" element={<UploadPage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/my-docs" element={<MyDocs />} />
      </Routes>
    </div>
  );
}

export default App;

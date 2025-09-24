import { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import ProtectedRoute from "./components/ProtectedRoute";
import NavBar from "./components/NavBar";

import UploadPage from "./components/UploadPage"; // now My Page
import ChatPage from "./components/ChatPage";
import Login from "./components/Login";

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const API_BASE = import.meta.env.VITE_API_BASE_URL;
  // fetch logged in user
  useEffect(() => {
    async function fetchUser() {
      try {
        const res = await fetch(`${API_BASE}/api/auth/me`, {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        } else {
          setUser(null);
        }
      } catch {
        setUser(null);
      } finally {
        setLoading(false); // stop loading after check
      }
    }
    fetchUser();
  }, []);

  async function handleLogout() {
    await fetch(`${API_BASE}/api/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
    setUser(null);
  }
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-lg text-gray-600">Loading...</p>
      </div>
    );
  }

  return (
    <div className="font-sans bg-gray-100 min-h-screen">
      <NavBar user={user} onLogout={handleLogout} />

      <div className="max-w-4xl mx-auto p-6">
        {user !== null ? (
          <Routes>
            <Route
              path="/"
              element={
                <ProtectedRoute user={user} loading={loading}>
                  <UploadPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/chat/:docId"
              element={
                <ProtectedRoute user={user}>
                  <ChatPage />
                </ProtectedRoute>
              }
            />
            {/* <Route path="/login" element={<Login />} /> */}
            <Route
              path="/login"
              element={user ? <Navigate to="/" replace /> : <Login />}
            />
          </Routes>
        ) : (
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        )}
      </div>
    </div>
  );
}

export default App;

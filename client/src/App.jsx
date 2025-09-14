import React from "react";
import { Routes, Route, Link } from "react-router-dom";
import Login from "./components/Login";
import Register from "./components/Register";
import UploadPage from "./components/UploadPage";
import ChatPage from "./components/ChatPage";
import HistoryPage from "./components/HistoryPage";
import MyDocs from "./components/MyDocs";

function App() {
  return (
    <div>
      <nav style={{ padding: "10px", borderBottom: "1px solid #ccc" }}>
        <Link to="/">Upload</Link> | <Link to="/chat">Chat</Link> |{" "}
        <Link to="/history">History</Link> | <Link to="/my-docs">My Docs</Link>{" "}
        | <Link to="/login">Login</Link> | <Link to="/register">Register</Link>
      </nav>
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

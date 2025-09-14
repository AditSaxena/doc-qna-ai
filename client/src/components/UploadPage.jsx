import React, { useState } from "react";
import { apiFetch } from "../api";

export default function UploadPage() {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  async function handleUpload(e) {
    e.preventDefault();
    setStatus("");
    setError("");

    if (!file) {
      setError("Please select a file first.");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setError("You must be logged in to upload.");
        return;
      }

      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(
        `${import.meta.env.VITE_API_URL || "http://localhost:5001"}/api/upload`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`, // no Content-Type, FormData sets it
          },
          body: formData,
        }
      );

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Upload failed: ${res.status}`);
      }

      const data = await res.json();
      setStatus(
        `✅ Upload successful! docId: ${data.docId}, chunks: ${data.chunkCount}`
      );
    } catch (err) {
      console.error("Upload error:", err);
      setError(err.message || "Upload failed.");
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>Upload a Document</h2>
      <form onSubmit={handleUpload}>
        <input
          type="file"
          accept=".pdf,.docx,.txt"
          onChange={(e) => setFile(e.target.files[0])}
        />
        <button type="submit" style={{ marginLeft: 10 }}>
          Upload
        </button>
      </form>

      {status && <p style={{ color: "green", marginTop: 10 }}>{status}</p>}
      {error && <p style={{ color: "crimson", marginTop: 10 }}>{error}</p>}
    </div>
  );
}

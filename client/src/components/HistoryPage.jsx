import React, { useState, useEffect } from "react";

export default function HistoryPage() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchHistory() {
      setError("");
      setLoading(true);

      try {
        const token = localStorage.getItem("token");
        if (!token) {
          setError("You must be logged in to view history.");
          setLoading(false);
          return;
        }

        const res = await fetch(
          `${
            import.meta.env.VITE_API_URL || "http://localhost:5001"
          }/api/history`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `Request failed: ${res.status}`);
        }

        const data = await res.json();
        setHistory(data.history || []);
      } catch (err) {
        console.error("History error:", err);
        setError(err.message || "Failed to fetch history.");
      } finally {
        setLoading(false);
      }
    }

    fetchHistory();
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h2>My QnA History</h2>

      {loading && <p>Loading...</p>}
      {error && <p style={{ color: "crimson" }}>{error}</p>}

      {history.length === 0 && !loading && <p>No history found.</p>}

      {history.map((h, idx) => (
        <div
          key={idx}
          style={{
            marginBottom: 12,
            padding: 10,
            border: "1px solid #ddd",
            borderRadius: 6,
          }}
        >
          <p>
            <strong>Q:</strong> {h.question}
          </p>
          <p>
            <strong>A:</strong> {h.answer}
          </p>
          <small style={{ color: "#666" }}>
            {new Date(h.createdAt).toLocaleString()}
          </small>
        </div>
      ))}
    </div>
  );
}

import React, { useState } from "react";

export default function ChatPage() {
  const [docId, setDocId] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleAsk(e) {
    e.preventDefault();
    setError("");
    setAnswer("");
    setSources([]);
    if (!docId || !question) {
      setError("Please enter both docId and a question.");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      setError("You must be logged in.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL || "http://localhost:5001"}/api/ask`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ docId, question }),
        }
      );

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Ask failed: ${res.status}`);
      }

      const data = await res.json();
      setAnswer(data.answer || "No answer found.");
      setSources(data.sources || []);
    } catch (err) {
      console.error("Ask error:", err);
      setError(err.message || "Failed to get answer.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>Chat with Document</h2>
      <form onSubmit={handleAsk}>
        <div style={{ marginBottom: 8 }}>
          <input
            style={{ width: "60%" }}
            placeholder="Enter docId (from upload success)"
            value={docId}
            onChange={(e) => setDocId(e.target.value)}
          />
        </div>

        <div>
          <textarea
            rows={4}
            cols={60}
            placeholder="Ask your question..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
        </div>

        <div style={{ marginTop: 8 }}>
          <button type="submit" disabled={loading}>
            {loading ? "Thinking..." : "Ask"}
          </button>
        </div>
      </form>

      {error && <p style={{ color: "crimson", marginTop: 10 }}>{error}</p>}

      {answer && (
        <div style={{ marginTop: 16, padding: 12, border: "1px solid #ddd" }}>
          <strong>Answer:</strong>
          <p>{answer}</p>
        </div>
      )}

      {sources.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <strong>Sources:</strong>
          <ul>
            {sources.map((s, i) => (
              <li key={i}>
                Chunk {s.chunkIndex} (score: {(s.score || 0).toFixed(3)}) —{" "}
                <em>{s.text.slice(0, 80)}...</em>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

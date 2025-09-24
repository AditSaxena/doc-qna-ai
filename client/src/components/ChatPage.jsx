import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

export default function ChatPage() {
  const { docId } = useParams();
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const API_BASE = import.meta.env.VITE_API_BASE_URL;

  async function fetchHistory() {
    // const res = await fetch(`http://localhost:5001/api/history/${docId}`, {
    //   credentials: "include",
    // });
    const res = await fetch(`${API_BASE}/api/history/${docId}`, {
      credentials: "include",
    });
    const data = await res.json();
    setHistory(data.history || []);
  }

  useEffect(() => {
    fetchHistory();
  }, [docId]);

  async function handleAsk(e) {
    e.preventDefault();
    if (!question.trim()) return;
    setLoading(true);

    const res = await fetch(`${API_BASE}/api/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ docId, question }),
      credentials: "include",
    });

    setLoading(false);
    if (res.ok) {
      setQuestion("");
      fetchHistory();
    } else {
      alert("Failed to ask question");
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Back button */}
      <button
        onClick={() => navigate("/")}
        className="mb-4 text-blue-600 hover:underline"
      >
        ← Back to My Page
      </button>

      {/* Chat history */}
      <div className="bg-white p-4 rounded shadow mb-4 max-h-[400px] overflow-y-auto">
        {history.length === 0 ? (
          <p className="text-gray-500">No questions asked yet.</p>
        ) : (
          history.map((h, idx) => (
            <div key={idx} className="mb-4 text-left">
              <p className="font-semibold">Q: {h.question}</p>
              <p className="text-gray-700">A: {h.answer}</p>
              <hr className="my-2" />
            </div>
          ))
        )}
      </div>

      {/* Ask input */}
      <form
        onSubmit={handleAsk}
        className="flex space-x-2 bg-white p-4 rounded shadow"
      >
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask a question about this document..."
          className="flex-1 border px-3 py-2 rounded"
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
        >
          {loading ? "Asking..." : "Ask"}
        </button>
      </form>
    </div>
  );
}

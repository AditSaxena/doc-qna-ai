import React, { useState, useEffect } from "react";

export default function MyDocs() {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchDocs() {
      setError("");
      setLoading(true);

      try {
        const token = localStorage.getItem("token");
        if (!token) {
          setError("You must be logged in to view documents.");
          setLoading(false);
          return;
        }

        const res = await fetch(
          `${
            import.meta.env.VITE_API_URL || "http://localhost:5001"
          }/api/my-docs`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `Request failed: ${res.status}`);
        }

        const data = await res.json();
        setDocs(data.docs || []);
      } catch (err) {
        console.error("Docs fetch error:", err);
        setError(err.message || "Failed to fetch docs.");
      } finally {
        setLoading(false);
      }
    }

    fetchDocs();
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h2>My Uploaded Documents</h2>

      {loading && <p>Loading...</p>}
      {error && <p style={{ color: "crimson" }}>{error}</p>}

      {docs.length === 0 && !loading && <p>No documents uploaded yet.</p>}

      <ul style={{ listStyle: "none", paddingLeft: 0 }}>
        {docs.map((doc) => (
          <li
            key={doc._id}
            style={{
              marginBottom: 12,
              padding: 10,
              border: "1px solid #ddd",
              borderRadius: 6,
            }}
          >
            <p>
              <strong>{doc.filename}</strong>
            </p>
            <p>Chunks: {doc.chunkCount}</p>
            <p>Uploaded: {new Date(doc.uploadedAt).toLocaleString()}</p>
            <a href={doc.s3Url} target="_blank" rel="noreferrer">
              View in S3
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

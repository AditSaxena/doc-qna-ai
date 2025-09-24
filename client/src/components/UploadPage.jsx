import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function UploadPage() {
  const [file, setFile] = useState(null);
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const API_BASE = import.meta.env.VITE_API_BASE_URL;

  async function fetchDocs() {
    const res = await fetch(`${API_BASE}/api/my-docs`, {
      credentials: "include",
    });
    const data = await res.json();
    setDocs(data.docs || []);
  }

  useEffect(() => {
    fetchDocs();
  }, []);

  async function handleUpload(e) {
    e.preventDefault();
    if (!file) return;
    setLoading(true);

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`${API_BASE}/api/upload`, {
      method: "POST",
      body: formData,
      credentials: "include",
    });

    setLoading(false);
    if (res.ok) {
      setFile(null);
      fetchDocs(); // refresh docs list
    } else {
      alert("Upload failed");
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Upload form */}
      <form
        onSubmit={handleUpload}
        className="bg-white p-6 rounded shadow mb-6"
      >
        <h2 className="text-xl font-bold mb-4">Upload a Document</h2>
        <input
          type="file"
          onChange={(e) => setFile(e.target.files[0])}
          className="mb-4"
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
        >
          {loading ? "Uploading..." : "Upload"}
        </button>
      </form>

      {/* Documents list */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold mb-2">My Documents</h2>
        {docs.length === 0 ? (
          <p className="text-gray-600">No documents uploaded yet.</p>
        ) : (
          docs.map((doc) => (
            <div
              key={doc._id}
              className="bg-white p-4 rounded shadow flex justify-between items-center"
            >
              <div>
                <p className="font-medium">{doc.filename}</p>
                <p className="text-sm text-gray-500">
                  Uploaded: {new Date(doc.uploadedAt).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => navigate(`/chat/${doc._id}`)}
                className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded"
              >
                Open Chat →
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

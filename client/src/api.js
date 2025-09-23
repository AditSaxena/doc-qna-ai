export async function apiFetch(path, options = {}) {
  const res = await fetch(`http://localhost:5001${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    credentials: "include", // <-- important
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

import React from "react";
import { Navigate } from "react-router-dom";

export default function ProtectedRoute({ user, loading, children }) {
  if (loading) return <div className="text-center p-8">Loading...</div>;
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

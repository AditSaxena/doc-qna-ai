import React from "react";
import CardLayout from "./CardLayout";

export default function Login() {
  const handleGoogleLogin = () => {
    // Redirect to your backend Google login route
    window.location.href = "http://localhost:5001/api/auth/google";
  };

  return (
    <CardLayout title="Login to DocQnA AI">
      <button
        onClick={handleGoogleLogin}
        className="flex items-center justify-center gap-3 bg-red-500 text-white px-6 py-3 rounded-lg shadow-md hover:bg-red-600 transition w-full"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 488 512"
          className="w-5 h-5"
          fill="currentColor"
        >
          <path d="M488 261.8c0-17.8-1.6-35.1-4.7-51.8H249v98.1h134c-5.8 31.5-23 58.3-49 76.1v63h79c46.1-42.5 75-105.1 75-185.4z" />
          <path d="M249 492c66.4 0 122.1-21.9 162.8-59.4l-79-63c-21.9 14.7-49.9 23.5-83.8 23.5-64.4 0-118.9-43.5-138.4-102.1H30v64.5C70.7 445.7 153.3 492 249 492z" />
          <path d="M110.6 290c-9.1-26.6-9.1-55.2 0-81.8V143.7H30c-39.3 78.6-39.3 172 0 250.4l80.6-64.1z" />
          <path d="M249 97.5c35.9 0 68.2 12.4 93.6 36.5l70.2-70.2C371.1 25.4 315.4 0 249 0 153.3 0 70.7 46.3 30 118.9l80.6 64.5c19.6-58.6 74.1-102.1 138.4-102.1z" />
        </svg>
        <span className="font-medium">Continue with Google</span>
      </button>
    </CardLayout>
  );
}

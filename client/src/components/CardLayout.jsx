// client/src/components/CardLayout.jsx
import React from "react";

const CardLayout = ({ title, children }) => {
  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-100 p-6">
      <div className="bg-white w-full max-w-2xl rounded-xl shadow-lg p-8 text-slate-800">
        {title && <h2 className="text-2xl font-semibold mb-6">{title}</h2>}
        {children}
      </div>
    </div>
  );
};

export default CardLayout;

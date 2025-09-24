import { Link } from "react-router-dom";

export default function NavBar({ user, onLogout }) {
  return (
    <nav className="bg-gray-800 text-white p-4 flex justify-between items-center">
      <div className="flex space-x-6">
        <Link to="/" className="hover:text-gray-300">
          My Page
        </Link>
      </div>
      <div>
        {user ? (
          <button
            onClick={onLogout}
            className="bg-red-500 hover:bg-red-600 px-3 py-1 rounded"
          >
            Logout
          </button>
        ) : null}
      </div>
    </nav>
  );
}

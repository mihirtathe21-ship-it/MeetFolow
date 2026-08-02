import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import NotificationBell from "./NotificationBell";

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <nav className="flex items-center justify-between px-6 py-4 bg-white shadow-sm">
      <Link to="/" className="text-xl font-bold text-brand">
        MeetFlow
      </Link>
      <div className="flex items-center gap-4">
        {user ? (
          <>
            <NotificationBell />
            <span className="text-sm text-slate-600">Hi, {user.name}</span>
            <button
              onClick={() => {
                logout();
                navigate("/login");
              }}
              className="text-sm px-3 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200"
            >
              Logout
            </button>
          </>
        ) : (
          <>
            <Link to="/login" className="text-sm">
              Login
            </Link>
            <Link
              to="/register"
              className="text-sm px-3 py-1.5 rounded-md bg-brand text-white hover:bg-brand-dark"
            >
              Sign up
            </Link>
          </>
        )}
      </div>
    </nav>
  );
};

export default Navbar;

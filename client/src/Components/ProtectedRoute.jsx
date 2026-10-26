import { Navigate, Outlet } from "react-router-dom";
import { useApp } from "../Context/AppContext";

export default function ProtectedRoute({ adminOnly = false }) {
    const { token, user, loading } = useApp();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (!token || !user) {
        return <Navigate to="/login" replace />;
    }

    if (adminOnly && user.role !== "admin") {
        return <Navigate to="/dashboard" replace />;
    }

    return <Outlet />;
}
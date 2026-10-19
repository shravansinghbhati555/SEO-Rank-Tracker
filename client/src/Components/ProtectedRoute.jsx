import { Navigate, Outlet } from "react-router-dom";
import { useApp } from "../Context/AppContext";

export default function ProtectedRoute() {
    const {token, loading} = useApp();

    if(loading){
        <div className="min-h-screen flex items-center justify-center bg-dark-900">
            <div className="w-10 h-10 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
    }

        if(!token){
            return <Navigate to="/login" replace />
        }

    return <Outlet />;
}
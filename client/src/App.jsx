import { Routes, Route, useLocation, Navigate } from "react-router-dom";
import Navbar from "./Components/Navbar";
import ProtectedRoute from "./Components/ProtectedRoute";
import Home from "./Pages/Home";
import Login from "./Pages/Login";
import Dashboard from "./Pages/Dashboard";
import Analyze from "./Pages/Analyze";
import Report from "./Pages/Report";
import History from "./Pages/History";
import RankTracker from "./Pages/RankTracker";
import RankDetail from "./Pages/RankDetail";
import { Toaster } from "react-hot-toast";
import { useApp } from "./Context/AppContext";

export default function App() {
    const {user, loading} = useApp()
    const location = useLocation();

    const hideNavbar = ["/login", "/register"].includes(location.pathname);

     if (loading) {
        return <div>Loading...</div>;
    }

    return (
        <>
            <Toaster />
            {!hideNavbar && <Navbar />}
            <Routes>
                <Route path="/" element={<Home />} />

                <Route path="/login" element={ user ? <Navigate to="/dashboard" replace/> : <Login state="login" />} />

                <Route path="/register" element={ user ? <Navigate to="/dashboard" replace/> : <Login state="register" />} />
                
                <Route element={<ProtectedRoute />}>
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/analyze" element={<Analyze />} />
                    <Route path="/report/:id" element={<Report />} />
                    <Route path="/history" element={<History />} />
                    <Route path="/rank-tracker" element={<RankTracker />} />
                    <Route path="/rank/:id" element={<RankDetail />} />
                </Route>
            </Routes>
        </>
    );
}
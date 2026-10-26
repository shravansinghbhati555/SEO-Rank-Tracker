import { useCallback, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useApp } from "../Context/AppContext";

export default function Admin() {
  const { api, user, loading } = useApp();

  const [stats, setStats] = useState({});
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState("");
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState("");

  const loadDashboard = useCallback(async () => {
    setDashboardLoading(true);
    setDashboardError("");

    try {
      const { data } = await api.get("/api/admin/dashboard");

      setStats(data.stats || {});
      setUsers(Array.isArray(data.users) ? data.users : []);
    } catch (error) {
      const message =
        error.response?.data?.message ||
        (error.response?.status === 404
          ? "Admin endpoint not found on server (404)."
          : error.response?.status === 403
          ? "Admin access required (403)."
          : error.response?.status === 401
          ? "Not authorized or session expired (401)."
          : "Could not load admin dashboard");

      console.error("ADMIN DASHBOARD ERROR:", {
        status: error.response?.status,
        message,
        response: error.response?.data,
      });

      setDashboardError(message);
      toast.error(message);
    } finally {
      setDashboardLoading(false);
    }
  }, [api]);

  useEffect(() => {
    if (!loading && user?.role === "admin") {
      loadDashboard();
    }
  }, [loading, user?.role, loadDashboard]);

  const changeCredits = async (targetUser, amount) => {
    const key = `${targetUser._id}-${amount}`;
    setBusy(key);

    try {
      await api.patch(
        `/api/admin/users/${targetUser._id}/credits`,
        { amount }
      );

      toast.success("Credits updated");
      await loadDashboard();
    } catch (error) {
      const message =
        error.response?.data?.message ||
        "Unable to update credits";

      console.error("UPDATE CREDITS ERROR:", error);
      toast.error(message);
    } finally {
      setBusy("");
    }
  };

  const toggleAnalysis = async (targetUser) => {
    const key = `${targetUser._id}-toggle`;
    setBusy(key);

    try {
      await api.patch(
        `/api/admin/users/${targetUser._id}/analysis`,
        {
          enabled: targetUser.analysisEnabled === false,
        }
      );

      toast.success("Analysis access updated");
      await loadDashboard();
    } catch (error) {
      const message =
        error.response?.data?.message ||
        "Unable to update access";

      console.error("UPDATE ANALYSIS ACCESS ERROR:", error);
      toast.error(message);
    } finally {
      setBusy("");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== "admin") {
    return <Navigate to="/dashboard" replace />;
  }

  const filteredUsers = users.filter((item) =>
    `${item.name || ""} ${item.email || ""}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const statCards = [
    {
      label: "Total Users",
      value: stats.totalUsers ?? 0,
    },
    {
      label: "Total Analyses",
      value: stats.totalAnalyses ?? 0,
    },
    {
      label: "Analysis Enabled",
      value: stats.activeUsers ?? 0,
    },
    {
      label: "Credits Remaining",
      value: stats.totalCredits ?? 0,
    },
  ];

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-white sm:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-indigo-400">
              RANK PILOT / ADMIN
            </p>

            <h1 className="mt-2 text-3xl font-bold">
              Admin Dashboard
            </h1>

            <p className="mt-2 text-slate-400">
              Manage users, analysis access and credits.
            </p>
          </div>

          <button
            onClick={loadDashboard}
            disabled={dashboardLoading}
            className="rounded-xl bg-indigo-600 px-4 py-2 font-medium hover:bg-indigo-500 disabled:opacity-50"
          >
            {dashboardLoading ? "Loading..." : "Refresh"}
          </button>
        </div>

        {dashboardError && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
            <p className="font-semibold text-red-400">
              Could not load admin dashboard
            </p>

            <p className="mt-1 text-sm text-red-300">
              {dashboardError}
            </p>

            <p className="mt-2 text-sm text-slate-300">
              Check the backend admin route and authentication.
            </p>
          </div>
        )}

        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {statCards.map((card) => (
            <div
              key={card.label}
              className="rounded-2xl border border-slate-800 bg-slate-900 p-5"
            >
              <p className="text-sm text-slate-400">
                {card.label}
              </p>

              <p className="mt-3 text-3xl font-bold">
                {card.value}
              </p>
            </div>
          ))}
        </div>

        <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
          <div className="flex flex-col gap-4 border-b border-slate-800 p-5 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-semibold">
              User Management
            </h2>

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name or email..."
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm outline-none focus:border-indigo-500 sm:max-w-sm"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="bg-slate-950 text-slate-400">
                <tr>
                  <th className="p-4">User</th>
                  <th className="p-4">Role</th>
                  <th className="p-4">Credits</th>
                  <th className="p-4">Analysis Access</th>
                  <th className="p-4">Manage Credits</th>
                </tr>
              </thead>

              <tbody>
                {dashboardLoading ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="p-8 text-center text-slate-400"
                    >
                      Loading dashboard data...
                    </td>
                  </tr>
                ) : (
                  <>
                    {filteredUsers.map((item) => (
                      <tr
                        key={item._id}
                        className="border-t border-slate-800"
                      >
                        <td className="p-4">
                          <p className="font-medium">
                            {item.name}
                          </p>

                          <p className="mt-1 text-slate-400">
                            {item.email}
                          </p>
                        </td>

                        <td className="p-4">
                          {item.role === "admin" ? "Admin" : "User"}
                        </td>

                        <td className="p-4 font-semibold">
                          {item.credits ?? 0}
                        </td>

                        <td className="p-4">
                          <button
                            disabled={busy === `${item._id}-toggle`}
                            onClick={() => toggleAnalysis(item)}
                            className={`rounded-lg px-3 py-2 font-medium disabled:opacity-50 ${
                              item.analysisEnabled === false
                                ? "bg-red-500/15 text-red-400"
                                : "bg-emerald-500/15 text-emerald-400"
                            }`}
                          >
                            {item.analysisEnabled === false
                              ? "Enable"
                              : "Disable"}
                          </button>
                        </td>

                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <button
                              disabled={busy === `${item._id}-1`}
                              onClick={() => changeCredits(item, 1)}
                              className="rounded-lg bg-indigo-600 px-3 py-2 font-semibold hover:bg-indigo-500 disabled:opacity-50"
                            >
                              +1
                            </button>

                            <button
                              disabled={busy === `${item._id}--1`}
                              onClick={() => changeCredits(item, -1)}
                              className="rounded-lg border border-slate-700 px-3 py-2 hover:bg-slate-800 disabled:opacity-50"
                            >
                              -1
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}

                    {filteredUsers.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="p-8 text-center text-slate-400"
                        >
                          {dashboardError
                            ? "User data could not be loaded."
                            : "No users found."}
                        </td>
                      </tr>
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
import { useCallback, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  Search,
  RefreshCw,
  Users,
  Activity,
  Coins,
  ShieldCheck,
  Plus,
  Minus,
  UserRound,
  CreditCard,
  CalendarDays,
} from "lucide-react";
import { useApp } from "../Context/AppContext";

export default function Admin() {
  const { api, user, loading } = useApp();

  const [stats, setStats] = useState({});
  const [users, setUsers] = useState([]);

  const [search, setSearch] = useState("");
  const [creditSearch, setCreditSearch] = useState("");
  const [selectedCreditUserId, setSelectedCreditUserId] = useState("");

  const [busy, setBusy] = useState("");
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState("");

  const [expandedPlansUserId, setExpandedPlansUserId] = useState(null);
  const [expandedPaymentUserId, setExpandedPaymentUserId] = useState(null);

  // Load dashboard data
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

      console.error("ADMIN DASHBOARD ERROR:", error);

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

  // Add or remove credits
  const changeCredits = async (targetUser, amount) => {
    const key = `${targetUser._id}-${amount}`;

    setBusy(key);

    try {
      await api.patch(`/api/admin/users/${targetUser._id}/credits`, {
        amount,
      });

      toast.success(
        amount > 0
          ? `${amount} credit added successfully`
          : `${Math.abs(amount)} credit removed successfully`,
      );

      await loadDashboard();
    } catch (error) {
      const message =
        error.response?.data?.message || "Unable to update credits";

      console.error("UPDATE CREDITS ERROR:", error);
      toast.error(message);
    } finally {
      setBusy("");
    }
  };

  // Enable or disable analysis
  const toggleAnalysis = async (targetUser) => {
    const key = `${targetUser._id}-toggle`;

    setBusy(key);

    try {
      await api.patch(`/api/admin/users/${targetUser._id}/analysis`, {
        enabled: targetUser.analysisEnabled === false,
      });

      toast.success("Analysis access updated");

      await loadDashboard();
    } catch (error) {
      const message =
        error.response?.data?.message || "Unable to update access";

      console.error("UPDATE ANALYSIS ACCESS ERROR:", error);
      toast.error(message);
    } finally {
      setBusy("");
    }
  };

  // Authentication loading
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

  // Purchased plans
  const getPurchasedPlans = (item) => {
    if (Array.isArray(item.purchasedPlans) && item.purchasedPlans.length > 0) {
      return item.purchasedPlans;
    }

    return item.planName
      ? [
          {
            planName: item.planName,
            planId: item.currentPlanId,
          },
        ]
      : [];
  };

  // Exclude admin users from all user lists
  const regularUsers = users.filter((item) => item.role !== "admin");

  // User Management search
  const filteredUsers = regularUsers.filter((item) =>
    `${item.name || ""} ${item.email || ""}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  // Credits search
  const filteredCreditUsers = regularUsers.filter((item) =>
    `${item.name || ""} ${item.email || ""}`
      .toLowerCase()
      .includes(creditSearch.toLowerCase()),
  );

  // Selected user for credit management
  const selectedCreditUser = regularUsers.find(
    (item) => item._id === selectedCreditUserId,
  );

  // Statistics
  const statCards = [
    {
      label: "Total Users",
      value: stats.totalUsers ?? 0,
      icon: <Users size={22} />,
      color: "text-blue-400",
      bg: "bg-blue-500/10",
    },
    {
      label: "Total Analyses",
      value: stats.totalAnalyses ?? 0,
      icon: <Activity size={22} />,
      color: "text-purple-400",
      bg: "bg-purple-500/10",
    },
    {
      label: "Analysis Enabled",
      value: stats.activeUsers ?? 0,
      icon: <ShieldCheck size={22} />,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
    },
    {
      label: "Credits Remaining",
      value: stats.totalCredits ?? 0,
      icon: <Coins size={22} />,
      color: "text-amber-400",
      bg: "bg-amber-500/10",
    },
  ];

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-white sm:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold tracking-wider text-indigo-400">
              RANK PILOT / ADMIN
            </p>

            <h1 className="mt-2 text-3xl font-bold">Admin Dashboard</h1>

            <p className="mt-2 text-sm text-slate-400">
              Manage users, subscriptions, payments and analysis access.
            </p>
          </div>

          <button
            onClick={loadDashboard}
            disabled={dashboardLoading}
            className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold transition hover:bg-indigo-500 disabled:opacity-50"
          >
            <RefreshCw
              size={17}
              className={dashboardLoading ? "animate-spin" : ""}
            />
            {dashboardLoading ? "Loading..." : "Refresh Dashboard"}
          </button>
        </div>

        {/* Error */}
        {dashboardError && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
            <p className="font-semibold text-red-400">
              Could not load admin dashboard
            </p>

            <p className="mt-1 text-sm text-red-300">{dashboardError}</p>
          </div>
        )}

        {/* Statistics */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {statCards.map((card) => (
            <div
              key={card.label}
              className="rounded-2xl border border-slate-800 bg-slate-900 p-5 transition hover:border-slate-700"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-400">{card.label}</p>

                <div className={`rounded-xl p-3 ${card.bg} ${card.color}`}>
                  {card.icon}
                </div>
              </div>

              <p className="mt-4 text-3xl font-bold">{card.value}</p>
            </div>
          ))}
        </div>

        {/* User Management */}
        <section className="mb-8 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
          <div className="flex flex-col gap-4 border-b border-slate-800 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold">User Management</h2>

              <p className="mt-1 text-sm text-slate-400">
                View and manage registered users.
              </p>
            </div>

            <div className="relative w-full sm:max-w-sm">
              <Search
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
              />

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name or email..."
                className="w-full rounded-xl border border-slate-700 bg-slate-950 py-3 pl-10 pr-4 text-sm text-white outline-none transition focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-slate-950 text-slate-400">
                <tr>
                  <th className="p-4">User</th>
                  <th className="p-4">Role</th>
                  <th className="p-4">Current Plan</th>
                  <th className="p-4">Payment Status</th>
                  <th className="p-4">Plan Expiry</th>
                  <th className="p-4">Analysis Access</th>
                </tr>
              </thead>

              <tbody>
                {dashboardLoading ? (
                  <tr>
                    <td colSpan={6} className="p-10 text-center text-slate-400">
                      Loading dashboard data...
                    </td>
                  </tr>
                ) : (
                  <>
                    {filteredUsers.map((item) => (
                      <tr
                        key={item._id}
                        className="border-t border-slate-800 transition hover:bg-slate-800/40"
                      >
                        {/* User */}
                        <td className="p-4">
                          <p className="font-medium text-white">{item.name}</p>

                          <p className="mt-1 text-xs text-slate-400">
                            {item.email}
                          </p>
                        </td>

                        {/* Role */}
                        <td className="p-4">
                          <span className="rounded-lg bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-300">
                            User
                          </span>
                        </td>

                        {/* Current Plan */}
                        <td className="p-3">
                          {(() => {
                            const purchasedPlans = getPurchasedPlans(item);
                            const isExpanded = expandedPlansUserId === item._id;
                            const remainingPlans = purchasedPlans.length - 1;

                            return (
                              <div className="relative flex items-center gap-1.5">
                                <span className="max-w-[125px] truncate font-medium">
                                  {purchasedPlans[0]?.planName || "Free"}
                                </span>

                                {remainingPlans > 0 && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setExpandedPlansUserId(
                                        isExpanded ? null : item._id,
                                      )
                                    }
                                    className="rounded-md bg-indigo-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-indigo-400 hover:bg-indigo-500/20"
                                  >
                                    {isExpanded ? "−" : `+${remainingPlans}`}
                                  </button>
                                )}

                                {isExpanded && remainingPlans > 0 && (
                                  <div className="absolute left-0 top-full z-50 mt-1 w-48 rounded-lg border border-slate-700 bg-slate-900 p-2 shadow-xl">
                                    <p className="mb-2 text-[11px] font-semibold text-slate-400">
                                      Purchased Plans
                                    </p>

                                    <div className="max-h-40 space-y-1 overflow-y-auto">
                                      {purchasedPlans.map((plan, index) => (
                                        <div
                                          key={
                                            plan.paymentId ||
                                            `${plan.planId}-${index}`
                                          }
                                          className="flex items-center justify-between gap-2 rounded-md px-2 py-1 hover:bg-slate-800"
                                        >
                                          <span className="truncate text-xs text-slate-200">
                                            {plan.planName}
                                          </span>

                                          <span className="shrink-0 text-[10px] text-slate-500">
                                            {plan.isCurrent
                                              ? "Current"
                                              : "Paid"}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </td>

                        {/* Payment Status */}
                        <td className="p-3">
                          {(() => {
                            const history = item.paymentHistory || [];
                            const isExpanded =
                              expandedPaymentUserId === item._id;

                            const status = item.paymentStatus || "No payment";

                            const statusStyle =
                              status === "paid"
                                ? "bg-emerald-500/10 text-emerald-400"
                                : status === "failed"
                                  ? "bg-red-500/10 text-red-400"
                                  : status === "pending"
                                    ? "bg-amber-500/10 text-amber-400"
                                    : "bg-slate-800 text-slate-400";

                            return (
                              <div className="relative flex items-center gap-1.5">
                                <span
                                  className={`rounded-md px-2 py-1 text-[11px] font-semibold capitalize ${statusStyle}`}
                                >
                                  {status}
                                </span>

                                {history.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setExpandedPaymentUserId(
                                        isExpanded ? null : item._id,
                                      )
                                    }
                                    className="rounded-md bg-indigo-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-indigo-400 hover:bg-indigo-500/20"
                                  >
                                    {isExpanded
                                      ? "−"
                                      : `+${history.length - 1}`}
                                  </button>
                                )}

                                {isExpanded && history.length > 1 && (
                                  <div className="absolute left-0 top-full z-50 mt-1 w-52 rounded-lg border border-slate-700 bg-slate-900 p-2 shadow-xl">
                                    <p className="mb-2 text-[11px] font-semibold text-slate-400">
                                      Payment History
                                    </p>

                                    <div className="max-h-44 space-y-1 overflow-y-auto">
                                      {history.map((payment, index) => {
                                        const paymentStatus =
                                          payment.paymentStatus || "unknown";

                                        const paymentStyle =
                                          paymentStatus === "paid"
                                            ? "text-emerald-400"
                                            : paymentStatus === "failed"
                                              ? "text-red-400"
                                              : "text-amber-400";

                                        return (
                                          <div
                                            key={payment.paymentId || index}
                                            className="rounded-md bg-slate-950 px-2 py-1.5"
                                          >
                                            <div className="flex items-center justify-between gap-2">
                                              <span className="truncate text-xs text-slate-200">
                                                {payment.planName}
                                              </span>

                                              <span
                                                className={`shrink-0 text-[10px] font-semibold capitalize ${paymentStyle}`}
                                              >
                                                {paymentStatus}
                                              </span>
                                            </div>

                                            {payment.purchaseDate && (
                                              <p className="mt-1 text-[10px] text-slate-500">
                                                {new Date(
                                                  payment.purchaseDate,
                                                ).toLocaleDateString("en-IN")}
                                              </p>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </td>

                        {/* Plan Expiry */}
                        <td className="p-4 text-slate-300">
                          {item.planExpiresAt
                            ? new Date(item.planExpiresAt).toLocaleDateString(
                                "en-IN",
                              )
                            : "—"}
                        </td>

                        {/* Analysis Access */}
                        <td className="p-4">
                          <button
                            disabled={busy === `${item._id}-toggle`}
                            onClick={() => toggleAnalysis(item)}
                            className={`rounded-lg px-3 py-2 text-xs font-semibold transition disabled:opacity-50 ${
                              item.analysisEnabled === false
                                ? "bg-red-500/15 text-red-400 hover:bg-red-500/25"
                                : "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25"
                            }`}
                          >
                            {busy === `${item._id}-toggle`
                              ? "Updating..."
                              : item.analysisEnabled === false
                                ? "Enable"
                                : "Disable"}
                          </button>
                        </td>
                      </tr>
                    ))}

                    {filteredUsers.length === 0 && (
                      <tr>
                        <td
                          colSpan={6}
                          className="p-10 text-center text-slate-400"
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

          <div className="border-t border-slate-800 px-5 py-3">
            <p className="text-xs text-slate-500">
              Showing {filteredUsers.length} of {regularUsers.length} users
            </p>
          </div>
        </section>

        {/* Separate Manage Credits Section */}
        <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
          <div className="border-b border-slate-800 p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-indigo-500/10 p-3 text-indigo-400">
                <Coins size={24} />
              </div>

              <div>
                <h2 className="text-xl font-bold">Manage User Credits</h2>

                <p className="mt-1 text-sm text-slate-400">
                  Add or remove analysis credits for individual users.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-2">
            {/* Select User */}
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-300">
                Search and Select User
              </label>

              <div className="relative mb-3">
                <Search
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                />

                <input
                  type="text"
                  value={creditSearch}
                  onChange={(event) => {
                    setCreditSearch(event.target.value);
                    setSelectedCreditUserId("");
                  }}
                  placeholder="Search by name or email..."
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-indigo-500"
                />
              </div>

              <div className="max-h-56 space-y-2 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950 p-2">
                {dashboardLoading ? (
                  <p className="p-4 text-center text-sm text-slate-500">
                    Loading users...
                  </p>
                ) : filteredCreditUsers.length > 0 ? (
                  filteredCreditUsers.map((item) => (
                    <button
                      key={item._id}
                      type="button"
                      onClick={() => setSelectedCreditUserId(item._id)}
                      className={`flex w-full items-center justify-between gap-3 rounded-lg p-3 text-left transition ${
                        selectedCreditUserId === item._id
                          ? "border border-indigo-500/40 bg-indigo-500/10"
                          : "border border-transparent hover:bg-slate-800"
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-500/10 text-indigo-400">
                          <UserRound size={18} />
                        </div>

                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-white">
                            {item.name}
                          </p>

                          <p className="truncate text-xs text-slate-400">
                            {item.email}
                          </p>
                        </div>
                      </div>

                      <span className="shrink-0 text-xs font-semibold text-amber-400">
                        {item.credits ?? 0} Credits
                      </span>
                    </button>
                  ))
                ) : (
                  <p className="p-4 text-center text-sm text-slate-500">
                    No users found.
                  </p>
                )}
              </div>
            </div>

            {/* Credit Actions */}
            <div className="flex flex-col justify-center">
              {selectedCreditUser ? (
                <div className="rounded-2xl border border-slate-700 bg-slate-950 p-5">
                  <div className="mb-5 flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400">
                      <UserRound size={23} />
                    </div>

                    <div className="min-w-0">
                      <p className="font-semibold text-white">
                        {selectedCreditUser.name}
                      </p>

                      <p className="truncate text-xs text-slate-400">
                        {selectedCreditUser.email}
                      </p>
                    </div>
                  </div>

                  <div className="mb-5 rounded-xl border border-slate-800 bg-slate-900 p-4">
                    <p className="text-sm text-slate-400">
                      Current Available Credits
                    </p>

                    <div className="mt-2 flex items-center gap-2">
                      <Coins className="text-amber-400" size={25} />

                      <span className="text-3xl font-bold text-white">
                        {selectedCreditUser.credits ?? 0}
                      </span>
                    </div>
                  </div>

                  <p className="mb-3 text-sm font-semibold text-slate-300">
                    Update Credits
                  </p>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      disabled={
                        !!busy || (selectedCreditUser.credits ?? 0) <= 0
                      }
                      onClick={() => changeCredits(selectedCreditUser, -1)}
                      className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Minus size={18} />
                      {busy === `${selectedCreditUser._id}--1`
                        ? "Removing..."
                        : "Remove 1"}
                    </button>

                    <button
                      disabled={!!busy}
                      onClick={() => changeCredits(selectedCreditUser, 1)}
                      className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Plus size={18} />
                      {busy === `${selectedCreditUser._id}-1`
                        ? "Adding..."
                        : "Add 1"}
                    </button>
                  </div>

                  <p className="mt-4 text-center text-xs text-slate-500">
                    Credits will be updated immediately after a successful API
                    response.
                  </p>
                </div>
              ) : (
                <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-700 bg-slate-950/50 p-6 text-center">
                  <div className="mb-4 rounded-2xl bg-indigo-500/10 p-4 text-indigo-400">
                    <CreditCard size={30} />
                  </div>

                  <h3 className="font-semibold text-white">Select a User</h3>

                  <p className="mt-2 max-w-xs text-sm text-slate-500">
                    Search and select a user from the list to manage their
                    credits.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Footer */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <span>Rank Pilot Admin Panel</span>

          <span className="flex items-center gap-1.5">
            <CalendarDays size={14} />
            {new Date().toLocaleDateString("en-IN")}
          </span>
        </div>
      </div>
    </main>
  );
}

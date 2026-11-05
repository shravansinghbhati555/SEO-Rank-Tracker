import { useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle } from "lucide-react";
import toast from "react-hot-toast";
import { useApp } from "../../Context/AppContext";

const paidPlans = [
  {
    id: "plan-1",
    name: "Starter",
    price: 99,
    credits: 5,
    features: [
      "5 SEO analyses",
      "Full SEO report",
      "Keyword analysis",
      "Issue detection",
      "Export results",
    ],
  },
  {
    id: "plan-2",
    name: "Pro",
    price: 499,
    credits: 10,
    popular: true,
    features: [
      "10 SEO analyses",
      "Priority processing",
      "Competitor analysis",
      "Historical tracking",
      "Keyword analysis",
      "Export results",
    ],
  },
  {
    id: "plan-3",
    name: "Premium",
    price: 799,
    credits: 20,
    features: [
      "20 SEO analyses",
      "Priority processing",
      "Competitor analysis",
      "Historical tracking",
      "Keyword analysis",
      "Export results",
    ],
  },
];

export default function Pricing() {
  const { api, user, loadUser } = useApp();
  const [loadingPlan, setLoadingPlan] = useState(null);

  const handlePayment = async (plan) => {
    if (!user) {
      toast.error("Please login before purchasing a plan.");
      window.location.href = "/login";
      return;
    }

    if (!window.Razorpay) {
      toast.error("Razorpay Checkout is not loaded. Please refresh the page.");
      return;
    }

    try {
      setLoadingPlan(plan.id);

      // 1. Create order from backend
      const { data: order } = await api.post("/api/payments/create-order", {
        planId: plan.id,
      });

      if (!order.success) {
        throw new Error(order.message || "Unable to create payment order.");
      }

      // 2. Razorpay Checkout configuration
      const options = {
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: "Rank Pilot",
        description: `${plan.name} Plan - ${plan.credits} SEO analyses`,
        order_id: order.orderId,

        prefill: {
          name: user.name || "",
          email: user.email || "",
        },

        theme: {
          color: "#6366f1",
        },

        // 3. Verify payment on backend
        handler: async (response) => {
          try {
            const { data: result } = await api.post(
              "/api/payments/verify",
              response,
            );

            if (!result.success) {
              throw new Error(result.message || "Payment verification failed.");
            }

            toast.success("Payment successful! Credits added.");

            // Refresh logged-in user and credits
            await loadUser();
          } catch (error) {
            console.error(
              "PAYMENT VERIFICATION ERROR:",
              error.response?.data || error.message,
            );

            toast.error(
              error.response?.data?.message ||
                error.message ||
                "Payment verification failed.",
            );
          }
        },
      };

      const checkout = new window.Razorpay(options);

      checkout.on("payment.failed", (response) => {
        console.error("PAYMENT FAILED:", response.error);
        toast.error(
          response.error?.description || "Payment failed. Please try again.",
        );
      });

      checkout.open();
    } catch (error) {
      console.error("PAYMENT ERROR:", error.response?.data || error.message);

      toast.error(
        error.response?.data?.message ||
          error.message ||
          "Something went wrong.",
      );
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <section className="relative md:min-h-screen flex flex-col justify-center items-center max-lg:py-24">
      <div className="bg-dot-pattern absolute inset-0 -z-1 opacity-10"></div>

      <div className="max-w-6xl w-full mx-auto px-4">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-semibold mb-4 text-foreground">
            Simple <span className="gradient-text">Pricing</span>
          </h2>

          <p className="text-muted-foreground">
            Start free. Upgrade when you need more.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Free Plan */}
          <div className="bg-card border border-border rounded-2xl p-8 flex flex-col">
            <h3 className="text-xl font-semibold mb-1 text-foreground">Free</h3>

            <div className="flex items-baseline gap-1 mb-6">
              <span className="text-4xl font-bold text-foreground">₹0</span>
              <span className="text-muted-foreground">/free</span>
            </div>

            <ul className="space-y-3 mb-8 flex-1">
              {[
                "Free account",
                "2 SEO analyses free",
                "SEO analysis access",
                "Keyword analysis",
                "Issue detection",
              ].map((item) => (
                <li
                  key={item}
                  className="flex items-center gap-2 text-sm text-muted-foreground"
                >
                  <CheckCircle size={16} className="text-primary shrink-0" />
                  {item}
                </li>
              ))}
            </ul>

            <Link
              to="/register"
              className="block w-full py-3 rounded-xl bg-primary/10 text-secondary-foreground text-center text-sm hover:opacity-90 transition-colors"
            >
              Get Started Free
            </Link>
          </div>

          {/* Paid Plans */}
          {paidPlans.map((plan) => (
            <div
              key={plan.id}
              className={`relative rounded-2xl p-8 flex flex-col bg-card border overflow-hidden ${
                plan.popular ? "border-primary/50" : "border-border"
              }`}
            >
              {plan.popular && (
                <div
                  className="absolute top-4 right-4 px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-medium"
                  style={{ color: "var(--background)" }}
                >
                  Popular
                </div>
              )}

              <h3 className="text-xl font-semibold mb-1 text-foreground">
                {plan.name}
              </h3>

              <div className="flex items-baseline gap-1 mb-2">
                <span
                  className={`text-4xl font-bold ${
                    plan.popular ? "text-primary" : "text-foreground"
                  }`}
                >
                  ₹{plan.price}
                </span>
                <span className="text-muted-foreground">/one-time</span>
              </div>

              <p className="text-sm text-muted-foreground mb-6">
                {plan.credits} SEO analysis credits
              </p>

              <ul className="space-y-3 mb-8 flex-1">
                {plan.features.map((item) => (
                  <li
                    key={item}
                    className="flex items-center gap-2 text-sm text-muted-foreground"
                  >
                    <CheckCircle size={16} className="text-primary shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handlePayment(plan)}
                disabled={loadingPlan !== null}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-center text-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ color: "var(--background)" }}
              >
                {loadingPlan === plan.id ? "Processing..." : `Buy ${plan.name}`}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

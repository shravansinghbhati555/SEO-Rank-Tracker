
export const PREMIUM_PLANS = [
  {
    id: "plan-1",
    name: "Starter",
    amountPaise: 9900,
    credits: 5,
    validityDays: null,
    features: ["5 SEO analyses"],
    active: true,
  },
  {
    id: "plan-2",
    name: "Pro",
    amountPaise: 49900,
    credits: 10,
    validityDays: null,
    features: ["10 SEO analyses"],
    active: true,
  },
  {
    id: "plan-3",
    name: "Premium",
    amountPaise: 79900,
    credits: 20,
    validityDays: null,
    features: ["20 SEO analyses"],
    active: true,
  },
];

export function getActivePlan(planId) {
  return PREMIUM_PLANS.find(
    (plan) =>
      plan.id === planId &&
      plan.active === true &&
      Number.isSafeInteger(plan.amountPaise) &&
      plan.amountPaise > 0 &&
      Number.isSafeInteger(plan.credits) &&
      plan.credits > 0
  );
}

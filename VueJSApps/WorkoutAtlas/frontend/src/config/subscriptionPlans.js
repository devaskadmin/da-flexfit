export const FALLBACK_SUBSCRIPTION_TIERS = [
  { id: 1, name: 'Free', slug: 'free', price_monthly: 0, price_yearly: 0 },
  { id: 2, name: 'Pro', slug: 'pro', price_monthly: 9.99, price_yearly: 99.99 },
  { id: 3, name: 'Trainer', slug: 'trainer', price_monthly: 19.99, price_yearly: 199.99 },
];

export const SUBSCRIPTION_PLAN_DEFINITIONS = [
  {
    key: 'free',
    name: 'Free',
    priceLabel: '$0/month',
    description: 'Great for getting started with your fitness routine.',
    icon: 'fa-regular fa-star',
    features: [
      'Basic workout logging',
      'Basic progress tracking',
      'Standard exercise access',
    ],
  },
  {
    key: 'pro',
    name: 'Pro',
    priceLabel: '$9.99/month',
    description: 'Built for committed users who want deeper fitness insights.',
    icon: 'fa-regular fa-bolt',
    features: [
      'Advanced workout tools',
      'Enhanced progress tracking',
      'Nutrition insights',
      'Premium features',
    ],
  },
  {
    key: 'trainer',
    name: 'Trainer',
    priceLabel: '$19.99/month',
    description: 'Designed for coaching workflows and client management.',
    icon: 'fa-regular fa-dumbbell',
    features: [
      'Client management',
      'Program building',
      'Progress review tools',
      'Trainer-focused features',
    ],
  },
];

const normalizeTierName = (value) => String(value || '').trim().toLowerCase();

const findTierByNames = (tiers = [], names = []) => {
  const lowered = names.map((name) => normalizeTierName(name));
  return tiers.find((row) => {
    return lowered.includes(normalizeTierName(row?.slug)) || lowered.includes(normalizeTierName(row?.name));
  });
};

export const resolveTierIdForPlan = (planKey, tiers = []) => {
  if (planKey === 'free') {
    return findTierByNames(tiers, ['free'])?.id ?? null;
  }

  if (planKey === 'pro') {
    return findTierByNames(tiers, ['pro'])?.id ?? null;
  }

  if (planKey === 'trainer') {
    return findTierByNames(tiers, ['trainer', 'elite'])?.id ?? null;
  }

  return null;
};

export const getAllowedPlanKeysForAccountType = (membershipType) => {
  const value = String(membershipType || '').trim().toLowerCase();

  if (value === 'trainer') return ['trainer'];
  if (value === 'admin') return ['free', 'pro', 'trainer'];
  return ['free', 'pro'];
};

export const buildSubscriptionPlanOptions = (tiers = [], allowedPlanKeys = null) => {
  const allowed = Array.isArray(allowedPlanKeys) && allowedPlanKeys.length > 0
    ? new Set(allowedPlanKeys)
    : null;

  return SUBSCRIPTION_PLAN_DEFINITIONS
    .filter((plan) => (allowed ? allowed.has(plan.key) : true))
    .map((plan) => {
      const tierId = resolveTierIdForPlan(plan.key, tiers);
      return {
        ...plan,
        tierId,
        available: tierId !== null,
      };
    });
};

export const getAccountTypeOptions = (isDemoMode = false) => {
  const base = [
    {
      value: 'User',
      title: 'User',
      description: 'Track workouts, view progress, and manage your fitness journey.',
      icon: 'fa-regular fa-user',
    },
    {
      value: 'Trainer',
      title: 'Trainer',
      description: 'Manage clients, guide programs, and support training goals.',
      icon: 'fa-regular fa-dumbbell',
    },
  ];

  if (isDemoMode) {
    base.push({
      value: 'Admin',
      title: 'Admin',
      description: 'Demo-only access for platform administration and review.',
      icon: 'fa-regular fa-shield-check',
    });
  }

  return base;
};

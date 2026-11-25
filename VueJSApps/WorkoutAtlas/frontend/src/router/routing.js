
//Default Home Page
import HomeView from '@/views/Member/HomeDashboard.vue'


//Guest Routes
const guestRoutes = [
    {
        path: '/login',
        component: () => import('@/views/Guest/Login.vue'),
        name: 'login',
        meta: { layout: 'GuestLayout' },
    },
    {
        path: '/register',
        component: () => import('@/views/Guest/register.vue'),
        name: 'register',
        meta: { layout: 'GuestLayout' },
    },
    {
        path: '/terms-policy',
        component: () => import('@/views/Guest/TermsPolicy.vue'),
        name: 'terms_policy',
        meta: { layout: 'GuestLayout' },
    },
    {
        path: '/reset-password',
        component: () => import('@/views/Guest/ForgotPassword.vue'),
        name: 'reset_password',
        meta: { layout: 'GuestLayout' },
    },
    {
        path: '/update-password',
        component: () => import('@/views/Guest/UpdatePassword.vue'),
        name: 'update_password',
        meta: {layout: 'GuestLayout'}
    },
    {
        path: '/ext-register',
        component: () => import('@/views/Guest/ExternalRegister.vue'),
        name: 'ext_register',
        meta: { layout: 'GuestLayout' },
    },
    {
        path: '/coming-soon',
        component: () => import('@/views/template/pages/additional/ComingSoon.vue'),
        name: 'coming_soon',
        meta: {layout: 'GuestLayout'}
    },
    {
        path: '/coming-soon-2',
        component: () => import('@/views/template/pages/additional/ComingSoon2.vue'),
        name: 'coming_soon_2',
        meta: {layout: 'GuestLayout'}
    },
    {
        path: '/under-construction',
        component: () => import('@/views/template/pages/additional/UnderConstruction.vue'),
        name: 'under_construction',
        meta: {layout: 'GuestLayout'}
    },
];

//Error Pages
const errorPageRoutes = [
    {
        path: '/error-400',
        component: () => import('@/views/template/pages/error/Error400.vue'),
        name: 'error_400',
        meta: {layout: 'GuestLayout'}
    },
    {
        path: '/error-403',
        component: () => import('@/views/template/pages/error/Error403.vue'),
        name: 'error_403',
        meta: {layout: 'GuestLayout'}
    },
    {
        path: '/error-404',
        component: () => import('@/views/template/pages/error/Error404.vue'),
        name: 'error_404',
        meta: {layout: 'GuestLayout'}
    },
    {
        path: '/error-408',
        component: () => import('@/views/template/pages/error/Error408.vue'),
        name: 'error_408',
        meta: {layout: 'GuestLayout'}
    },
    {
        path: '/error-500',
        component: () => import('@/views/template/pages/error/Error500.vue'),
        name: 'error_500',
        meta: {layout: 'GuestLayout'}
    },
    {
        path: '/error-503',
        component: () => import('@/views/template/pages/error/Error503.vue'),
        name: 'error_503',
        meta: {layout: 'GuestLayout'}
    },
    {
        path: '/error-504',
        component: () => import('@/views/template/pages/error/Error504.vue'),
        name: 'error_504',
        meta: {layout: 'GuestLayout'}
    },
]

//Pages Routes
export const pagesRoutes = [
    {
        path: '/',
        redirect: { name: 'login' },
    },
    {
        path: '/dashboard',
        component: HomeView,
        name: 'dashboard_index',
        meta: { layout: 'AppLayout', isPartials: true },
    },
    {
        path: '/logout',
        component: () => import('@/views/Member/Logout.vue'),
        name: 'logout',
        meta: { layout: 'GuestLayout' },
    },    
    {
        path: '/Nutrition',
        component: () => import('@/views/Member/NutritionWorkspace.vue'),
        name: 'Nutrition',
        meta: { layout: 'AppLayout', isPartials: true },
    },
    {
        path: '/exercises',
        component: () => import('@/views/Member/exercises.vue'),
        name: 'exercises',
        meta: { layout: 'AppLayout', isPartials: true },
    },
    {
        path: '/workouts',
        component: () => import('@/views/Member/LogWorkout.vue'),
        name: 'workouts',
        meta: { layout: 'AppLayout', isPartials: true },
    },
    {
        path: '/workout-log',
        redirect: { name: 'workouts' },
    },
    {
        path: '/workout-builder',
        component: () => import('@/views/Member/WorkoutBuilder.vue'),
        name: 'workout_builder',
        meta: { layout: 'AppLayout', isPartials: true },
    },
    {
        path: '/find-plans',
        component: () => import('@/views/Member/FindPlans.vue'),
        name: 'find_plans',
        meta: { layout: 'AppLayout', isPartials: true },
    },
    {
        path: '/workouts/:planId',
        component: () => import('@/views/Member/WorkoutDetail.vue'),
        name: 'workout_detail',
        meta: { layout: 'AppLayout', isPartials: true },
    },
    {
        path: '/progress',
        component: () => import('@/views/Member/ProgressStats.vue'),
        name: 'progress_stats',
        meta: { layout: 'AppLayout', isPartials: true },
    },
    {
        path: '/settings',
        component: () => import('@/views/Member/UserSettings.vue'),
        name: 'user_settings',
        meta: { layout: 'AppLayout', isPartials: true },
    },
    {
        path: '/notifications',
        component: () => import('@/views/Member/Notifications.vue'),
        name: 'notifications',
        meta: { layout: 'AppLayout', isPartials: true },
    },
    {
        path: '/help',
        component: () => import('@/views/Member/Help.vue'),
        name: 'help',
        meta: { layout: 'AppLayout', isPartials: true },
    },
    {
        path: '/admin/users',
        component: () => import('@/views/Member/AdminUsers.vue'),
        name: 'admin_users',
        meta: { layout: 'AppLayout', isPartials: true },
    },
    {
        path: '/admin/roles',
        component: () => import('@/views/Member/AdminRoles.vue'),
        name: 'admin_roles',
        meta: { layout: 'AppLayout', isPartials: true },
    },
    {
        path: '/tools',
        component: () => import('@/views/ToolsView.vue'),
        name: 'admin_tools',
        meta: { layout: 'AppLayout', isPartials: true },
    },
    {
        path: '/admin/test-roles',
        component: () => import('@/views/Member/AdminRoleTester.vue'),
        name: 'admin_test_roles',
        meta: { layout: 'AppLayout', isPartials: true },
    },
    {
        path: '/hrm-dashboard',
        component: HomeView,
        name: 'hrm_dashboard',
        meta: { layout: 'AppLayout', isPartials: true },
    },
    {
        path: '/view-profile',
        component: () => import('@/views/template/pages/user/ViewProfile.vue'),
        name: 'view_profile',
        meta: { layout: 'AppLayout', isPartials: true },
    },
    {
        path: '/edit-profile',
        component: () => import('@/views/template/pages/user/EditProfile.vue'),
        name: 'edit_profile',
        meta: { layout: 'AppLayout', isPartials: true },
    },
];

// appRoutes = appRoutes.concat(pagesRoutes, errorPageRoutes);
let appRoutes = [];
appRoutes.push(...guestRoutes);
appRoutes.push(...pagesRoutes);
appRoutes.push(...errorPageRoutes);


export default appRoutes;
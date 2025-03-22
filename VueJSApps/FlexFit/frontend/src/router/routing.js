
//Default Home Page
import HomeView from '@/views/HomeDashboard.vue'


//Guest Routes
const guestRoutes = [
    {
        path: '/login',
        component: () => import('@/views/Guest/Login.vue'),
        name: 'login',
        meta: { layout: 'GuestLayout' },
    },
    {
        path: '/registration',
        component: () => import('@/views/Guest/Registration.vue'),
        name: 'registration',
        meta: { layout: 'GuestLayout' },
    },
    {
        path: '/reset-password',
        component: () => import('@/views/template/pages/authentication/ResetPassword.vue'),
        name: 'reset_password',
        meta: { layout: 'GuestLayout' },
    },
    {
        path: '/update-password',
        component: () => import('@/views/template/pages/authentication/UpdatePassword.vue'),
        name: 'update_password',
        meta: {layout: 'GuestLayout'}
    },
    {
        path: '/login-status',
        component: () => import('@/views/template/pages/authentication/LoginStatus.vue'),
        name: 'login_status',
        meta: {layout: 'GuestLayout'}
    },
    {
        path: '/account-deactivated',
        component: () => import('@/views/template/pages/authentication/AccountDeactivated.vue'),
        name: 'account_deactivated',
        meta: {
            layout: 'GuestLayout'
        }
    },
    {
        path: '/welcome',
        component: () => import('@/views/template/pages/authentication/Welcome.vue'),
        name: 'welcome',
        meta: {layout: 'GuestLayout'}
    },
    {
        path: '/email-verify',
        component: () => import('@/views/template/pages/authentication/EmailVerify.vue'),
        name: 'email_verify',
        meta: {layout: 'GuestLayout'}
    },
    {
        path: '/two-factor',
        component: () => import('@/views/template/pages/authentication/TwoFactor.vue'),
        name: 'two_factor',
        meta: {layout: 'GuestLayout'}
    },
    {
        path: '/multi-step-signup',
        component: () => import('@/views/template/pages/authentication/MultiStepSignup.vue'),
        name: 'multi_step_signup',
        meta: {layout: 'GuestLayout'}
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
        path: '/pricing-table',
        component: () => import('@/views/template/pages/additional/PricingTable.vue'),
        name: 'pricing_table',
        meta: {layout: 'GuestLayout'}
    },
    {
        path: '/pricing-table-2',
        component: () => import('@/views/template/pages/additional/PricingTable2.vue'),
        name: 'pricing_table_2',
        meta: {layout: 'GuestLayout'}
    },
    {
        path: '/under-construction',
        component: () => import('@/views/template/pages/additional/UnderConstruction.vue'),
        name: 'under_construction',
        meta: {layout: 'GuestLayout'}
    },
    {
        path: '/card-declined',
        component: () => import('@/views/template/pages/authentication/CardDeclined.vue'),
        name: 'card_declined',
        meta: {layout: 'BlankLayout'}
    },
    {
        path: '/promotion',
        component: () => import('@/views/template/pages/authentication/Promotion.vue'),
        name: 'promotion',
        meta: {layout: 'BlankLayout'}
    },
    {
        path: '/subscription-confirm',
        component: () => import('@/views/template/pages/authentication/SubscriptionConfirm.vue'),
        name: 'subscription_confirm',
        meta: {layout: 'BlankLayout'}
    },
    {
        path: '/welcome-mail',
        component: () => import('@/views/template/pages/authentication/WelcomeMail.vue'),
        name: 'welcome_mail',
        meta: {layout: 'BlankLayout'}
    },
    {
        path: '/reset-password-mail',
        component: () => import('@/views/template/pages/authentication/ResetPasswordMail.vue'),
        name: 'reset_password_mail',
        meta: {layout: 'BlankLayout'}
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
        path: '/log_workout',
        component: () => import('@/views/LogWorkout.vue'),
        name: 'log_workout',
        meta: { layout: 'AppLayout', isPartials: true },
    },
    {
        path: '/crm-dashboard',
        component: () => import('@/views/template/dashboard/CrmDashboard.vue'),
        name: 'crm_dashboard',
        meta: { layout: 'AppLayout', isPartials: true },
    },
    {
        path: '/hrm-dashboard',
        component: HomeView,
        name: 'hrm_dashboard',
        meta: { layout: 'AppLayout', isPartials: true },
    },
    {
        path: '/audience',
        component: () => import('@/views/template/apps/crm/Audience.vue'),
        name: 'crm_audience',
        meta: { layout: 'AppLayout', isPartials: true },
    },
    {
        path: '/company',
        component: () => import('@/views/template/apps/crm/Company.vue'),
        name: 'crm_company',
        meta: { layout: 'AppLayout', isPartials: true },
    },
    {
        path: '/task',
        component: () => import('@/views/template/apps/crm/Task.vue'),
        name: 'crm_task',
        meta: { layout: 'AppLayout', isPartials: true },
    },
    {
        path: '/leads',
        component: () => import('@/views/template/apps/crm/Leads.vue'),
        name: 'crm_leads',
        meta: { layout: 'AppLayout', isPartials: true },
    },
    {
        path: '/customer',
        component: () => import('@/views/template/apps/crm/Customer.vue'),
        name: 'crm_customer',
        meta: { layout: 'AppLayout', isPartials: true },
    },
    {
        path: '/add-employee',
        component: () => import('@/views/template/apps/hrm/AddEmployee.vue'),
        name: 'hrm_add_employee',
        meta: { layout: 'AppLayout', isPartials: true },
    },
    {
        path: '/all-employee',
        component: () => import('@/views/template/apps/hrm/AllEmployee.vue'),
        name: 'hrm_all_employee',
        meta: { layout: 'AppLayout', isPartials: true },
    },
    {
        path: '/attendance',
        component: () => import('@/views/template/apps/hrm/Attendance.vue'),
        name: 'hrm_attendance',
        meta: { layout: 'AppLayout', isPartials: true },
    },
    {
        path: '/all-customer',
        component: () => import('@/views/template/apps/ecommerce/AllCustomer.vue'),
        name: 'all_customer',
        meta: { layout: 'AppLayout', isPartials: true },
    },
    {
        path: '/add-product',
        component: () => import('@/views/template/apps/ecommerce/AddProduct.vue'),
        name: 'add_product',
        meta: { layout: 'AppLayout', isPartials: true },
    },
    {
        path: '/all-product',
        component: () => import('@/views/template/apps/ecommerce/AllProduct.vue'),
        name: 'all_product',
        meta: { layout: 'AppLayout', isPartials: true },
    },
    {
        path: '/category',
        component: () => import('@/views/template/apps/ecommerce/Category.vue'),
        name: 'category',
        meta: { layout: 'AppLayout', isPartials: true },
    },
    {
        path: '/order',
        component: () => import('@/views/template/apps/ecommerce/Order.vue'),
        name: 'order',
        meta: { layout: 'AppLayout', isPartials: true },
    },
    {
        path: '/calendar',
        component: () => import('@/views/template/apps/Calendar.vue'),
        name: 'calendar',
        meta: { layout: 'AppLayout', isPartials: true },
    },
    {
        path: '/chat',
        component: () => import('@/views/template/apps/Chat.vue'),
        name: 'chat',
        meta: { layout: 'AppLayout', isPartials: true },
    },
    {
        path: '/email',
        component: () => import('@/views/template/apps/Email.vue'),
        name: 'email',
        meta: { layout: 'AppLayout', isPartials: true },
    },
    {
        path: '/invoices',
        component: () => import('@/views/template/apps/Invoices.vue'),
        name: 'invoices',
        meta: { layout: 'AppLayout', isPartials: true },
    },
    {
        path: '/contact',
        component: () => import('@/views/template/apps/Contact.vue'),
        name: 'contact',
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
    {
        path: '/sweet-alert',
        component: () => import('@/views/template/components/advanceUI/SweetAlert.vue'),
        name: 'sweet_alert',
        meta: { layout: 'AppLayout', isPartials: true },
    },
    {
        path: '/nestable-list',
        component: () => import('@/views/template/components/advanceUI/NestableList.vue'),
        name: 'nestable_list',
        meta: { layout: 'AppLayout', isPartials: true },
    },
    {
        path: '/animation',
        component: () => import('@/views/template/components/advanceUI/Animation.vue'),
        name: 'animation',
        meta: { layout: 'AppLayout', isPartials: true },
    },
    {
        path: '/swiper-slider',
        component: () => import('@/views/template/components/advanceUI/SwiperSlider.vue'),
        name: 'swiper_slider',
        meta: { layout: 'AppLayout', isPartials: true },
    },
    {
        path: '/form',
        component: () => import('@/views/template/components/Form.vue'),
        name: 'form',
        meta: { layout: 'AppLayout', isPartials: true },
    },
    {
        path: '/table',
        component: () => import('@/views/template/components/Table.vue'),
        name: 'table',
        meta: { layout: 'AppLayout', isPartials: true },
    },
    {
        path: '/charts',
        component: () => import('@/views/template/components/Charts.vue'),
        name: 'charts',
        meta: { layout: 'AppLayout', isPartials: true },
    },
    {
        path: '/icon',
        component: () => import('@/views/template/components/Icon.vue'),
        name: 'icon',
        meta: { layout: 'AppLayout', isPartials: true },
    },
    {
        path: '/map',
        component: () => import('@/views/template/components/Map.vue'),
        name: 'map',
        meta: { layout: 'AppLayout', isPartials: true },
    },
    {
        path: '/file-manager',
        component: () => import('@/views/template/components/FileManager.vue'),
        name: 'file_manager',
        meta: { layout: 'AppLayout', isPartials: true },
    },
    {
        path: '/utility',
        component: () => import('@/views/template/pages/Utility.vue'),
        name: 'utility',
        meta: { layout: 'AppLayout', isPartials: true },
    },
];

// appRoutes = appRoutes.concat(pagesRoutes, errorPageRoutes);
let appRoutes = [];
appRoutes.push(...guestRoutes);
appRoutes.push(...pagesRoutes);
appRoutes.push(...errorPageRoutes);


export default appRoutes;
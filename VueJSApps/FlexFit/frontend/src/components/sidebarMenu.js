import {ref} from "vue";

export const sidebarMenus = ref([
    {
        menu_name: 'sidebar.dashboard',
        menus: [
            {
                name: 'Home',
                link_name: 'dashboard_index',
                icon: 'fa-solid fa-house'              
            },
            {
                name: 'Exercises',
                link_name: 'exercises',
                icon: 'fa-solid fa-person-walking'              
            },
            {
                name: 'Workouts',
                link_name: 'workouts',
                icon: 'fa-solid fa-list-check'
            },
            {
                name: 'Workout Builder',
                link_name: 'workout_builder',
                icon: 'fa-solid fa-dumbbell'
            },
            {
                name: 'Nutrition',
                link_name: 'Nutrition',
                icon: 'fa-solid fa-utensils'
            },
            {
                name: 'Settings',
                link_name: 'user_settings',
                icon: 'fa-solid fa-gear'
            },
            {
                name: 'Logout',
                link_name: 'logout',
                icon: 'fa-light fa-calendar'
            },
        ]
    },
    {
        menu_name: 'Administrator',
        linkClass: 'admin-black',
        menus: [
            {
                name: 'View Progress',
                link_name: 'dashboard_index',
                icon: 'fa-solid fa-chart-line'
            },
            {
                name: 'Upload Picture',
                link_name: 'dashboard_index',
                icon: 'fa-solid fa-images'
            },
            {
                name: 'Chat with Trainer',
                link_name: 'dashboard_index',
                icon: 'fa-regular fa-message'
            },
            {
                name: 'Scheduling',
                link_name: 'calendar',
                icon: 'fa-light fa-calendar'
            },
            {
                name: 'Users',
                link_name: 'admin_users',
                icon: 'fa-solid fa-users'
            },
            {
                name: 'Roles',
                link_name: 'admin_roles',
                icon: 'fa-solid fa-id-badge'
            },
            {
                name: 'Test Roles',
                link_name: 'admin_test_roles',
                icon: 'fa-solid fa-vial-circle-check'
            },
        ]
    },
 
    {
        menu_name: 'More Pages',
        menus: [
            {
                name: 'Authentication',
                icon: 'fa-light fa-user-cog',
                sub_menus: [
                    {
                        name: 'Reset Password',
                        link_name: 'reset_password'
                    },
                    {
                        name: 'Update Password',
                        link_name: 'update_password'
                    },
                    {
                        name: 'Login Status',
                        link_name: 'login_status'
                    },
                    {
                        name: 'Account Deactivated',
                        link_name: 'account_deactivated'
                    },
                    {
                        name: 'Welcome',
                        link_name: 'welcome'
                    },
                    {
                        name: 'Verify Email',
                        link_name: 'email_verify'
                    },
                    {
                        name: '2 Factor Verification',
                        link_name: 'two_factor'
                    },
                    {
                        name: 'Multi Step Signup',
                        link_name: 'multi_step_signup'
                    },
                ]
            },
            {
                name: 'Error Pages',
                icon: 'fa-light fa-triangle-exclamation',
                sub_menus: [
                    {
                        name: 'Error 400',
                        link_name: 'error_400'
                    },
                    {
                        name: 'Error 403',
                        link_name: 'error_403'
                    },
                    {
                        name: 'Error 404',
                        link_name: 'error_404'
                    },
                    {
                        name: 'Error 408',
                        link_name: 'error_408'
                    },
                    {
                        name: 'Error 500',
                        link_name: 'error_500'
                    },
                    {
                        name: 'Error 503',
                        link_name: 'error_503'
                    },
                    {
                        name: 'Error 504',
                        link_name: 'error_504'
                    },
                ]
            },           
            
        ]
    }
    
])
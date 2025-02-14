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
                name: 'login',
                link_name: 'login',
                icon: 'fa-solid fa-house'              
            },

            {
                name: 'Log Workout',
                link_name: 'log_workout',
                icon: 'fa-solid fa-dumbbell'
            },

            {
                name: 'Log Nutrition',
                link_name: 'log_workout',
                icon: 'fa-solid fa-utensils'
            },
            {
                name: 'View Progress',
                link_name: 'log_workout',
                icon: 'fa-solid fa-chart-line'
            },
            {
                name: 'Upload Picture',
                link_name: 'log_workout',
                icon: 'fa-solid fa-images'
            },
            {
                name: 'Chat with Trainer',
                link_name: 'log_workout',
                icon: 'fa-regular fa-message'
            },
            {
                name: 'Scheduling',
                link_name: 'calendar',
                icon: 'fa-light fa-calendar'
            },
            {
                name: 'User Settings',
                icon: 'fa-light fa-user',
                sub_menus: [
                    {
                        name: 'View Profile',
                        link_name: 'view_profile'
                    },
                    {
                        name: 'Edit Profile',
                        link_name: 'edit_profile'
                    },
                ]
            },
            {
                name: 'Logout',
                link_name: 'calendar',
                icon: 'fa-light fa-calendar'
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
                        name: 'Login 01',
                        link_name: 'login'
                    },
                    {
                        name: 'Registration 01',
                        link_name: 'registration'
                    },
                    {
                        name: 'Registration 02',
                        link_name: 'registration_2'
                    },
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
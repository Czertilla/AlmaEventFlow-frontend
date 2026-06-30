import { createRouter, createWebHistory } from '@ionic/vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes: Array<RouteRecordRaw> = [
  // Auth pages
  {
    path: '/auth/login',
    component: () => import('@/views/auth/LoginPage.vue'),
    meta: { guest: true },
  },
  {
    path: '/auth/register',
    component: () => import('@/views/auth/RegisterPage.vue'),
    meta: { guest: true },
  },
  {
    path: '/auth/verify',
    component: () => import('@/views/auth/VerifyPage.vue'),
    meta: { guest: true },
  },
  {
    path: '/auth/forgot-password',
    component: () => import('@/views/auth/ForgotPasswordPage.vue'),
    meta: { guest: true },
  },
  {
    path: '/auth/reset-password',
    component: () => import('@/views/auth/ResetPasswordPage.vue'),
    meta: { guest: true },
  },
  // Main
  {
    path: '/',
    component: () => import('@/views/main/HomePage.vue'),
    meta: { auth: true },
  },
  // Event detail
  {
    path: '/event/:id',
    component: () => import('@/views/EventDetailPage.vue'),
    meta: { auth: true },
  },
  // Principal panel
  {
    path: '/principal',
    redirect: '/principal/members',
  },
  {
    path: '/principal/members',
    component: () => import('@/views/principal/MembersPage.vue'),
    meta: { auth: true, principal: true },
  },
  {
    path: '/principal/roles',
    component: () => import('@/views/principal/RolesPage.vue'),
    meta: { auth: true, principal: true },
  },
  {
    path: '/principal/events',
    component: () => import('@/views/principal/EventsPage.vue'),
    meta: { auth: true, principal: true },
  },
  // Admin panel
  {
    path: '/admin',
    redirect: '/admin/users',
  },
  {
    path: '/admin/users',
    component: () => import('@/views/admin/AdminUsers.vue'),
    meta: { auth: true, sup: true },
  },
  {
    path: '/admin/persons',
    component: () => import('@/views/admin/AdminPersons.vue'),
    meta: { auth: true, sup: true },
  },
  {
    path: '/admin/organizations',
    component: () => import('@/views/admin/AdminOrganizations.vue'),
    meta: { auth: true, sup: true },
  },
  {
    path: '/admin/collectives',
    component: () => import('@/views/admin/AdminCollectives.vue'),
    meta: { auth: true, sup: true },
  },
  {
    path: '/admin/profiles',
    component: () => import('@/views/admin/AdminProfiles.vue'),
    meta: { auth: true, sup: true },
  },
  {
    path: '/admin/persons/:id',
    component: () => import('@/views/admin/AdminPersonFile.vue'),
    meta: { auth: true, sup: true },
  },
  {
    path: '/admin/students',
    component: () => import('@/views/admin/AdminStudents.vue'),
    meta: { auth: true, sup: true },
  },
  {
    path: '/admin/diets',
    component: () => import('@/views/admin/AdminDiets.vue'),
    meta: { auth: true, sup: true },
  },
  {
    path: '/admin/geo',
    component: () => import('@/views/admin/AdminGeo.vue'),
    meta: { auth: true, sup: true },
  },
  {
    path: '/admin/events',
    component: () => import('@/views/admin/AdminEvents.vue'),
    meta: { auth: true, sup: true },
  },
  {
    path: '/admin/participation',
    component: () => import('@/views/admin/AdminParticipation.vue'),
    meta: { auth: true, sup: true },
  },
  {
    path: '/admin/attendance',
    component: () => import('@/views/admin/AdminAttendance.vue'),
    meta: { auth: true, sup: true },
  },
  {
    path: '/admin/members',
    component: () => import('@/views/admin/AdminMembers.vue'),
    meta: { auth: true, sup: true },
  },
  {
    path: '/admin/roles',
    component: () => import('@/views/admin/AdminRoles.vue'),
    meta: { auth: true, sup: true },
  },
  // Settings & Profile
  {
    path: '/settings',
    component: () => import('@/views/SettingsPage.vue'),
    meta: { auth: true },
  },
  {
    path: '/calendar-subscriptions',
    component: () => import('@/views/CalendarSubscriptionsPage.vue'),
    meta: { auth: true },
  },
  {
    path: '/notifications',
    component: () => import('@/views/NotificationsPage.vue'),
    meta: { auth: true },
  },
  {
    path: '/profile',
    component: () => import('@/views/ProfilePage.vue'),
    meta: { auth: true },
  },
  {
    path: '/profile/sessions',
    component: () => import('@/views/SessionsPage.vue'),
    meta: { auth: true },
  },
  // Fallback
  {
    path: '/:pathMatch(.*)*',
    redirect: '/',
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

router.beforeEach(async (to, _from, next) => {
  const auth = useAuthStore()
  // Try to refresh token on first load
  if (!auth.isAuthenticated && !auth.accessToken) {
    await auth.tryRefresh()
  }
  // Check principal status
  if (to.meta.principal && !auth.user) {
    await auth.fetchUser()
  }
  const isAuthenticated = auth.isAuthenticated
  const isSuperuser = auth.isSuperuser
  const guestOnly = to.meta.guest
  const needsAuth = to.meta.auth
  const needsSup = to.meta.sup
  if (guestOnly && isAuthenticated) {
    return next('/')
  }
  if (needsAuth && !isAuthenticated) {
    return next('/auth/login')
  }
  if (needsSup && !isSuperuser) {
    return next('/')
  }
  next()
})

export default router

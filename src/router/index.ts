import { createRouter, createWebHistory } from '@ionic/vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { usePrincipalStore } from '@/stores/principal'
import { isNavigating } from '@/composables/useNavigationProgress'

// Аутентифицированные страницы живут детьми TabsShell, поэтому их рендерит
// внутренний ion-router-outlet внутри ion-tabs (отдельные стеки на вкладку,
// корректная аппаратная кнопка «Назад»). Пути абсолютные — публичные URL не меняются.
const appRoutes: Array<RouteRecordRaw> = [
  // Main
  {
    path: '',
    component: () => import('@/views/main/HomePage.vue'),
    meta: { auth: true },
  },
  // Event detail
  {
    path: '/event/:id',
    component: () => import('@/views/EventDetailPage.vue'),
    meta: { auth: true },
  },
  // Principal panel: один route-матч на весь /principal/* -- PrincipalLayout
  // монтируется один раз и сам переключает вложенную страницу по route.path
  // (см. PrincipalLayout.vue). Так внутренние переходы вообще не проходят
  // через ionic'овский page-transition (нет смены route-записи -- нет и
  // входа/выхода страницы), а не просто анимируются иначе.
  {
    path: '/principal',
    redirect: '/principal/dashboard',
  },
  {
    path: '/principal/:pathMatch(.*)*',
    component: () => import('@/components/layout/PrincipalLayout.vue'),
    meta: { auth: true, principal: true },
  },
  // Admin panel -- тот же приём: один route-матч, AdminLayout сам решает,
  // какую ресурсную страницу показать.
  {
    path: '/admin',
    redirect: '/admin/users',
  },
  {
    path: '/admin/:pathMatch(.*)*',
    component: () => import('@/components/layout/AdminLayout.vue'),
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
    path: '/changelog',
    component: () => import('@/views/ChangelogPage.vue'),
    meta: { auth: true },
  },
  {
    path: '/profile',
    component: () => import('@/views/ProfilePage.vue'),
    meta: { auth: true },
  },
  {
    path: '/profile/edit',
    component: () => import('@/views/EditProfilePage.vue'),
    meta: { auth: true },
  },
  {
    path: '/profile/sessions',
    component: () => import('@/views/SessionsPage.vue'),
    meta: { auth: true },
  },
]

const routes: Array<RouteRecordRaw> = [
  // Auth pages — вне оболочки вкладок (полноэкранные, без таб-бара)
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
  {
    path: '/auth/link-invite',
    component: () => import('@/views/auth/LinkInvitePage.vue'),
    meta: { auth: true },
  },
  // Authenticated app shell with tab navigation
  {
    path: '/',
    component: () => import('@/components/layout/TabsShell.vue'),
    children: appRoutes,
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

// Попытку refresh делаем один раз за загрузку приложения: иначе аноним дёргает
// /auth/jwt/refresh на каждой навигации (после первой неудачи токена так и нет).
let refreshAttempted = false

router.beforeEach(async (to, _from, next) => {
  isNavigating.value = true
  const auth = useAuthStore()
  if (!auth.isAuthenticated && !auth.accessToken && !refreshAttempted) {
    refreshAttempted = true
    await auth.tryRefresh()
  }
  const isAuthenticated = auth.isAuthenticated
  const isSuperuser = auth.isSuperuser
  const guestOnly = to.meta.guest
  const needsAuth = to.meta.auth
  const needsSup = to.meta.sup
  const needsPrincipal = to.meta.principal
  if (guestOnly && isAuthenticated) {
    if (to.path === '/auth/register' && typeof to.query.token === 'string' && to.query.token) {
      return next({ path: '/auth/link-invite', query: { token: to.query.token } })
    }
    return next('/')
  }
  if (needsAuth && !isAuthenticated) {
    return next('/auth/login')
  }
  if (needsSup && !isSuperuser) {
    return next('/')
  }
  // Панель руководителя доступна только пользователям с членством-руководителем.
  // fetchCollectives дедуплицирован (inFlight) — повторно сеть не дёргает.
  if (needsPrincipal) {
    const principal = usePrincipalStore()
    if (!auth.user) await auth.fetchUser()
    await principal.fetchCollectives()
    if (!principal.isPrincipal) return next('/')
  }
  next()
})

router.afterEach(() => {
  isNavigating.value = false
})

router.onError(() => {
  isNavigating.value = false
})

export default router

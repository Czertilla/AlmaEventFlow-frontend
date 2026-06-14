# AlmaEventFlow — Roadmap

## Stack
- Vue 3 + Ionic 8 + Vite 5
- Pinia, Axios, date-fns, jwt-decode
- orval (генерация типов/клиентов из openapi.json)
- Самописный календарь (стиль Ant Design)

## Auth
- accessToken → in-memory (Pinia `auth.ts`)
- refreshToken → httpOnly cookie (`auth`), автоматически на POST `/user/v1/auth/jwt/refresh`
- Axios interceptor: Bearer header; 401 → refresh → retry

## Layout (адаптивный)
- Desktop (>=768px): DesktopHeader + router-view
- Mobile (<768px): MobileHeader + BottomNav + router-view
- Admin (sup): боковое меню слева (все платформы)

## Routes
| Path | View | Guard |
|------|------|-------|
| /auth/login | LoginPage | guest |
| /auth/register | RegisterPage | guest |
| /auth/verify | VerifyPage | guest |
| / | HomePage | auth |
| /event/:id | EventDetailPage | auth |
| /principal/* | Members, Roles, Events | auth+isPrincipal |
| /admin/* | Users, Persons, Orgs... | auth+sup |
| /settings | SettingsPage | auth |
| /profile | ProfilePage | auth |

## Structure src/
```
api/        → generated (orval) + client.ts
stores/     → auth, settings, eventCalendar, principal
composables/→ usePlatform, useTimer, useCalendarSync, useFormValidation
views/      → auth/, main/, principal/, admin/ + EventDetail, Settings
components/ → layout/, calendar/, event/, auth/, admin/, common/
theme/      → variables.css
```

## Phases
0. deps (pinia, axios, date-fns, jwt-decode, orval)
1. api client (orval gen) + client.ts + auth store + guards
2. layout (App.vue, DesktopHeader, BottomNav, ProfileMenu)
3. auth pages (Login, Register, Verify)
4. HomePage (CalendarGrid + EventList + sync)
5. Principal panel (Members, Roles, Events + create modal)
6. Admin panel (ResourceTable + 7 subpages)
7. EventDetailPage
8. SettingsPage + ProfileMenu
9. Dark theme
10. Final check (lint, build)

## Conventions
- camelCase for vars, PascalCase for components
- All API calls → Pinia actions (not in components)
- Form validation → composable useFormValidation
- Dates → date-fns + format from settings store
- Principal = leader/руководитель (renamed per req)

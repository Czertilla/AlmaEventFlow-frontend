<template>
  <ion-page>
    <!-- Мобильная шапка: на десктопе её заменяет глобальная шапка приложения -->
    <ion-header v-if="!isDesktop">
      <ion-toolbar>
        <!-- Точка-индикатор коллектива живёт здесь, а НЕ внутри ion-title:
             ion-title рендерит слот через свой внутренний .toolbar-title
             (overflow: hidden в его собственном shadow DOM, см.
             @ionic/core/.../title.md.css) -- что угодно, вынесенное оттуда
             через position:absolute с отрицательным отступом, было бы
             обрезано этим overflow. Здесь же, в ion-buttons (overflow не
             задан), точка спокойно свисает в отступе СПРАВА от кнопки назад,
             никак не влияя на ширину/положение ion-buttons и, значит, не
             сдвигая сам ion-title -- поэтому текст начинается ровно там же,
             где и обычный <ion-title>{{ title }}</ion-title> в других
             разделах (см. AdminLayout.vue). -->
        <ion-buttons slot="start" class="collective-buttons">
          <ion-back-button default-href="/" />
          <span class="collective-select-dot" :style="{ background: activeColor }" />
        </ion-buttons>
        <ion-title>
          <div class="collective-select collective-select--toolbar">
            <select
              class="collective-select-input"
              :value="principal.activePrincipalCollectiveId ?? ''"
              @change="onCollectiveChange(($event.target as HTMLSelectElement).value)"
            >
              <option v-for="c in principal.principalCollectives" :key="c.id" :value="c.id">
                {{ c.name }}
              </option>
            </select>
            <ion-icon :icon="chevronDownOutline" class="collective-select-arrow" />
          </div>
        </ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <div class="principal-shell">
        <!-- Заголовок и навигация всегда в одной и той же колонке, независимо
             от fullWidth страницы -- иначе на дашборде (full-width) они
             растягивались на всю ширину, а на остальных страницах панели
             оставались в узкой колонке, и панель навигации визуально «плавала». -->
        <div class="principal-top-col">
          <!-- Заголовок панели (десктоп) -- НЕ переключатель: сам коллектив
               уже выбирается в глобальной шапке (DesktopHeader -- дропдаун
               "Руководитель"), второй интерактивный select здесь был лишним
               и вводил в заблуждение. Просто название текущего коллектива. -->
          <div v-if="isDesktop" class="collective-title">
            <span class="collective-select-dot" :style="{ background: activeColor }" />
            <span class="collective-title-name">{{ activeCollectiveName }}</span>
          </div>

          <div class="principal-top">
            <!-- Навигация по разделам панели -->
            <nav class="principal-tabs">
              <button
                v-for="tab in TABS"
                :key="tab.path"
                type="button"
                class="principal-tab"
                :class="{ 'principal-tab--active': activeSection === tab.path }"
                @click="goTab(tab.path)"
              >
                <ion-icon :icon="tab.icon" />
                {{ tab.label }}
              </button>
            </nav>

            <!-- Десктоп: кнопка добавления записи (регистрирует активная дочерняя страница) -->
            <button v-if="pageActions.addLabel && isDesktop" class="add-btn-desktop" @click="pageActions.onAdd?.()">
              <ion-icon :icon="addOutline" />
              {{ pageActions.addLabel }}
            </button>
          </div>
        </div>

        <main class="principal-main" :class="{ 'principal-main--full': fullWidth }">
          <!-- PrincipalLayout смонтирована один раз на весь /principal/*,
               страница переключается здесь обычной Vue-реактивностью по
               activeSection, а не через vue-router -- см. goTab()/utils/inPlaceNav.ts.
               remountTick в ключе форсирует пересоздание (и повторную загрузку
               данных) при возврате в раздел -- см. onIonViewWillEnter выше. -->
          <component :is="currentPage.component" v-if="currentPage" :key="`${activeSection}-${remountTick}`" />
        </main>
      </div>
    </ion-content>

    <!-- Мобильный FAB — вне ion-content, чтобы не скроллился -->
    <AppFab v-if="pageActions.addLabel && !isDesktop" :icon="addOutline" :aria-label="pageActions.addLabel" @click="pageActions.onAdd?.()" />
  </ion-page>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, ref } from 'vue'
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton, IonIcon,
  onIonViewWillEnter,
} from '@ionic/vue'
import {
  peopleOutline, ribbonOutline, calendarOutline, chevronDownOutline, addOutline, statsChartOutline,
} from 'ionicons/icons'
import { usePrincipalStore } from '@/stores/principal'
import { usePlatform } from '@/composables/usePlatform'
import { getCollectiveColor } from '@/utils/colors'
import { syncAddressBar } from '@/utils/inPlaceNav'
import { principalPageActions as pageActions } from '@/composables/usePrincipalPageActions'
import AppFab from '@/components/common/AppFab.vue'

const principal = usePrincipalStore()
const { isDesktop } = usePlatform()

interface PrincipalPageEntry {
  fullWidth?: boolean
  component: ReturnType<typeof defineAsyncComponent>
}

const PAGES: Record<string, PrincipalPageEntry> = {
  '/principal/dashboard': {
    fullWidth: true,
    component: defineAsyncComponent(() => import('@/views/principal/DashboardPage.vue')),
  },
  '/principal/members': {
    component: defineAsyncComponent(() => import('@/views/principal/MembersPage.vue')),
  },
  '/principal/roles': {
    component: defineAsyncComponent(() => import('@/views/principal/RolesPage.vue')),
  },
  '/principal/events': {
    component: defineAsyncComponent(() => import('@/views/principal/EventsPage.vue')),
  },
}

// Активный раздел живёт в локальном состоянии, а не в route.path -- см.
// utils/inPlaceNav.ts, почему смена route.path здесь недопустима. Начальное
// значение берём из реального адреса (первый заход в /principal/* -- обычная
// vue-router навигация, значит window.location уже верный).
const activeSection = ref(window.location.pathname)

const currentPage = computed<PrincipalPageEntry | null>(() => PAGES[activeSection.value] ?? null)
const fullWidth = computed(() => !!currentPage.value?.fullWidth)

const TABS = [
  { path: '/principal/dashboard', label: 'Дашборд', icon: statsChartOutline },
  { path: '/principal/members', label: 'Участники', icon: peopleOutline },
  { path: '/principal/roles', label: 'Роли', icon: ribbonOutline },
  { path: '/principal/events', label: 'Мероприятия', icon: calendarOutline },
]

function goTab(path: string) {
  if (activeSection.value === path) return
  activeSection.value = path
  syncAddressBar(path)
}

// PrincipalLayout монтируется один раз на весь /principal/* (см. коммент выше),
// а ion-router-outlet по умолчанию кэширует уже посещённые страницы и не
// размонтирует их при переходе на другую -- поэтому обычный onMounted у
// дочерних страниц (Дашборд/Участники/...) срабатывает только один раз за всё
// время жизни вкладки браузера, а не при каждом возврате в раздел. Если данные
// изменили на другой странице (например, отметили посещаемость мероприятия) и
// вернулись назад -- дашборд показывал бы старые данные. Форсируем
// пересоздание активной дочерней страницы при каждом реальном возврате в
// раздел (см. :key ниже) -- тот же приём, что onIonViewWillEnter на HomePage,
// но здесь применяется на уровне лэйаута, а не отдельной страницы.
const remountTick = ref(0)
let firstEnter = true
onIonViewWillEnter(() => {
  if (firstEnter) { firstEnter = false; return }
  remountTick.value++
})

const activeColor = computed(() =>
  principal.activePrincipalCollectiveId ? getCollectiveColor(principal.activePrincipalCollectiveId) : '#92949c',
)

const activeCollectiveName = computed(() =>
  principal.principalCollectives.find((c) => c.id === principal.activePrincipalCollectiveId)?.name ?? '',
)

function onCollectiveChange(id: string) {
  if (id) principal.setActivePrincipalCollective(id)
}
</script>

<style scoped>
.principal-shell {
  padding: 16px;
}

.principal-top-col {
  max-width: 760px;
  margin: 0 auto;
}

.principal-top {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 16px;
}

.collective-select {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 44px;
  padding: 0 12px;
  border: 1.5px solid var(--ion-border-color);
  border-radius: 12px;
  background: var(--ion-card-background);
  box-shadow: var(--ion-card-shadow);
  transition: border-color 0.15s, box-shadow 0.15s;
}

.collective-select:focus-within,
.collective-select:hover {
  border-color: var(--ion-color-primary);
  box-shadow: 0 0 0 3px rgba(var(--ion-color-primary-rgb), 0.12);
}

.collective-select-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  flex-shrink: 0;
}

.collective-select-input {
  appearance: none;
  border: none;
  outline: none;
  background: transparent;
  font-size: var(--fs-md);
  font-weight: var(--fw-semibold);
  color: var(--ion-text-color);
  padding: 10px 22px 10px 0;
  cursor: pointer;
  max-width: 240px;
  min-width: 0;
  /* Без overflow/white-space text-overflow ничего не делает -- длинное
     название коллектива просто вылезало за пределы пилюли вместо обрезки
     многоточием, это и была "некорректная" отрисовка. */
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.collective-select-arrow {
  position: absolute;
  right: 10px;
  font-size: var(--fs-sm);
  color: var(--ion-color-medium);
  pointer-events: none;
}

/* Заголовок панели (десктоп) -- статичное название коллектива, БЕЗ select:
   переключение коллектива уже есть в глобальной шапке (DesktopHeader,
   дропдаун "Руководитель"), дублировать его тут интерактивным элементом не
   нужно -- см. комментарий в шаблоне. */
.collective-title {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  margin: 4px 0 16px;
}

.collective-title .collective-select-dot {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
}

.collective-title-name {
  font-size: var(--fs-2xl);
  font-weight: var(--fw-bold);
  color: var(--ion-text-color);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  min-width: 0;
}

/* Точка-индикатор в ion-buttons (см. комментарий в шаблоне) -- position:relative
   на самой ion-buttons даёт точке систему координат, не влияя на её ширину
   (точка absolute, из потока исключена), и свисает в отступе СПРАВА от кнопки
   назад, то есть левее текста заголовка, не сдвигая сам ion-title. */
.collective-buttons {
  position: relative;
}

.collective-buttons .collective-select-dot {
  position: absolute;
  right: -12px;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
}

/* Заголовок панели (мобильный ion-toolbar) -- единственное место, где
   коллектив реально переключается select'ом (на десктопе для этого есть
   DesktopHeader), поэтому вписан в компактную шапку. Внутри самого ion-title
   ничего, кроме select+стрелки, нет -- точка вынесена в ion-buttons (см.
   выше), поэтому текст начинается ровно там же, где и обычный
   <ion-title>{{ title }}</ion-title> в других разделах (см. AdminLayout.vue),
   а не смещён вправо на ширину точки. select и стрелка выровнены по левому
   краю вплотную друг к другу, а не раскиданы по всей ширине заголовка. */
.collective-select--toolbar {
  height: auto;
  max-width: 100%;
  min-width: 0;
  padding: 0;
  border: none;
  box-shadow: none;
  background: transparent;
  justify-content: flex-start;
  gap: 2px;
}

.collective-select--toolbar:hover,
.collective-select--toolbar:focus-within {
  box-shadow: none;
}

.collective-select--toolbar .collective-select-input {
  padding: 0;
  font-size: var(--fs-xl);
  max-width: 200px;
}

.collective-select--toolbar .collective-select-arrow {
  position: static;
  font-size: var(--fs-sm);
}

.principal-tabs {
  display: flex;
  gap: 4px;
  background: var(--ion-card-background);
  border-radius: 12px;
  padding: 4px;
  box-shadow: var(--ion-card-shadow);
  overflow-x: auto;
  scrollbar-width: none;
  /* На границе горизонтальной прокрутки свайп иначе "перетекает" на страницу
     целиком -- в Firefox это срабатывает как переход назад/вперёд по истории. */
  overscroll-behavior-x: contain;
}

/* На мобильном вкладки часто не помещаются и скроллятся вбок (скроллбар
   скрыт), но без подсказки последняя вкладка просто обрывается на границе
   контейнера и выглядит как баг. Плавное затухание с правого края -- обычный
   сигнал "тут ещё есть, крутани". Только на мобильном: на десктопе колонка
   760px и вкладки почти никогда не переполняются, гасить там нечего. */
@media (max-width: 767px) {
  .principal-tabs {
    -webkit-mask-image: linear-gradient(to right, black calc(100% - 28px), transparent 100%);
    mask-image: linear-gradient(to right, black calc(100% - 28px), transparent 100%);
  }
}

.principal-tabs::-webkit-scrollbar {
  display: none;
}

.principal-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border: none;
  border-radius: 9px;
  background: transparent;
  font-size: var(--fs-sm);
  font-weight: var(--fw-semibold);
  color: var(--ion-color-medium);
  text-decoration: none;
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.15s;
}

.principal-tab ion-icon {
  font-size: var(--fs-lg);
}

.principal-tab:hover {
  color: var(--ion-text-color);
}

.principal-tab--active {
  background: rgba(var(--ion-color-primary-rgb), 0.1);
  color: var(--ion-color-primary);
}

.principal-main {
  max-width: 760px;
  margin: 0 auto;
  min-width: 0;
}

.principal-main--full {
  max-width: none;
}

.add-btn-desktop {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 18px;
  border: none;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--ion-color-primary), var(--ion-color-primary-shade));
  color: white;
  font-size: var(--fs-md);
  font-weight: var(--fw-semibold);
  cursor: pointer;
  transition: all 0.15s;
}

.add-btn-desktop:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(var(--ion-color-primary-rgb), 0.3);
}

.add-btn-desktop ion-icon {
  font-size: var(--fs-xl);
}
</style>

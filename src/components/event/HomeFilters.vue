<template>
  <div class="home-filters">
    <div class="filters">
      <button
        class="filter-chip filter-chip--all"
        :class="{ 'filter-chip--active': principal.showAllEvents }"
        :disabled="loading"
        @click="principal.toggleShowAllEvents()"
      >
        Все мероприятия
      </button>
      <template v-if="loading && principal.collectives.length === 0">
        <div v-for="n in 3" :key="n" class="filter-chip filter-chip--skeleton">
          <span class="filter-dot filter-dot--skeleton" />
          <span class="filter-chip-text">
            <span class="filter-chip-name-skeleton" />
            <span class="filter-chip-role-skeleton" />
          </span>
        </div>
      </template>
      <button
        v-for="c in principal.collectives"
        :key="c.id"
        class="filter-chip"
        :class="{
          'filter-chip--active': !principal.showAllEvents && principal.isCollectiveSelected(c.id),
          'filter-chip--blocked': principal.showAllEvents,
        }"
        :disabled="principal.showAllEvents || loading"
        @click="principal.selectCollective(c.id)"
      >
        <span class="filter-dot" :style="{ background: c.color || getColor(c.id) }" />
        <span class="filter-chip-text">
          <span class="filter-chip-name">{{ c.name }}</span>
          <span class="filter-chip-role">{{ roleLabel(c.id) }}</span>
        </span>
      </button>
      <span v-if="!loading && principal.collectives.length === 0" class="filters-empty">Нет коллективов</span>
    </div>

    <div class="filters-divider" />
    <label class="ui-toggle-row">
      <span>
        Только предстоящие
        <HelpTip text="Сегодняшние и будущие мероприятия, прошедшие скрыты." />
      </span>
      <ion-toggle
        :checked="upcoming"
        aria-label="Только предстоящие"
        @ion-change="upcoming = $event.detail.checked"
      />
    </label>

    <template v-if="principal.isPrincipal">
      <span class="filters-sublabel">Статус мероприятия</span>
      <div class="ui-chips">
        <button class="ui-chip" :class="{ 'ui-chip--active': statuses.length === 0 }" @click="statuses = []">
          Любой
        </button>
        <button
          v-for="[value, label] in STATUS_OPTIONS"
          :key="value"
          class="ui-chip"
          :class="{ 'ui-chip--active': statuses.includes(value) }"
          @click="statuses = toggled(statuses, value)"
        >
          {{ label }}
        </button>
      </div>
    </template>

    <span class="filters-sublabel">Тип</span>
    <div class="ui-chips">
      <button class="ui-chip" :class="{ 'ui-chip--active': types.length === 0 }" @click="types = []">Все</button>
      <button
        v-for="[value, label] in typeOptions"
        :key="value"
        class="ui-chip"
        :class="{ 'ui-chip--active': types.includes(value) }"
        :style="types.includes(value) ? typeStyle(value) : undefined"
        @click="types = toggled(types, value)"
      >
        {{ label }}
      </button>
    </div>

    <span class="filters-sublabel">Уровень</span>
    <div class="ui-chips">
      <button class="ui-chip" :class="{ 'ui-chip--active': levels.length === 0 }" @click="levels = []">Все</button>
      <button
        v-for="[value, label] in levelOptions"
        :key="value"
        class="ui-chip"
        :class="{ 'ui-chip--active': levels.includes(value) }"
        @click="levels = toggled(levels, value)"
      >
        {{ label }}
      </button>
    </div>

    <span class="filters-sublabel">Формат</span>
    <div class="ui-chips">
      <button class="ui-chip" :class="{ 'ui-chip--active': formats.length === 0 }" @click="formats = []">Все</button>
      <button
        v-for="[value, label] in formatOptions"
        :key="value"
        class="ui-chip"
        :class="{ 'ui-chip--active': formats.includes(value) }"
        @click="formats = toggled(formats, value)"
      >
        {{ label }}
      </button>
    </div>

    <button v-if="changed" class="ui-btn ui-btn--ghost ui-btn--sm reset-btn" @click="emit('reset')">
      Сбросить фильтры
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { IonToggle } from '@ionic/vue'
import HelpTip from '@/components/common/HelpTip.vue'
import { usePrincipalStore } from '@/stores/principal'
import { getCollectiveColor } from '@/utils/colors'
import { typeOptions, levelOptions, formatOptions, statusOptions, typeColor } from '@/utils/eventLabels'
import { LISTED_STATUSES, toggled } from '@/utils/homeFilters'
import type {
  EventStatusEnumV1, EventTypeEnumV1, EventLevelEnumV1, EventFormatEnumV1,
} from '@/api/generated/almaEventFlow'

defineProps<{
  loading?: boolean
  changed?: boolean
}>()

const emit = defineEmits<{ reset: [] }>()

const statuses = defineModel<EventStatusEnumV1[]>('statuses', { required: true })
const types = defineModel<EventTypeEnumV1[]>('types', { required: true })
const levels = defineModel<EventLevelEnumV1[]>('levels', { required: true })
const formats = defineModel<EventFormatEnumV1[]>('formats', { required: true })
const upcoming = defineModel<boolean>('upcoming', { required: true })

const principal = usePrincipalStore()
const getColor = getCollectiveColor

// Статус доступен только руководителю (участник всегда видит лишь активные), шаблоны в списке не показываются
const STATUS_OPTIONS = computed(() => statusOptions.filter(([value]) => LISTED_STATUSES.includes(value)))

function typeStyle(value: EventTypeEnumV1) {
  const color = typeColor(value)
  return { borderColor: color, color, background: `${color}1A` }
}

// Роль пользователя в коллективе для подписи на чипе фильтра
function roleLabel(collectiveId: string): string {
  const isP = principal.principalCollectiveIds.has(collectiveId)
  const isM = principal.userMemberIds.has(collectiveId)
  if (isP && isM) return 'Руководитель · Участник'
  if (isP) return 'Руководитель'
  return 'Участник'
}
</script>

<style scoped>
.filters {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border: 1.5px solid var(--ion-border-color);
  border-radius: 10px;
  background: transparent;
  font-size: var(--fs-sm);
  font-weight: var(--fw-medium);
  color: var(--ion-color-medium);
  cursor: pointer;
  transition: all 0.2s;
}

.filter-chip:hover {
  border-color: var(--ion-color-step-400);
}

.filter-chip--active {
  border-color: var(--ion-color-primary);
  background: rgba(var(--ion-color-primary-rgb), 0.08);
  color: var(--ion-color-primary);
}

.filter-chip--blocked {
  opacity: 0.35;
  cursor: not-allowed;
  pointer-events: none;
}

.filter-chip-text {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  line-height: 1.25;
}

.filter-chip-name {
  font-weight: var(--fw-semibold);
}

.filter-chip-role {
  font-size: var(--fs-2xs);
  font-weight: var(--fw-medium);
  color: var(--ion-color-step-400);
}

.filter-chip--active .filter-chip-role {
  color: var(--ion-color-primary);
  opacity: 0.75;
}

.filter-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.filters-empty {
  font-size: var(--fs-sm);
  color: var(--ion-color-step-400);
}

.filters-divider {
  height: 1px;
  background: var(--ion-border-color);
  margin: 12px 0 10px;
}

.filters-sublabel {
  display: block;
  font-size: var(--fs-2xs);
  font-weight: var(--fw-semibold);
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: var(--ion-color-step-400);
  margin: 14px 0 8px;
}

.reset-btn {
  margin-top: 14px;
}

.filter-chip--skeleton {
  cursor: default;
  pointer-events: none;
  animation: skeletonPulse 1.4s ease-in-out infinite;
}

.filter-dot--skeleton {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--ion-color-step-200);
}

.filter-chip-name-skeleton {
  display: inline-block;
  width: 70px;
  height: 10px;
  border-radius: 4px;
  background: var(--ion-color-step-200);
}

.filter-chip-role-skeleton {
  display: inline-block;
  width: 50px;
  height: 8px;
  border-radius: 4px;
  background: var(--ion-color-step-200);
  margin-top: 4px;
}

@keyframes skeletonPulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.8; }
}
</style>

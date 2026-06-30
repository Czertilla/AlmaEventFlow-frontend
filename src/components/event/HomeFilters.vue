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

    <template v-if="principal.isPrincipal">
      <div class="filters-divider" />
      <span class="filters-sublabel">Статус мероприятия</span>
      <div class="filters">
        <button
          v-for="s in STATUS_FILTERS"
          :key="s.value"
          class="filter-chip"
          :class="{ 'filter-chip--active': status === s.value }"
          @click="status = s.value"
        >
          {{ s.label }}
        </button>
      </div>
    </template>

    <div class="filters-divider" />
    <div class="facet-filters">
      <label class="facet-field">
        <span class="filters-sublabel">Тип</span>
        <select v-model="type" class="facet-select">
          <option value="all">Любой</option>
          <option v-for="[v, l] in typeOptions" :key="v" :value="v">{{ l }}</option>
        </select>
      </label>
      <label class="facet-field">
        <span class="filters-sublabel">Уровень</span>
        <select v-model="level" class="facet-select">
          <option value="all">Любой</option>
          <option v-for="[v, l] in levelOptions" :key="v" :value="v">{{ l }}</option>
        </select>
      </label>
      <label class="facet-field">
        <span class="filters-sublabel">Формат</span>
        <select v-model="format" class="facet-select">
          <option value="all">Любой</option>
          <option v-for="[v, l] in formatOptions" :key="v" :value="v">{{ l }}</option>
        </select>
      </label>
    </div>
  </div>
</template>

<script setup lang="ts">
import { usePrincipalStore } from '@/stores/principal'
import { getCollectiveColor } from '@/utils/colors'
import { typeOptions, levelOptions, formatOptions } from '@/utils/eventLabels'
import type {
  EventStatusEnumV1, EventTypeEnumV1, EventLevelEnumV1, EventFormatEnumV1,
} from '@/api/generated/almaEventFlow'

defineProps<{
  loading?: boolean
}>()

const status = defineModel<EventStatusEnumV1 | 'all'>('status', { required: true })
const type = defineModel<EventTypeEnumV1 | 'all'>('type', { required: true })
const level = defineModel<EventLevelEnumV1 | 'all'>('level', { required: true })
const format = defineModel<EventFormatEnumV1 | 'all'>('format', { required: true })

const principal = usePrincipalStore()
const getColor = getCollectiveColor

// Фильтр статуса доступен только руководителю (участник всегда видит лишь активные)
const STATUS_FILTERS: Array<{ value: EventStatusEnumV1 | 'all'; label: string }> = [
  { value: 'all', label: 'Любой статус' },
  { value: 'active', label: 'Активно' },
  { value: 'draft', label: 'Черновик' },
  { value: 'archived', label: 'Архив' },
]

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
  font-size: 13px;
  font-weight: 500;
  color: var(--ion-color-medium);
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
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
  font-weight: 600;
}

.filter-chip-role {
  font-size: 10px;
  font-weight: 500;
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
  font-size: 13px;
  color: var(--ion-color-step-400);
}

.filters-divider {
  height: 1px;
  background: var(--ion-border-color);
  margin: 12px 0 10px;
}

.filters-sublabel {
  display: block;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: var(--ion-color-step-400);
  margin-bottom: 8px;
}

.facet-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.facet-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  min-width: 120px;
}

.facet-field .filters-sublabel {
  margin-bottom: 0;
}

.facet-select {
  height: 38px;
  padding: 0 10px;
  border: 1.5px solid var(--ion-border-color);
  border-radius: 10px;
  background: var(--ion-background-color);
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  color: var(--ion-text-color);
  outline: none;
  cursor: pointer;
  transition: border-color 0.15s;
}

.facet-select:focus {
  border-color: var(--ion-color-primary);
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

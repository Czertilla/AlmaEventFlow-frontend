<template>
  <div class="dash-filters">
    <div class="filter-row">
      <span class="filter-row-label">Тип:</span>
      <div class="role-chips">
        <button class="role-chip" :class="{ 'role-chip--active': allTypesSelected }" @click="selectAllTypes">Все</button>
        <button
          v-for="[value, label] in typeOptions"
          :key="value"
          class="role-chip"
          :class="{ 'role-chip--active': selectedTypes.has(value) }"
          :style="selectedTypes.has(value) ? { borderColor: typeColor(value), color: typeColor(value), background: typeColor(value) + '1A' } : {}"
          @click="toggleType(value)"
        >
          {{ label }}
        </button>
      </div>
    </div>

    <div v-if="roles.length" class="filter-row">
      <span class="filter-row-label">Роль:</span>
      <div class="role-chips">
        <button class="role-chip" :class="{ 'role-chip--active': allRolesSelected }" @click="selectAllRoles">Все</button>
        <button
          v-for="r in roles"
          :key="r.id"
          class="role-chip"
          :class="{ 'role-chip--active': selectedRoleIds.has(r.id) }"
          @click="toggleRoleFilter(r.id)"
        >
          {{ r.name }}
        </button>
      </div>
    </div>

    <div class="filter-row">
      <span class="filter-row-label">Участники:</span>
      <div class="role-chips">
        <button class="role-chip" :class="{ 'role-chip--active': activeFilter === 'all' }" @click="activeFilter = 'all'">Все</button>
        <button class="role-chip" :class="{ 'role-chip--active': activeFilter === 'active' }" @click="activeFilter = 'active'">Активные</button>
        <button class="role-chip" :class="{ 'role-chip--active': activeFilter === 'inactive' }" @click="activeFilter = 'inactive'">Неактивные</button>
      </div>
    </div>

    <div class="filter-row">
      <span class="filter-row-label">Период:</span>
      <DateTimeField v-model="dateFrom" mode="date" class="range-date" aria-label="С даты" />
      <span class="range-dash">—</span>
      <DateTimeField v-model="dateTo" mode="date" class="range-date" aria-label="По дату" />
      <button class="sort-btn" :disabled="!dateFrom || !dateTo" @click="emit('apply-date-range')">Применить</button>
      <button v-if="useCustomRange" class="sort-btn" @click="emit('reset-date-range')">Сбросить</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import DateTimeField from '@/components/common/DateTimeField.vue'
import { computed } from 'vue'
import { typeOptions, typeColor } from '@/utils/eventLabels'
import type { EventTypeEnumV1, RoleRead } from '@/api/generated/almaEventFlow'

const props = defineProps<{
  roles: RoleRead[]
  useCustomRange: boolean
}>()

const emit = defineEmits<{
  'apply-date-range': []
  'reset-date-range': []
}>()

const selectedTypes = defineModel<Set<EventTypeEnumV1>>('selectedTypes', { required: true })
const selectedRoleIds = defineModel<Set<string>>('selectedRoleIds', { required: true })
const activeFilter = defineModel<'all' | 'active' | 'inactive'>('activeFilter', { required: true })
const dateFrom = defineModel<string>('dateFrom', { required: true })
const dateTo = defineModel<string>('dateTo', { required: true })

const allTypeValues = typeOptions.map(([v]) => v)
const allTypesSelected = computed(() => selectedTypes.value.size === allTypeValues.length)
const allRolesSelected = computed(() => selectedRoleIds.value.size === props.roles.length)

function toggleType(t: EventTypeEnumV1) {
  const next = new Set(selectedTypes.value)
  if (next.has(t)) next.delete(t)
  else next.add(t)
  selectedTypes.value = next
}

// "Все" -- переключатель: если уже выбраны все типы, повторный клик снимает
// выбор целиком, а не просто ещё раз выставляет "всё" (нельзя было отключить).
function selectAllTypes() {
  selectedTypes.value = allTypesSelected.value ? new Set() : new Set(allTypeValues)
}

function toggleRoleFilter(id: string) {
  const next = new Set(selectedRoleIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selectedRoleIds.value = next
}

function selectAllRoles() {
  selectedRoleIds.value = allRolesSelected.value ? new Set() : new Set(props.roles.map((r) => r.id))
}
</script>

<style scoped>
.filter-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
}

.filter-row-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--ion-color-medium);
  flex-shrink: 0;
}

.role-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.role-chip {
  padding: 6px 14px;
  border: 1.5px solid var(--ion-border-color);
  border-radius: 999px;
  background: transparent;
  font-size: 12px;
  font-weight: 600;
  color: var(--ion-color-medium);
  cursor: pointer;
  font-family: inherit;
  transition: all 0.15s;
}

.role-chip--active {
  border-color: var(--ion-color-primary);
  background: rgba(var(--ion-color-primary-rgb), 0.1);
  color: var(--ion-color-primary);
}

.native-input {
  border: 1.5px solid var(--ion-border-color);
  border-radius: 10px;
  background: var(--ion-card-background);
  font-family: inherit;
  font-size: 14px;
  color: var(--ion-text-color);
  padding: 10px 12px;
  outline: none;
  transition: border-color 0.15s;
}

.native-input:focus {
  border-color: var(--ion-color-primary);
}

.range-dash {
  color: var(--ion-color-step-400);
  font-size: 13px;
}

.range-date {
  width: 160px;
  flex: 0 1 160px;
}

.sort-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  height: 44px;
  padding: 0 14px;
  border: 1.5px solid var(--ion-border-color);
  border-radius: 12px;
  background: transparent;
  font-size: 13px;
  font-weight: 600;
  color: var(--ion-color-medium);
  cursor: pointer;
  font-family: inherit;
  transition: all 0.15s;
}

.sort-btn:hover {
  border-color: var(--ion-color-primary);
  color: var(--ion-color-primary);
}
</style>

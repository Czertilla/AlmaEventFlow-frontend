<template>
  <div class="cml">
    <div v-if="members.length > 1" class="ui-chips cml-sort">
      <button type="button" class="ui-chip" :class="{ 'ui-chip--active': sort === 'name' }" @click="sort = 'name'">По алфавиту</button>
      <button type="button" class="ui-chip" :class="{ 'ui-chip--active': sort === 'rate' }" @click="sort = 'rate'">По посещаемости</button>
    </div>

    <ul v-if="sorted.length" class="cml-list">
      <li v-for="member in sorted" :key="member.member_id">
        <button type="button" class="cml-row" @click="emit('open', member.member_id)">
          <span class="cml-main">
            <span class="cml-name">
              {{ formatPersonName(member.person) }}
              <span v-if="!member.is_active" class="cml-tag">не в составе</span>
            </span>
            <span class="cml-track" aria-hidden="true">
              <template v-for="outcome in OUTCOMES" :key="outcome">
                <span
                  v-if="member[outcome] > 0"
                  class="cml-seg"
                  :class="`ui-att--${outcome}`"
                  :style="{ flexGrow: member[outcome] }"
                  :title="`${outcomeLabels[outcome]}: ${member[outcome]}`"
                />
              </template>
            </span>
          </span>
          <span class="cml-stat">
            <span class="cml-rate">{{ formatRate(member.rate) }}</span>
            <span class="cml-sub">{{ member.past ? `${member.attended} из ${member.past}` : 'нет мероприятий' }}</span>
          </span>
        </button>
      </li>
    </ul>
    <p v-else class="cml-empty">В коллективе пока нет участников</p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { CollectiveMemberItem } from '@/api/generated/almaEventFlow'
import { formatPersonName } from '@/utils/names'
import { OUTCOMES, formatRate, outcomeLabels } from '@/utils/memberAttendance'

const props = defineProps<{ members: CollectiveMemberItem[] }>()

const emit = defineEmits<{ open: [memberId: string] }>()

const sort = ref<'name' | 'rate'>('name')

const sorted = computed(() => {
  if (sort.value === 'name') return props.members
  return [...props.members].sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1) || b.past - a.past)
})
</script>

<style scoped>
.cml-sort {
  margin-bottom: 8px;
}

.cml-list {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
}

.cml-list > li + li {
  border-top: 1px solid var(--ion-border-color);
}

.cml-row {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 10px 0;
  border: none;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.cml-row:hover .cml-name {
  color: var(--ion-color-primary);
}

.cml-main {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.cml-name {
  font-size: var(--fs-md);
  font-weight: var(--fw-semibold);
  color: var(--ion-text-color);
  overflow-wrap: anywhere;
}

.cml-tag {
  margin-left: 6px;
  padding: 1px 8px;
  border-radius: var(--radius-pill);
  background: var(--ion-color-step-50, var(--ion-color-light));
  font-size: var(--fs-2xs);
  font-weight: var(--fw-semibold);
  color: var(--ion-color-medium);
  white-space: nowrap;
}

.cml-track {
  display: flex;
  gap: 2px;
  max-width: 220px;
  height: 8px;
}

.cml-seg {
  flex-basis: 0;
  min-width: 4px;
}

.cml-seg:last-child {
  border-radius: 0 4px 4px 0;
}

.cml-stat {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  min-width: 72px;
}

.cml-rate {
  font-size: var(--fs-lg);
  font-weight: var(--fw-bold);
  font-variant-numeric: tabular-nums;
  color: var(--ion-text-color);
}

.cml-sub {
  font-size: var(--fs-xs);
  font-variant-numeric: tabular-nums;
  color: var(--ion-color-medium);
  white-space: nowrap;
}

.cml-empty {
  margin: 0;
  padding: 16px 0;
  font-size: var(--fs-md);
  color: var(--ion-color-medium);
  text-align: center;
}
</style>

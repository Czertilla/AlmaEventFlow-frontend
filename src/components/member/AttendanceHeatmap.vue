<template>
  <div ref="rootRef" class="hm" @mouseleave="hideTip">
    <div ref="scrollRef" class="hm-scroll">
      <div class="hm-grid" :style="{ '--hm-cols': weeks.length }">
        <span
          v-for="m in months"
          :key="m.col"
          class="hm-month"
          :style="{ gridColumn: m.col + 2, gridRow: 1 }"
        >{{ m.label }}</span>
        <span
          v-for="wd in weekdayLabels"
          :key="wd.row"
          class="hm-weekday"
          :style="{ gridColumn: 1, gridRow: wd.row + 2 }"
        >{{ wd.label }}</span>

        <template v-for="(week, col) in weeks" :key="col">
          <template v-for="(cell, row) in week" :key="cell.key">
            <span
              v-if="!cell.inRange"
              class="hm-cell hm-cell--out"
              :style="{ gridColumn: col + 2, gridRow: row + 2 }"
              aria-hidden="true"
            />
            <button
              v-else-if="cell.summary"
              type="button"
              class="hm-cell hm-cell--hit"
              :class="cellClass(cell)"
              :style="cellStyle(cell, col, row)"
              :aria-label="cellLabel(cell)"
              :aria-pressed="cell.key === selected"
              @click="emit('select', cell.key === selected ? null : cell.key)"
              @mouseenter="showTip($event, cell)"
              @focus="showTip($event, cell)"
              @blur="hideTip"
            />
            <span
              v-else
              class="hm-cell hm-cell--empty"
              :class="cellClass(cell)"
              :style="cellStyle(cell, col, row)"
              aria-hidden="true"
            />
          </template>
        </template>
      </div>
    </div>

    <div v-if="tip" class="hm-tip" :style="{ left: `${tip.left}px`, top: `${tip.top}px` }" role="tooltip">
      <strong class="hm-tip-title">{{ tip.title }}</strong>
      <span v-if="tip.rate" class="hm-tip-rate">Присутствие: {{ tip.rate }}</span>
      <ul class="hm-tip-list">
        <li v-for="item in tip.items" :key="item.attendance_id" class="hm-tip-row">
          <ion-icon :icon="outcomeIcons[item.outcome]" :class="`ui-att-ink--${item.outcome}`" />
          <span class="hm-tip-name">{{ item.event_name }}</span>
        </li>
      </ul>
      <span v-if="tip.more" class="hm-tip-more">и ещё {{ tip.more }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { IonIcon } from '@ionic/vue'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import type { MemberAttendanceItem } from '@/api/generated/almaEventFlow'
import {
  dayKey, dayRateLabel, dayTitle, groupByDay, inRange, monthLabels, outcomeIcons,
  outcomeLabels, rateColor, weekColumns, type DaySummary, type WeekStart,
} from '@/utils/memberAttendance'

const props = defineProps<{
  items: MemberAttendanceItem[]
  from: Date
  to: Date
  selected: string | null
  weekStartsOn: WeekStart
}>()

const emit = defineEmits<{ select: [key: string | null] }>()

interface Cell {
  key: string
  inRange: boolean
  isToday: boolean
  summary: DaySummary | undefined
}

const TIP_ITEMS = 4
const TIP_HALF_WIDTH = 120

const rootRef = ref<HTMLElement | null>(null)
const scrollRef = ref<HTMLElement | null>(null)
const tip = ref<{
  left: number
  top: number
  title: string
  rate: string
  items: MemberAttendanceItem[]
  more: number
} | null>(null)

const days = computed(() => groupByDay(props.items))
const todayKey = computed(() => dayKey(new Date()))

const weeks = computed<Cell[][]>(() =>
  weekColumns(props.from, props.to, props.weekStartsOn).map((week) =>
    week.map((date) => {
      const key = dayKey(date)
      return {
        key,
        inRange: inRange(date, props.from, props.to),
        isToday: key === todayKey.value,
        summary: days.value.get(key),
      }
    }),
  ),
)

const months = computed(() =>
  monthLabels(weekColumns(props.from, props.to, props.weekStartsOn), props.from, props.to),
)

const weekdayLabels = computed(() =>
  (weeks.value[0] ?? []).flatMap((cell, row) => {
    const weekday = new Date(`${cell.key}T00:00:00`)
    return [1, 3, 5].includes(weekday.getDay()) ? [{ row, label: format(weekday, 'EEEEEE', { locale: ru }) }] : []
  }),
)

function cellClass(cell: Cell): Record<string, boolean> {
  const summary = cell.summary
  const colored = !!summary && summary.rate !== null
  return {
    'hm-cell--today': cell.isToday,
    'hm-cell--selected': cell.key === props.selected,
    'ui-att-rate': colored && summary.counts.unmarked === 0,
    'ui-att-hatch': colored && summary.counts.unmarked > 0,
    'ui-att--unmarked': !!summary && !colored && summary.counts.unmarked > 0,
    'ui-att--upcoming': !!summary && !colored && summary.counts.unmarked === 0 && summary.counts.upcoming > 0,
  }
}

function cellStyle(cell: Cell, col: number, row: number): Record<string, string | number> {
  const style: Record<string, string | number> = { gridColumn: col + 2, gridRow: row + 2 }
  if (cell.summary?.rate != null) style['--att-rate'] = rateColor(cell.summary.rate)
  return style
}

function cellLabel(cell: Cell): string {
  const summary = cell.summary
  if (!summary) return dayTitle(cell.key)
  const parts = (Object.keys(summary.counts) as (keyof typeof summary.counts)[])
    .filter((outcome) => summary.counts[outcome] > 0)
    .map((outcome) => `${outcomeLabels[outcome]}: ${summary.counts[outcome]}`)
  const rate = dayRateLabel(summary)
  return `${dayTitle(cell.key)}. ${parts.join(', ')}${rate ? `. Присутствие: ${rate}` : ''}`
}

function showTip(event: Event, cell: Cell) {
  const root = rootRef.value
  const summary = cell.summary
  if (!root || !summary || window.matchMedia?.('(hover: hover)').matches === false) return
  const box = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const rootBox = root.getBoundingClientRect()
  const center = box.left - rootBox.left + box.width / 2
  tip.value = {
    left: Math.min(Math.max(center, TIP_HALF_WIDTH), Math.max(rootBox.width - TIP_HALF_WIDTH, TIP_HALF_WIDTH)),
    top: box.top - rootBox.top - 8,
    title: dayTitle(cell.key),
    rate: dayRateLabel(summary),
    items: summary.items.slice(0, TIP_ITEMS),
    more: Math.max(summary.items.length - TIP_ITEMS, 0),
  }
}

function hideTip() {
  tip.value = null
}

function scrollToToday() {
  const scroller = scrollRef.value
  if (!scroller) return
  const col = weeks.value.findIndex((week) => week.some((cell) => cell.isToday))
  if (col < 0) {
    scroller.scrollLeft = 0
    return
  }
  const colWidth = scroller.scrollWidth / (weeks.value.length + 1)
  scroller.scrollLeft = Math.max(col * colWidth - scroller.clientWidth / 2, 0)
}

onMounted(() => nextTick(scrollToToday))
watch(() => [props.from.getTime(), props.to.getTime()], () => nextTick(scrollToToday))
</script>

<style scoped>
.hm {
  position: relative;
}

.hm-scroll {
  overflow-x: auto;
  padding-bottom: 4px;
}

.hm-grid {
  display: grid;
  grid-template-columns: auto repeat(var(--hm-cols), minmax(10px, 1fr));
  grid-template-rows: auto repeat(7, auto);
  gap: 2px;
  min-width: calc(var(--hm-cols) * 12px + 30px);
}

.hm-month,
.hm-weekday {
  font-size: var(--fs-2xs);
  color: var(--ion-color-medium);
  white-space: nowrap;
  text-transform: capitalize;
}

.hm-weekday {
  position: sticky;
  left: 0;
  z-index: 2;
  align-self: center;
  padding-right: 6px;
  background: var(--ion-card-background);
  line-height: 1;
}

.hm-cell {
  aspect-ratio: 1;
  min-width: 0;
  padding: 0;
  border: none;
  border-radius: 25%;
}

.hm-cell--empty {
  background: var(--ion-color-step-100, var(--ion-border-color));
}

.hm-cell--hit {
  cursor: pointer;
  transition: transform 0.1s;
}

.hm-cell--hit:hover,
.hm-cell--hit:focus-visible {
  transform: scale(1.35);
  z-index: 1;
}

.hm-cell--today {
  outline: var(--border-w) solid var(--ion-text-color);
  outline-offset: -1px;
}

.hm-cell--selected {
  outline: var(--border-w) solid var(--ion-color-primary);
  outline-offset: 1px;
  z-index: 1;
}

.hm-tip {
  position: absolute;
  z-index: 5;
  width: max-content;
  max-width: 240px;
  padding: 8px 10px;
  border: var(--border-w) solid var(--ion-border-color);
  border-radius: var(--radius-sm);
  background: var(--ion-card-background);
  box-shadow: var(--ion-card-shadow);
  transform: translate(-50%, -100%);
  pointer-events: none;
}

.hm-tip-title {
  display: block;
  font-size: var(--fs-xs);
  font-weight: var(--fw-semibold);
  color: var(--ion-text-color);
}

.hm-tip-rate {
  display: block;
  margin-top: 2px;
  font-size: var(--fs-xs);
  color: var(--ion-color-medium);
}

.hm-tip-list {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin: 6px 0 0;
  padding: 0;
  list-style: none;
}

.hm-tip-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--fs-xs);
  color: var(--ion-text-color);
}

.hm-tip-row ion-icon {
  flex-shrink: 0;
  font-size: var(--fs-md);
}

.hm-tip-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hm-tip-more {
  display: block;
  margin-top: 4px;
  font-size: var(--fs-2xs);
  color: var(--ion-color-medium);
}
</style>

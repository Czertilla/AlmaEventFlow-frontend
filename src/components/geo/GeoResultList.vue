<template>
  <ul :id="id" class="grl" role="listbox" aria-label="Найденные места и адреса">
    <li v-if="searching && results.length === 0" class="grl-status" role="presentation">
      <ion-spinner name="dots" />
      <span>Ищем…</span>
    </li>

    <li
      v-for="(r, i) in results"
      :id="geoOptionId(id, i)"
      :key="`${r.kind}-${r.item.id}`"
      class="grl-item"
      :class="{ 'grl-item--active': i === activeIndex }"
      role="option"
      :aria-selected="i === activeIndex"
      @mousedown.prevent
      @click="emit('pick', r)"
    >
      <span class="grl-tile" :class="`grl-tile--${r.kind}`">
        <ion-icon :icon="r.kind === 'location' ? starOutline : locationOutline" />
      </span>
      <span class="grl-text">
        <span class="grl-title">{{ resultLabel(r) }}</span>
        <span class="grl-sub">{{ subtitle(r) }}</span>
      </span>
      <button
        v-if="r.kind === 'address' && addressActions"
        type="button"
        class="grl-action"
        :aria-label="`Создать локацию по адресу ${r.item.name}`"
        @mousedown.prevent
        @click.stop="emit('create-from-address', r.item)"
      >
        <ion-icon :icon="addOutline" />
        <span>Локация</span>
      </button>
    </li>

    <li v-if="!searching && results.length === 0" class="grl-status" role="presentation">
      Ничего не найдено
    </li>

    <li
      v-if="showCreate"
      :id="geoOptionId(id, results.length)"
      class="grl-item grl-item--create"
      :class="{ 'grl-item--active': results.length === activeIndex }"
      role="option"
      :aria-selected="results.length === activeIndex"
      @mousedown.prevent
      @click="emit('create-named', query.trim())"
    >
      <span class="grl-tile grl-tile--create">
        <ion-icon :icon="addOutline" />
      </span>
      <span class="grl-text">
        <span class="grl-title">Создать локацию «{{ query.trim() }}»</span>
        <span class="grl-sub">Указать адрес или точку на карте</span>
      </span>
    </li>
  </ul>
</template>

<script setup lang="ts">
import { IonIcon, IonSpinner } from '@ionic/vue'
import { addOutline, locationOutline, starOutline } from 'ionicons/icons'
import type { AddressRead } from '@/api/generated/almaEventFlow'
import { geoOptionId, resultLabel } from '@/composables/useGeoSearch'
import type { GeoResult } from '@/composables/useGeoSearch'

withDefaults(
  defineProps<{
    id: string
    results: GeoResult[]
    query: string
    searching: boolean
    activeIndex: number
    showCreate?: boolean
    addressActions?: boolean
  }>(),
  { showCreate: false, addressActions: true },
)

const emit = defineEmits<{
  pick: [result: GeoResult]
  'create-from-address': [address: AddressRead]
  'create-named': [name: string]
}>()

function subtitle(r: GeoResult): string {
  if (r.kind === 'address') return 'Адрес'
  if (r.item.name && r.item.address) return r.item.address.name
  return r.item.address ? 'Адрес' : 'Точка на карте'
}
</script>

<style scoped>
.grl {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0;
  padding: 6px;
  list-style: none;
}

.grl-item {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 52px;
  padding: 8px 10px;
  border-radius: 12px;
  color: var(--ion-text-color);
  cursor: pointer;
  transition: background 0.12s;
}

.grl-item:hover,
.grl-item--active {
  background: rgba(var(--ion-color-primary-rgb), 0.09);
}

.grl-tile {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  font-size: 18px;
}

.grl-tile--location {
  background: rgba(var(--ion-color-primary-rgb), 0.12);
  color: var(--ion-color-primary);
}

.grl-tile--address {
  background: rgba(var(--ion-text-color-rgb), 0.07);
  color: var(--ion-color-medium);
}

.grl-tile--create {
  background: var(--ion-color-primary);
  color: var(--ion-color-primary-contrast);
}

.grl-text {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  gap: 1px;
}

.grl-title {
  overflow: hidden;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.3;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.grl-item--create .grl-title {
  color: var(--ion-color-primary);
}

.grl-sub {
  overflow: hidden;
  font-size: 12px;
  line-height: 1.3;
  color: var(--ion-color-medium);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.grl-action {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  gap: 4px;
  height: 30px;
  padding: 0 12px 0 8px;
  border: 1.5px solid rgba(var(--ion-color-primary-rgb), 0.35);
  border-radius: 999px;
  background: transparent;
  color: var(--ion-color-primary);
  font-family: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s;
}

.grl-action ion-icon {
  font-size: 16px;
}

.grl-action:hover,
.grl-action:focus-visible {
  border-color: var(--ion-color-primary);
  background: rgba(var(--ion-color-primary-rgb), 0.1);
  outline: none;
}

.grl-status {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px 12px;
  font-size: 13px;
  color: var(--ion-color-medium);
}

.grl-status ion-spinner {
  width: 22px;
  height: 22px;
}
</style>

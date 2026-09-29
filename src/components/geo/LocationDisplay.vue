<template>
  <MapLinkMenu v-if="point" :point="point" :label="mapLabel" v-slot="{ toggle }">
    <a href="#" class="location-display location-display--link" @click.prevent="toggle">
      <ion-icon :icon="locationOutline" />
      <span>{{ text }}</span>
      <ion-icon class="location-display-external" :icon="openOutline" />
    </a>
  </MapLinkMenu>
  <div v-else class="location-display">
    <ion-icon :icon="locationOutline" />
    <span>{{ text }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { IonIcon } from '@ionic/vue'
import { locationOutline, openOutline } from 'ionicons/icons'
import MapLinkMenu from './MapLinkMenu.vue'
import type { GeoPoint } from './GeoMap.vue'
import type { LocationRead } from '@/api/generated/almaEventFlow'
import { mapLinkLabel } from '@/composables/useGeoSearch'

const props = defineProps<{ location: LocationRead }>()

const text = computed(
  () => props.location.name || props.location.address?.name || 'Локация без названия',
)
const mapLabel = computed(() => mapLinkLabel(props.location))
const point = computed<GeoPoint | null>(() => {
  const p = props.location.spot ?? props.location.address?.spot
  return p ? { lat: p.lat, lon: p.lon } : null
})
</script>

<style scoped>
.location-display {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: var(--ion-text-color, #1a1a1a);
}

.location-display ion-icon {
  color: var(--ion-color-primary);
  flex-shrink: 0;
}

.location-display--link {
  text-decoration: none;
  cursor: pointer;
}

.location-display--link:hover span {
  text-decoration: underline;
}

.location-display-external {
  font-size: 12px;
  opacity: 0.6;
}
</style>

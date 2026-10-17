<template>
  <section v-if="point" class="elm" aria-label="Место проведения на карте">
    <div class="elm-head">
      <div class="elm-place">
        <span class="elm-title">{{ title }}</span>
        <span class="elm-sub">{{ subtitle }}</span>
      </div>
      <MapLinkMenu :point="point" :label="mapLinkLabel(location)" v-slot="{ toggle }">
        <button type="button" class="ui-btn ui-btn--ghost ui-btn--sm" @click="toggle">
          <ion-icon :icon="openOutline" />
          <span>В картах</span>
        </button>
      </MapLinkMenu>
    </div>
    <div class="elm-map">
      <GeoMap :center="point" :markers="markers" :zoom="16" :scroll-zoom="false" />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { IonIcon } from '@ionic/vue'
import { openOutline } from 'ionicons/icons'
import GeoMap from './GeoMap.vue'
import MapLinkMenu from './MapLinkMenu.vue'
import type { LocationRead } from '@/api/generated/almaEventFlow'
import { locationLabel, locationMarker, mapLinkLabel, resultSubtitle } from '@/composables/useGeoSearch'
import { locationPoint } from '@/utils/geo'

const props = defineProps<{ location: LocationRead }>()

const point = computed(() => locationPoint(props.location))
const markers = computed(() => {
  const marker = locationMarker(props.location)
  return marker ? [marker] : []
})
const title = computed(() => locationLabel(props.location))
const subtitle = computed(() => resultSubtitle({ kind: 'location', item: props.location }))
</script>

<style scoped>
.elm {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.elm-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.elm-place {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.elm-title {
  overflow: hidden;
  font-size: var(--fs-md);
  font-weight: var(--fw-semibold);
  color: var(--ion-text-color);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.elm-sub {
  overflow: hidden;
  font-size: var(--fs-xs);
  color: var(--ion-color-medium);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.elm-map {
  height: 240px;
  overflow: hidden;
  border: var(--border-w) solid var(--ion-border-color);
  border-radius: var(--radius-md);
}
</style>

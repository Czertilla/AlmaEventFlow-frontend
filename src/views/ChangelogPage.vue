<template>
  <ion-page>
    <ion-header v-if="!isDesktop">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/settings" />
        </ion-buttons>
        <ion-title>Что нового</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <div class="changelog-page">
        <h1 v-if="isDesktop" class="page-title">Что нового</h1>

        <div v-if="loading" class="changelog-status">
          <ion-spinner name="crescent" />
        </div>
        <div v-else-if="error" class="changelog-status changelog-status--error">
          <ion-icon :icon="alertCircleOutline" />
          <span>Не удалось загрузить список изменений</span>
        </div>

        <div v-else class="changelog-releases">
          <section v-for="release in releases" :key="release.title" class="release-card">
            <div class="release-header">
              <span class="release-badge">{{ release.version }}</span>
              <span v-if="release.date" class="release-date">{{ release.date }}</span>
            </div>
            <div v-for="group in release.groups" :key="group.title" class="release-group">
              <h3 class="release-group-title">{{ group.title }}</h3>
              <ul class="release-list">
                <li v-for="(item, i) in group.items" :key="i" v-html="item" />
              </ul>
            </div>
          </section>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton,
  IonContent, IonIcon, IonSpinner,
} from '@ionic/vue'
import { alertCircleOutline } from 'ionicons/icons'
import { usePlatform } from '@/composables/usePlatform'

interface ReleaseGroup {
  title: string
  items: string[]
}

interface Release {
  title: string
  version: string
  date: string | null
  groups: ReleaseGroup[]
}

const { isDesktop } = usePlatform()
const loading = ref(true)
const error = ref(false)
const releases = ref<Release[]>([])

// Экранирование перед подстановкой **bold** — единственная поддерживаемая
// inline-разметка в CHANGELOG.md, остального инлайн-HTML там нет и не будет.
function renderInline(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  return escaped.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
}

// Мини-парсер под конкретную структуру CHANGELOG.md: `# ` заголовок файла
// игнорируется, `## Версия — дата` начинает релиз, `### Раздел` — группу
// пунктов, `- ` — сам пункт. Полноценный markdown не нужен — файл пишем сами.
function parseChangelog(text: string): Release[] {
  const result: Release[] = []
  let currentRelease: Release | null = null
  let currentGroup: ReleaseGroup | null = null

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trimEnd()
    if (line.startsWith('## ')) {
      const title = line.slice(3).trim()
      const [version, date] = title.split('—').map((s) => s.trim())
      currentRelease = { title, version, date: date ?? null, groups: [] }
      result.push(currentRelease)
      currentGroup = null
    } else if (line.startsWith('### ') && currentRelease) {
      currentGroup = { title: line.slice(4).trim(), items: [] }
      currentRelease.groups.push(currentGroup)
    } else if (line.startsWith('- ') && currentGroup) {
      currentGroup.items.push(renderInline(line.slice(2).trim()))
    }
  }
  return result
}

onMounted(async () => {
  try {
    const response = await fetch('/CHANGELOG.md')
    if (!response.ok) throw new Error(`status ${response.status}`)
    releases.value = parseChangelog(await response.text())
  } catch (e) {
    console.error('failed to load changelog:', e)
    error.value = true
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.changelog-page {
  max-width: 560px;
  margin: 0 auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.page-title {
  margin: 4px 0 0;
  font-size: 22px;
  font-weight: 700;
  color: var(--ion-text-color);
}

.changelog-status {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 48px 16px;
  color: var(--ion-color-medium);
}

.changelog-status--error {
  font-size: 14px;
}

.changelog-releases {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.release-card {
  background: var(--ion-card-background);
  border-radius: 16px;
  box-shadow: var(--ion-card-shadow);
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.release-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.release-badge {
  display: inline-flex;
  align-items: center;
  padding: 3px 12px;
  border-radius: 999px;
  background: linear-gradient(135deg, var(--ion-color-primary), var(--ion-color-primary-shade));
  color: white;
  font-size: 13px;
  font-weight: 700;
}

.release-date {
  font-size: 13px;
  color: var(--ion-color-medium);
}

.release-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.release-group-title {
  margin: 0;
  padding: 0 2px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--ion-color-medium);
}

.release-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.release-list li {
  position: relative;
  padding-left: 16px;
  font-size: 14px;
  line-height: 1.5;
  color: var(--ion-text-color);
}

.release-list li::before {
  content: '';
  position: absolute;
  left: 2px;
  top: 8px;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--ion-color-primary);
}

.release-list :deep(strong) {
  font-weight: 600;
}
</style>

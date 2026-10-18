import { flushPromises, mount } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import ChangelogPage from '@/views/ChangelogPage.vue'
import { changelogAfterUpdate } from '@/utils/changelogVersion'

const platform = await vi.hoisted(async () => {
  const { ref } = await import('vue')
  return { isDesktop: ref(false) }
})

vi.mock('@/composables/usePlatform', () => ({ usePlatform: () => ({ isDesktop: platform.isDesktop }) }))

const Passthrough = defineComponent({
  setup: (_, { slots }) => () => h('div', slots.default?.()),
})
const Blank = { render: () => null }

const VERSIONS = ['0.7.0', '0.6.0', '0.5.0', '0.4.0', '0.3.0', '0.2.0', '0.1.0']

function release(version: string): string {
  return `\n## ${version} — 1 января 2026\n\n### Раздел ${version}\n- Новое в **${version}**\n- Ещё одно\n`
}

let requested: string[]

function serveChangelog() {
  requested = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      requested.push(url)
      const body =
        url === '/changelog/index.json'
          ? VERSIONS.map((version) => ({ version, date: '1 января 2026', file: `${version}.md` }))
          : release(url.replace('/changelog/', '').replace('.md', ''))
      return { ok: true, json: async () => body, text: async () => body }
    }),
  )
}

async function open(location: string | ReturnType<typeof changelogAfterUpdate>, before = '/event/42?tab=stages') {
  window.history.replaceState(null, '', '/')
  const router = createRouter({
    history: createWebHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: Blank }],
  })
  await router.push(before)
  await router.push(location)
  await router.isReady()
  const wrapper = mount(ChangelogPage, {
    global: {
      plugins: [router],
      stubs: {
        IonPage: Passthrough,
        IonHeader: Passthrough,
        IonToolbar: Passthrough,
        IonTitle: Passthrough,
        IonButtons: Passthrough,
        IonButton: Passthrough,
        IonContent: Passthrough,
        IonBackButton: true,
        IonIcon: true,
        IonSpinner: true,
      },
    },
  })
  await flushPromises()
  return { wrapper, router }
}

const cards = (wrapper: Awaited<ReturnType<typeof open>>['wrapper']) => wrapper.findAll('.release-card')

beforeEach(() => {
  platform.isDesktop.value = false
  serveChangelog()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('the changelog an update opens on its own', () => {
  test('shows only the newest entry and fetches nothing else', async () => {
    const { wrapper } = await open(changelogAfterUpdate('/event/42?tab=stages'))

    expect(cards(wrapper)).toHaveLength(1)
    expect(cards(wrapper)[0]!.text()).toContain('0.7.0')
    expect(requested).toEqual(['/changelog/index.json', '/changelog/0.7.0.md'])
  })

  test('the earlier versions are still one tap away', async () => {
    const { wrapper } = await open(changelogAfterUpdate('/'))

    await wrapper.get('.load-more-btn').trigger('click')
    await flushPromises()

    expect(cards(wrapper).map((card) => card.find('.release-badge').text())).toEqual([
      '0.7.0',
      '0.6.0',
      '0.5.0',
      '0.4.0',
      '0.3.0',
      '0.2.0',
    ])
  })

  test('"Понятно" returns to the page the person was on', async () => {
    const { wrapper, router } = await open(changelogAfterUpdate('/event/42?tab=stages'))
    expect(router.currentRoute.value.path).toBe('/changelog')

    await wrapper.get('.changelog-actions button').trigger('click')

    await vi.waitFor(() => expect(router.currentRoute.value.fullPath).toBe('/event/42?tab=stages'))
  })

  test('so does the cross in the header on a phone', async () => {
    const { wrapper, router } = await open(changelogAfterUpdate('/event/42?tab=stages'))

    await wrapper.get('button[aria-label="Закрыть"], div[aria-label="Закрыть"]').trigger('click')

    await vi.waitFor(() => expect(router.currentRoute.value.fullPath).toBe('/event/42?tab=stages'))
    expect(wrapper.find('ion-back-button-stub').exists()).toBe(false)
  })

  test('and the cross next to the title on a computer', async () => {
    platform.isDesktop.value = true
    const { wrapper, router } = await open(changelogAfterUpdate('/event/42?tab=stages'))

    await wrapper.get('.page-head button[aria-label="Закрыть"]').trigger('click')

    await vi.waitFor(() => expect(router.currentRoute.value.fullPath).toBe('/event/42?tab=stages'))
  })

  test('a return address that is not the app\'s own leads to the main page', async () => {
    const { wrapper, router } = await open(changelogAfterUpdate('https://example.com/phish'))

    await wrapper.get('.changelog-actions button').trigger('click')

    await vi.waitFor(() => expect(router.currentRoute.value.fullPath).toBe('/'))
  })
})

describe('the changelog opened from the settings', () => {
  test('lists the recent versions, as before', async () => {
    const { wrapper } = await open('/changelog', '/settings')

    expect(cards(wrapper)).toHaveLength(5)
    expect(requested).toHaveLength(6)
  })

  test('keeps the back button and has no "Понятно"', async () => {
    const { wrapper } = await open('/changelog', '/settings')

    expect(wrapper.find('ion-back-button-stub').exists()).toBe(true)
    expect(wrapper.find('.changelog-actions').exists()).toBe(false)
    expect(wrapper.find('[aria-label="Закрыть"]').exists()).toBe(false)
  })

  test('is not mistaken for an update when the marker is anything but 1', async () => {
    const { wrapper } = await open({ path: '/changelog', query: { new: '0', from: '/event/42' } })

    expect(cards(wrapper)).toHaveLength(5)
    expect(wrapper.find('.changelog-actions').exists()).toBe(false)
  })
})

describe('when the entries cannot be loaded', () => {
  test('says so and still lets the person close the window', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => [], text: async () => '' })))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const { wrapper } = await open(changelogAfterUpdate('/'))

    expect(wrapper.text()).toContain('Не удалось загрузить список изменений')
    expect(wrapper.find('.release-card').exists()).toBe(false)
    expect(wrapper.find('.changelog-actions').exists()).toBe(true)
  })
})

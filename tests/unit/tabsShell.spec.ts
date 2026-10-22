import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { describe, expect, test, vi } from 'vitest'
import { defineComponent, h } from 'vue'

vi.mock('vue-router', async (original) => ({
  ...(await original<typeof import('vue-router')>()),
  useRoute: () => ({ path: '/' }),
}))

const Pass = defineComponent({ setup: (_, { slots }) => () => h('div', slots.default?.()) })

describe('TabsShell', () => {
  test('registers itself as a page of the outer outlet, or the page left behind never goes away', async () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: (media: string) => ({ matches: false, media, addEventListener: () => {}, removeEventListener: () => {} }),
    })
    const { default: TabsShell } = await import('@/components/layout/TabsShell.vue')
    const registerIonPage = vi.fn()

    const wrapper = mount(TabsShell, {
      attrs: { registerIonPage },
      global: {
        plugins: [createPinia()],
        stubs: {
          IonTabs: Pass,
          IonRouterOutlet: true,
          IonTabBar: Pass,
          IonTabButton: Pass,
          IonIcon: true,
          IonLabel: Pass,
        },
      },
    })

    expect(wrapper.element.classList.contains('ion-page')).toBe(true)
    expect(registerIonPage).toHaveBeenCalledTimes(1)
    expect(registerIonPage).toHaveBeenCalledWith(wrapper.element)
  }, 60_000)
})

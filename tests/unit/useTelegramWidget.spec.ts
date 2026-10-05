import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { useTelegramWidget } from '@/composables/useTelegramWidget'

const ORIGIN = 'https://oauth.telegram.org'

function setup() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  let api!: ReturnType<typeof useTelegramWidget>
  const wrapper = mount(
    defineComponent({
      setup() {
        api = useTelegramWidget(ref(container), () => {})
        return () => h('div')
      },
    }),
  )
  api.mount('test_bot')
  const iframe = document.createElement('iframe')
  container.appendChild(iframe)
  return { api, container, iframe, wrapper }
}

function post(iframe: HTMLIFrameElement, data: unknown, origin = ORIGIN) {
  window.dispatchEvent(
    new MessageEvent('message', {
      data: JSON.stringify(data),
      origin,
      source: iframe.contentWindow,
    }),
  )
}

describe('useTelegramWidget', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  test('is loading until the embed reports it is alive', () => {
    const { api } = setup()
    expect(api.status.value).toBe('loading')
  })

  test('becomes ready on a ready message from the widget iframe', () => {
    const { api, iframe } = setup()
    post(iframe, { event: 'ready' })
    expect(api.status.value).toBe('ready')
  })

  test('fails when the embed never reports (invalid bot domain)', () => {
    const { api } = setup()
    vi.advanceTimersByTime(6001)
    expect(api.status.value).toBe('failed')
  })

  test('fails when the widget script cannot be loaded', () => {
    const { api, container } = setup()
    container.querySelector('script')!.onerror!(new Event('error'))
    expect(api.status.value).toBe('failed')
  })

  test('ignores messages from other origins', () => {
    const { api, iframe } = setup()
    post(iframe, { event: 'ready' }, 'https://evil.example')
    vi.advanceTimersByTime(6001)
    expect(api.status.value).toBe('failed')
  })

  test('recovers when the embed becomes alive after the timeout', () => {
    const { api, iframe } = setup()
    vi.advanceTimersByTime(6001)
    post(iframe, { event: 'resize', height: 40, width: 240 })
    expect(api.status.value).toBe('ready')
  })

  test('stops listening after unmount', () => {
    const { api, iframe, wrapper } = setup()
    wrapper.unmount()
    post(iframe, { event: 'ready' })
    expect(api.status.value).toBe('loading')
  })
})

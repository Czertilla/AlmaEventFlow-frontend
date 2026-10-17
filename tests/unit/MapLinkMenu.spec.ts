import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import MapLinkMenu from '@/components/geo/MapLinkMenu.vue'

const TEXT = 'ул. Пушкина, 10, Казань'

function menu(props: Record<string, unknown>) {
  return mount(MapLinkMenu, {
    props: props as never,
    attachTo: document.body,
    slots: { default: `<template #default="{ toggle }"><button class="opener" @click="toggle">open</button></template>` },
  })
}

let written: string[]

beforeEach(() => {
  vi.useFakeTimers()
  written = []
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: async (text: string) => void written.push(text) },
  })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('MapLinkMenu', () => {
  test('a point opens the services at that point and offers no copy', async () => {
    const wrapper = menu({ point: { lat: 55.75, lon: 37.6 } })
    await wrapper.get('.opener').trigger('click')

    expect(wrapper.find('.mlm-copy').exists()).toBe(false)
    expect(wrapper.get('a.mlm-item').attributes('href')).toContain('55.75')
    wrapper.unmount()
  })

  test('a text with no point searches every service for it', async () => {
    const wrapper = menu({ point: null, search: TEXT })
    await wrapper.get('.opener').trigger('click')

    const links = wrapper.findAll('a.mlm-item').map((link) => link.attributes('href'))
    expect(links.length).toBeGreaterThanOrEqual(4)
    for (const href of links) expect(href).toContain(encodeURIComponent(TEXT))
    wrapper.unmount()
  })

  test('the address can be copied, and the menu closes after it says so', async () => {
    const wrapper = menu({ point: null, search: TEXT })
    await wrapper.get('.opener').trigger('click')

    await wrapper.get('.mlm-copy').trigger('click')
    await vi.advanceTimersByTimeAsync(0)

    expect(written).toEqual([TEXT])
    expect(wrapper.get('.mlm-copy').text()).toBe('Скопировано')
    await vi.advanceTimersByTimeAsync(1000)
    expect(wrapper.find('.mlm-menu').exists()).toBe(false)
    wrapper.unmount()
  })

  test('a clipboard that refuses just closes the menu', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async () => Promise.reject(new Error('denied')) },
    })
    const wrapper = menu({ point: null, search: TEXT })
    await wrapper.get('.opener').trigger('click')

    await wrapper.get('.mlm-copy').trigger('click')
    await vi.advanceTimersByTimeAsync(0)

    expect(wrapper.find('.mlm-menu').exists()).toBe(false)
    wrapper.unmount()
  })
})

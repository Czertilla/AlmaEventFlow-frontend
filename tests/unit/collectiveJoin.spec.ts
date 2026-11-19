import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { CollectiveCard } from '@/api/generated/almaEventFlow'
import { setAccessToken } from '@/api/client'
import CollectiveJoinCard from '@/components/collective/CollectiveJoinCard.vue'
import { pendingCollective } from '@/utils/quickStart'
import { stubBackend } from './helpers/axiosStub'

const push = vi.fn()
vi.mock('vue-router', async (original) => ({
  ...(await original<typeof import('vue-router')>()),
  useRouter: () => ({ push }),
}))

const NAMES = '/profile/v2/persons/names'
const CONTACTS = '/profile/v3/persons/lead/contacts'
const REQUEST = '/event/v3/collectives/c1/onboarding'
const stubs = { OnboardingChat: true, HelpTip: true, DefaultAvatar: true }

function card(patch: Partial<CollectiveCard> = {}): CollectiveCard {
  return {
    id: 'c1',
    name: 'Хор',
    university_id: null,
    university_name: 'Университет',
    is_verified: true,
    principal_id: 'lead',
    member_count: 3,
    relation: 'none',
    onboarding_id: null,
    can_request: true,
    retry_after: null,
    ...patch,
  }
}

let backend: ReturnType<typeof stubBackend>

beforeEach(() => {
  setActivePinia(createPinia())
  backend = stubBackend((config) => {
    if (config.url === NAMES) {
      return { status: 200, data: { items: [{ id: 'lead', surname: null, name: null, patronymic: null }] } }
    }
    if (config.url === CONTACTS) return { status: 200, data: [{ type: 'tg', value: '@lead', is_main: true }] }
    if (config.url === REQUEST) return { status: 200, data: {} }
    return { status: 404 }
  })
})
afterEach(() => backend.restore())

describe('the card of a collective to join', () => {
  test('it shows only what the leader opened and sends a request', async () => {
    const wrapper = mount(CollectiveJoinCard, { props: { card: card() }, global: { stubs } })
    await flushPromises()

    expect(wrapper.text()).toContain('@lead')
    expect(wrapper.text()).not.toContain('не открыл')
    const send = wrapper.findAll('button').find((b) => b.text() === 'Отправить запрос')
    await send!.trigger('click')
    await flushPromises()

    const [posted] = backend.to(REQUEST)
    expect(JSON.parse(posted.data as string)).toEqual({ comment: null })
    expect(wrapper.emitted('changed')).toHaveLength(1)
  })

  test('a refused request says when to come back and offers no button', async () => {
    const wrapper = mount(CollectiveJoinCard, {
      props: { card: card({ can_request: false, retry_after: '2026-11-26T10:00:00Z' }) },
      global: { stubs },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('Новый запрос можно отправить')
    expect(wrapper.findAll('button').some((b) => b.text() === 'Отправить запрос')).toBe(false)
  })

  test('a former member is sent to the leader', async () => {
    const wrapper = mount(CollectiveJoinCard, {
      props: { card: card({ can_request: false, relation: 'former' }) },
      global: { stubs },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('Вернуть в коллектив может руководитель')
  })

  test('without the details it leads to the form and comes back here after it', async () => {
    const id = '0b5e6a1c-3f2d-4c8e-9a7b-1d2e3f4a5b6c'
    localStorage.clear()
    setAccessToken(null)
    const wrapper = mount(CollectiveJoinCard, {
      props: { card: card({ id, can_request: false }) },
      global: { stubs },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('заполните подробную информацию')
    await wrapper.findAll('button').find((b) => b.text() === 'Заполнить')!.trigger('click')

    expect(push).toHaveBeenCalledWith('/profile/data')
    expect(pendingCollective()).toBe(id)
  })
})

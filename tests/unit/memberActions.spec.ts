import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import MemberDeleteAlert from '@/components/member/MemberDeleteAlert.vue'
import MemberEditorModal from '@/components/member/MemberEditorModal.vue'
import type { MemberRead, RoleRead } from '@/api/generated/almaEventFlow'

const api = vi.hoisted(() => ({
  patch: vi.fn(),
  create: vi.fn(),
  remove: vi.fn(),
  search: vi.fn(),
}))
const toast = vi.hoisted(() => ({ showError: vi.fn() }))

vi.mock('@/api/generated/almaEventFlow', () => ({
  patchMyCollectiveMemberEventV1MeCollectivesCollectiveIdMembersMemberIdPatch: api.patch,
  createMyCollectiveMemberEventV1MeCollectivesCollectiveIdMembersPost: api.create,
  deleteMyCollectiveMemberEventV1MeCollectivesCollectiveIdMembersMemberIdDelete: api.remove,
  searchPersonProfileV1PersonsGet: api.search,
}))
vi.mock('@/composables/useToast', () => ({ useToast: () => toast }))

const Passthrough = defineComponent({ setup: (_, { slots }) => () => h('div', slots.default?.()) })
const ClickButton = defineComponent({
  emits: ['click'],
  setup: (_, { slots, emit }) => () => h('button', { onClick: () => emit('click') }, slots.default?.()),
})
const Toggle = defineComponent({
  props: { modelValue: Boolean },
  emits: ['update:modelValue'],
  setup: (props, { emit }) => () =>
    h('input', {
      type: 'checkbox',
      checked: props.modelValue,
      onChange: (e: Event) => emit('update:modelValue', (e.target as HTMLInputElement).checked),
    }),
})
const Alert = defineComponent({ props: { buttons: { type: Array, default: () => [] } }, setup: () => () => h('div') })

const stubs = {
  IonModal: Passthrough, IonHeader: Passthrough, IonToolbar: Passthrough, IonTitle: Passthrough,
  IonButtons: Passthrough, IonContent: Passthrough, IonIcon: true, IonButton: ClickButton,
  IonToggle: Toggle, IonAlert: Alert,
}

const roles: RoleRead[] = [
  { id: 'r1', collective_id: 'c1', name: 'Солист', created_at: '2026-01-01T00:00:00Z', edited_at: null },
  { id: 'r2', collective_id: 'c1', name: 'Хоровик', created_at: '2026-01-01T00:00:00Z', edited_at: null },
]
const member: MemberRead = {
  id: 'm1', collective_id: 'c1', person_id: 'p1', is_active: true, roles: [{ id: 'r1', name: 'Солист' }],
  created_at: '2026-01-01T00:00:00Z', edited_at: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  api.patch.mockResolvedValue({ data: member })
  api.remove.mockResolvedValue({ data: null })
})

describe('MemberEditorModal', () => {
  async function open() {
    const wrapper = mount(MemberEditorModal, {
      props: { isOpen: false, collectiveId: 'c1', member, memberName: 'Иванов Иван', roles },
      global: { stubs },
    })
    await wrapper.setProps({ isOpen: true })
    return wrapper
  }

  test('shows the member and starts from their roles and state', async () => {
    const wrapper = await open()

    expect(wrapper.text()).toContain('Иванов Иван')
    const chips = wrapper.findAll('.ui-chip')
    expect(chips.map((chip) => chip.classes('ui-chip--active'))).toEqual([true, false])
    expect((wrapper.find('input[type="checkbox"]').element as HTMLInputElement).checked).toBe(true)
  })

  test('saving patches the roles and the activity, then tells the parent', async () => {
    const wrapper = await open()
    await wrapper.findAll('.ui-chip')[1].trigger('click')
    await wrapper.find('input[type="checkbox"]').setValue(false)

    await wrapper.findAll('button').find((b) => b.text() === 'Сохранить')!.trigger('click')
    await flushPromises()

    expect(api.patch).toHaveBeenCalledWith('c1', 'm1', { roles: ['r1', 'r2'], is_active: false })
    expect(wrapper.emitted('saved')).toHaveLength(1)
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  test('a failed save keeps the dialog open and reports the error', async () => {
    api.patch.mockRejectedValue(new Error('boom'))
    const wrapper = await open()

    await wrapper.findAll('button').find((b) => b.text() === 'Сохранить')!.trigger('click')
    await flushPromises()

    expect(toast.showError).toHaveBeenCalled()
    expect(wrapper.emitted('saved')).toBeUndefined()
    expect(wrapper.emitted('close')).toBeUndefined()
  })

  test('reopening starts from the member again, not from the last edit', async () => {
    const wrapper = await open()
    await wrapper.findAll('.ui-chip')[1].trigger('click')
    await wrapper.setProps({ isOpen: false })
    await wrapper.setProps({ isOpen: true })

    expect(wrapper.findAll('.ui-chip').map((chip) => chip.classes('ui-chip--active'))).toEqual([true, false])
  })
})

describe('MemberDeleteAlert', () => {
  function build() {
    const wrapper = mount(MemberDeleteAlert, {
      props: { isOpen: true, collectiveId: 'c1', memberId: 'm1', memberName: 'Иванов Иван' },
      global: { stubs },
    })
    const buttons = wrapper.findComponent(Alert).props('buttons') as { role: string; handler?: () => void }[]
    return { wrapper, destructive: buttons.find((b) => b.role === 'destructive')! }
  }

  test('the destructive button deletes the member and says so', async () => {
    const { wrapper, destructive } = build()

    destructive.handler!()
    await flushPromises()

    expect(api.remove).toHaveBeenCalledWith('c1', 'm1')
    expect(wrapper.emitted('deleted')).toHaveLength(1)
  })

  test('cancel does not touch the member', () => {
    const { wrapper } = build()
    const buttons = wrapper.findComponent(Alert).props('buttons') as { role: string; handler?: () => void }[]

    expect(buttons.find((b) => b.role === 'cancel')!.handler).toBeUndefined()
    expect(api.remove).not.toHaveBeenCalled()
  })

  test('a failed delete reports the error and does not announce a deletion', async () => {
    api.remove.mockRejectedValue(new Error('boom'))
    const { wrapper, destructive } = build()

    destructive.handler!()
    await flushPromises()

    expect(toast.showError).toHaveBeenCalled()
    expect(wrapper.emitted('deleted')).toBeUndefined()
  })
})

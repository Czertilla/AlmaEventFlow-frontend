import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import ResourceFormModal, { type FormField } from '@/components/admin/ResourceFormModal.vue'
import { adminNavigateKey } from '@/composables/useAdminNavigate'

const Pass = defineComponent({ setup: (_, { slots }) => () => h('div', slots.default?.()) })
const IonButtonStub = defineComponent({
  name: 'IonButton',
  setup: (_, { slots }) => () => h('button', slots.default?.()),
})

const stubs = {
  IonIcon: true,
  IonContent: Pass,
  IonButton: IonButtonStub,
  IonToggle: true,
  IonSpinner: true,
  GeoMap: true,
}

const ROLES = [
  { id: 'r1', name: 'Солист' },
  { id: 'r2', name: 'Хорист' },
  { id: 'r3', name: 'Барабанщик' },
]

const mounted: VueWrapper[] = []
const onSave = vi.fn()
const choices = vi.fn()

const FIELDS: FormField[] = [
  { key: 'collective_id', label: 'Коллектив', type: 'text' },
  {
    key: 'roles',
    label: 'Роли',
    type: 'multisearch',
    dependsOn: 'collective_id',
    dependsHint: 'Сначала выберите коллектив',
    choices,
  },
  { key: 'is_active', label: 'Активен', type: 'checkbox' },
]

function form(item: Record<string, unknown> | null, fields = FIELDS) {
  const wrapper = mount(ResourceFormModal, {
    props: { title: 'Участник', fields, item, onSave },
    attachTo: document.body,
    global: { stubs, provide: { [adminNavigateKey as symbol]: vi.fn() } },
  })
  mounted.push(wrapper)
  return wrapper
}

const EXISTING = { id: 'm1', collective_id: 'c1', is_active: true, roles: [ROLES[0], ROLES[1]] }

async function ready(item: Record<string, unknown> | null) {
  const wrapper = form(item)
  await flushPromises()
  return wrapper
}

const chips = (wrapper: VueWrapper) => wrapper.findAll('.msf-chip').map((chip) => chip.text())
const save = async (wrapper: VueWrapper) => {
  await wrapper.get('.ui-sheet-actions button').trigger('click')
  await flushPromises()
}

beforeEach(() => {
  onSave.mockReset()
  onSave.mockResolvedValue(undefined)
  choices.mockReset()
  choices.mockResolvedValue(ROLES)
})

afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount())
  document.body.innerHTML = ''
})

describe('ResourceFormModal multi-value field', () => {
  test('starts with the values the record already has', async () => {
    const wrapper = await ready(EXISTING)

    expect(chips(wrapper)).toEqual(['Солист', 'Хорист'])
  })

  test('saves the ids of what is left after a removal', async () => {
    const wrapper = await ready(EXISTING)

    await wrapper.get('button[aria-label="Убрать: Солист"]').trigger('click')
    await save(wrapper)

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ roles: ['r2'] }))
  })

  test('saves an empty list when everything was removed, so the server clears the link', async () => {
    const wrapper = await ready(EXISTING)

    await wrapper.get('button[aria-label="Убрать: Солист"]').trigger('click')
    await wrapper.get('button[aria-label="Убрать: Хорист"]').trigger('click')
    await save(wrapper)

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ roles: [] }))
  })

  test('saves an added value together with the old ones', async () => {
    const wrapper = await ready(EXISTING)

    await wrapper.get('.msf input').trigger('focus')
    await flushPromises()
    const [option] = document.body.querySelectorAll<HTMLElement>('.ui-option')
    expect(option?.textContent?.trim()).toBe('Барабанщик')
    option!.click()
    await nextTick()
    await save(wrapper)

    expect(chips(wrapper)).toEqual(['Солист', 'Хорист', 'Барабанщик'])
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ roles: ['r1', 'r2', 'r3'] }))
  })

  test('the choices see the current form', async () => {
    const wrapper = await ready(EXISTING)

    await wrapper.get('.msf input').trigger('focus')
    await flushPromises()

    expect(choices).toHaveBeenCalledWith('', expect.objectContaining({ collective_id: 'c1' }))
  })

  test('a new record cannot take roles before the field they depend on is filled', async () => {
    const wrapper = await ready(null)

    expect(wrapper.get('.msf input').attributes('disabled')).toBeDefined()
    expect(wrapper.get('.msf').text()).toContain('Сначала выберите коллектив')

    await wrapper.get('input[type="text"]').setValue('c1')
    await nextTick()

    expect(wrapper.get('.msf input').attributes('disabled')).toBeUndefined()
  })

  test('a new record drops the chosen values when the field they depend on changes', async () => {
    const wrapper = await ready(null)
    const collective = wrapper.get('input[type="text"]')

    await collective.setValue('c1')
    await wrapper.get('.msf input').trigger('focus')
    await flushPromises()
    document.body.querySelector<HTMLElement>('.ui-option')!.click()
    await nextTick()
    expect(chips(wrapper)).toEqual(['Солист'])

    await collective.setValue('c2')
    await nextTick()

    expect(chips(wrapper)).toEqual([])
  })

  test('an existing record keeps its values whatever happens to the field they depend on', async () => {
    const wrapper = await ready(EXISTING)

    await wrapper.get('input[type="text"]').setValue('c2')
    await nextTick()

    expect(chips(wrapper)).toEqual(['Солист', 'Хорист'])
  })

  test('a new record without roles is sent with an empty list', async () => {
    const wrapper = await ready(null)

    await wrapper.get('input[type="text"]').setValue('c1')
    await save(wrapper)

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ collective_id: 'c1', roles: [] }))
  })
})

import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { adminNavigateKey } from '@/composables/useAdminNavigate'
import type { ColumnDef, ExtraAction, RowLink } from '@/components/admin/ResourceTable.vue'

type Listener = (event: { matches: boolean }) => void
const listeners = new Set<Listener>()

function setDesktop(matches: boolean) {
  listeners.forEach((listener) => listener({ matches }))
}

let ResourceTable: typeof import('@/components/admin/ResourceTable.vue').default

beforeAll(async () => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (media: string) => ({
      matches: true,
      media,
      addEventListener: (_: string, listener: Listener) => listeners.add(listener),
      removeEventListener: (_: string, listener: Listener) => listeners.delete(listener),
    }),
  })
  ResourceTable = (await import('@/components/admin/ResourceTable.vue')).default
}, 120_000)

const IonButtonStub = defineComponent({
  name: 'IonButton',
  setup: (_, { slots }) => () => h('button', { class: 'ion-button' }, slots.default?.()),
})

const Pass = defineComponent({ setup: (_, { slots }) => () => h('div', slots.default?.()) })

const IonModalStub = defineComponent({
  name: 'IonModal',
  props: { isOpen: Boolean },
  setup: (props, { slots }) => () => (props.isOpen ? h('div', { class: 'modal-stub' }, slots.default?.()) : null),
})

const stubs = {
  IonIcon: true,
  IonButton: IonButtonStub,
  IonModal: IonModalStub,
  IonHeader: Pass,
  IonToolbar: Pass,
  IonTitle: Pass,
  IonContent: Pass,
  IonButtons: Pass,
  IonAlert: true,
  IonToggle: true,
  IonInfiniteScroll: true,
  IonInfiniteScrollContent: true,
  AppFab: true,
}

const COLUMNS: ColumnDef[] = [{ key: 'name', label: 'Название' }]
const ITEMS = [
  { id: '1', name: 'Первый' },
  { id: '2', name: 'Второй' },
]
const LINKS: RowLink[] = [
  { label: 'Участия', to: (item) => `/admin/participation?event_id=${item.id}` },
  { label: 'Посещаемость', to: (item) => `/admin/attendance?event_id=${item.id}` },
]
const EXTRA: ExtraAction = { icon: 'extra-icon', title: 'Этапы' }

const mounted: VueWrapper[] = []
const navigate = vi.fn()
const fetchItems = vi.fn()

function table(props: Record<string, unknown> = {}) {
  const wrapper = mount(ResourceTable, {
    props: {
      columns: COLUMNS,
      getLabel: (item: { name: string }) => item.name,
      getSubtitle: () => '',
      fetchItems,
      urlSync: false,
      ...props,
    },
    attachTo: document.body,
    global: { stubs, provide: { [adminNavigateKey as symbol]: navigate } },
  })
  mounted.push(wrapper)
  return wrapper
}

async function ready(props: Record<string, unknown> = {}) {
  const wrapper = table(props)
  await flushPromises()
  return wrapper
}

const firstRow = (wrapper: VueWrapper) => wrapper.get('.resource-desktop-table tbody tr .actions-cell')

beforeEach(() => {
  fetchItems.mockReset()
  fetchItems.mockResolvedValue({ data: { items: ITEMS, pagination: { total: ITEMS.length } } })
  navigate.mockReset()
  setDesktop(true)
})

afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount())
  document.body.innerHTML = ''
})

describe('ResourceTable row actions', () => {
  test('edit and delete are always buttons of their own, whatever else the row offers', async () => {
    const wrapper = await ready({ rowLinks: LINKS, extraAction: EXTRA })

    expect(firstRow(wrapper).findAll('.ion-button')).toHaveLength(2)
  })

  test('two or more secondary actions fold into one menu and nothing is clipped', async () => {
    const wrapper = await ready({ rowLinks: LINKS, extraAction: EXTRA })
    const cell = firstRow(wrapper)

    expect(cell.findAll('button[aria-label="Ещё"]')).toHaveLength(1)
    expect(cell.findAll('button.ui-icon-btn')).toHaveLength(1)

    await cell.get('button[aria-label="Ещё"]').trigger('click')
    await nextTick()
    const labels = [...document.body.querySelectorAll('.ui-option')].map((option) => option.textContent?.trim())
    expect(labels).toEqual(['Участия', 'Посещаемость', 'Этапы'])
  })

  test('a single secondary action stays a button instead of hiding behind the menu', async () => {
    const wrapper = await ready({ rowLinks: [LINKS[0]] })
    const cell = firstRow(wrapper)

    expect(cell.find('button[aria-label="Ещё"]').exists()).toBe(false)
    expect(cell.get('button[aria-label="Участия"]').exists()).toBe(true)
  })

  test('an extra action that is not visible for a row does not count towards the menu', async () => {
    const wrapper = await ready({
      rowLinks: [LINKS[0]],
      extraAction: { ...EXTRA, visible: (item: { id: string }) => item.id === '1' },
    })
    const [first, second] = wrapper.findAll('.resource-desktop-table tbody tr .actions-cell')

    expect(first!.find('button[aria-label="Ещё"]').exists()).toBe(true)
    expect(second!.find('button[aria-label="Ещё"]').exists()).toBe(false)
    expect(second!.find('button[aria-label="Участия"]').exists()).toBe(true)
  })

  test('without secondary actions only edit and delete are shown', async () => {
    const wrapper = await ready()
    const cell = firstRow(wrapper)

    expect(cell.findAll('button.ui-icon-btn')).toHaveLength(0)
    expect(cell.findAll('.ion-button')).toHaveLength(2)
  })

  test('picking a menu item follows its link for that row', async () => {
    const wrapper = await ready({ rowLinks: LINKS, extraAction: EXTRA })

    await firstRow(wrapper).get('button[aria-label="Ещё"]').trigger('click')
    await nextTick()
    ;(document.body.querySelectorAll('.ui-option')[1] as HTMLElement).click()

    expect(navigate).toHaveBeenCalledWith('/admin/attendance?event_id=1')
  })

  test('the extra action of the menu is reported with its row', async () => {
    const wrapper = await ready({ rowLinks: LINKS, extraAction: EXTRA })

    await firstRow(wrapper).get('button[aria-label="Ещё"]').trigger('click')
    await nextTick()
    ;(document.body.querySelectorAll('.ui-option')[2] as HTMLElement).click()

    expect(wrapper.emitted('extra')).toEqual([[ITEMS[0]]])
  })
})

describe('ResourceTable toolbar', () => {
  const SORT = [{ value: 'name', label: 'Названию' }]
  const FILTERS = [{ key: 'is_active', label: 'Активность', type: 'toggle' as const }]

  async function phone(props: Record<string, unknown> = {}) {
    const wrapper = await ready(props)
    setDesktop(false)
    await nextTick()
    return wrapper
  }

  const fab = (wrapper: VueWrapper, label: string) =>
    wrapper.findAllComponents({ name: 'AppFab' }).find((button) => button.props('ariaLabel') === label)
  const tap = (button: ReturnType<typeof fab>) => button!.vm.$emit('click')

  test('the search box hints that an id works too', async () => {
    const wrapper = await ready()

    expect(wrapper.get('.rt-search-input').attributes('placeholder')).toBe('Поиск или ID')
  })

  test('on a desktop the toolbar holds the filter button and the sort, and the panel opens in the page', async () => {
    const wrapper = await ready({ sortOptions: SORT, filters: FILTERS })

    expect(wrapper.find('.rt-toolbar .ui-select-pill').exists()).toBe(true)
    expect(fab(wrapper, 'Фильтры')).toBeUndefined()
    expect(fab(wrapper, 'Сортировка')).toBeUndefined()

    await wrapper.get('.rt-tool-btn').trigger('click')
    expect(wrapper.find('.rt-filter-panel .ui-toggle-row').exists()).toBe(true)
    expect(wrapper.find('.modal-stub').exists()).toBe(false)
  })

  test('on a phone the toolbar keeps only the search and the buttons float', async () => {
    const wrapper = await phone({ sortOptions: SORT, filters: FILTERS })

    expect(wrapper.find('.rt-tool-btn').exists()).toBe(false)
    expect(wrapper.find('.rt-toolbar .ui-select-pill').exists()).toBe(false)
    expect(wrapper.find('.rt-filter-panel').exists()).toBe(false)
    expect(fab(wrapper, 'Фильтры')).toBeDefined()
    expect(fab(wrapper, 'Сортировка')).toBeDefined()
  })

  test('the filter button opens a sheet with the fields and no sort in it', async () => {
    const wrapper = await phone({ sortOptions: SORT, filters: FILTERS })
    expect(wrapper.find('.modal-stub').exists()).toBe(false)

    await tap(fab(wrapper, 'Фильтры'))
    await nextTick()

    expect(wrapper.find('.modal-stub .rtf .ui-toggle-row').exists()).toBe(true)
    expect(wrapper.find('.modal-stub .ui-select-trigger').exists()).toBe(false)
  })

  test('the filter button counts the filters that are on', async () => {
    const wrapper = await phone({ filters: FILTERS })
    expect(fab(wrapper, 'Фильтры')!.props('badge')).toBe(0)

    window.history.replaceState(null, '', '/?is_active=true')
    const withUrl = await ready({ filters: FILTERS, urlSync: true })
    setDesktop(false)
    await nextTick()
    window.history.replaceState(null, '', '/')

    expect(fab(withUrl, 'Фильтры')!.props('badge')).toBe(1)
  })

  test('the filter button is a small one above the add button, and the main one when there is no add', async () => {
    const full = await phone({ sortOptions: SORT, filters: FILTERS, addLabel: 'Добавить' })
    expect(fab(full, 'Фильтры')!.props('secondary')).toBe(true)
    expect(fab(full, 'Сортировка')!.props('stack')).toBe(1)

    const noAdd = await phone({ sortOptions: SORT, filters: FILTERS })
    expect(fab(noAdd, 'Фильтры')!.props('secondary')).toBe(false)
    expect(fab(noAdd, 'Сортировка')!.props('stack')).toBe(0)
  })

  test('a list with a sort but no filters gets just the sort button', async () => {
    const wrapper = await phone({ sortOptions: SORT })

    expect(fab(wrapper, 'Фильтры')).toBeUndefined()
    expect(fab(wrapper, 'Сортировка')).toBeDefined()
  })

  test('choosing a sort from the floating menu reloads the list in that order', async () => {
    const wrapper = await phone({ sortOptions: SORT, filters: FILTERS })
    fetchItems.mockClear()

    await tap(fab(wrapper, 'Сортировка'))
    await nextTick()
    ;(document.body.querySelector('.ui-option') as HTMLElement).click()
    await flushPromises()

    expect(fetchItems).toHaveBeenCalledWith(expect.objectContaining({ order_by: 'name' }))
  })

  test('flipping the direction in the sort menu reloads the list descending', async () => {
    const wrapper = await phone({ sortOptions: SORT, defaultSort: 'name' })
    fetchItems.mockClear()

    await tap(fab(wrapper, 'Сортировка'))
    await nextTick()
    ;(document.body.querySelectorAll('.ui-option')[1] as HTMLElement).click()
    await flushPromises()

    expect(fetchItems).toHaveBeenCalledWith(expect.objectContaining({ order_by: '-name' }))
  })

  test('a list without filters or sort draws no filter button at all', async () => {
    const wrapper = await ready()

    expect(wrapper.find('.rt-tool-btn').exists()).toBe(false)
    setDesktop(false)
    await nextTick()
    expect(wrapper.findAllComponents({ name: 'AppFab' })).toHaveLength(0)
  })
})

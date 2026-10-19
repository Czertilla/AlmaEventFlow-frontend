import { mount } from '@vue/test-utils'
import { describe, expect, test } from 'vitest'
import AttendanceHeatmap from '@/components/member/AttendanceHeatmap.vue'
import type {
  AttendanceByMonth, CollectiveDay, CollectiveEventItem, MemberAttendanceItem,
} from '@/api/generated/almaEventFlow'
import {
  collectiveDays, dayKey, dayMarks, dayRateLabel, eventRateLabel, formatRate, groupByDay,
  isUnmarkedAttendance, monthLabels, monthSeries, periodRange, rateColor, rateGradient, weekColumns, yearChips,
} from '@/utils/memberAttendance'

function item(date: string, outcome: MemberAttendanceItem['outcome'], id = date + outcome): MemberAttendanceItem {
  return {
    attendance_id: id,
    event_id: `event-${id}`,
    event_name: `Event ${id}`,
    date,
    status: 'active',
    type: null,
    outcome,
    is_attended: outcome === 'attended',
    is_verified: false,
    comment: null,
  }
}

describe('groupByDay', () => {
  test('counts the outcomes of a day and the presence ratio among the marked ones', () => {
    const days = groupByDay([
      item('2026-03-02', 'absent', 'a'),
      item('2026-03-02', 'attended', 'b'),
      item('2026-03-02', 'attended', 'c'),
      item('2026-03-02', 'unmarked', 'u'),
      item('2026-03-03', 'upcoming'),
      item('2026-03-04', 'unmarked', 'd'),
      item('2026-03-05', 'absent', 'e'),
    ])

    const first = days.get('2026-03-02')!
    expect(first.counts).toEqual({ attended: 2, absent: 1, unmarked: 1, upcoming: 0 })
    expect(first.rate).toBeCloseTo(2 / 3)
    expect(days.get('2026-03-03')!.rate).toBeNull()
    expect(days.get('2026-03-04')!.rate).toBeNull()
    expect(days.get('2026-03-05')!.rate).toBe(0)
    expect(days.size).toBe(4)
  })

  test('a day with presence at one event and absence at another is neither', () => {
    const day = groupByDay([item('2026-03-02', 'attended', 'a'), item('2026-03-02', 'absent', 'b')])
      .get('2026-03-02')!

    expect(day.rate).toBe(0.5)
    expect(dayRateLabel(day)).toBe('50% (1 из 2)')
  })
})

describe('presence colour scale', () => {
  const ATTENDED = 'rgb(var(--att-attended-rgb))'
  const UNMARKED = 'rgb(var(--att-unmarked-rgb))'
  const ABSENT = 'rgb(var(--att-absent-rgb))'
  const mix = /^color-mix\(in oklab, (.+) ([\d.]+)%, (.+)\)$/

  test('the ends are the colours of presence and absence, the middle is the colour of unmarked', () => {
    expect(rateColor(1)).toBe(ATTENDED)
    expect(rateColor(0.5)).toBe(UNMARKED)
    expect(rateColor(0)).toBe(ABSENT)
  })

  test('between the stops it blends the two neighbouring colours', () => {
    const upper = mix.exec(rateColor(0.75))!
    expect([upper[1], Number(upper[2]), upper[3]]).toEqual([ATTENDED, 50, UNMARKED])

    const lower = mix.exec(rateColor(0.1))!
    expect([lower[1], Number(lower[2]), lower[3]]).toEqual([UNMARKED, 20, ABSENT])
  })

  test('the share of the nearer colour grows towards each stop', () => {
    const share = (rate: number) => Number(mix.exec(rateColor(rate))![2])

    expect([0.9, 0.8, 0.7, 0.6].map(share)).toEqual([80, 60, 40, 20])
    expect([0.1, 0.2, 0.3, 0.4].map(share)).toEqual([20, 40, 60, 80])
  })

  test('values outside 0..1 are clamped', () => {
    expect(rateColor(2)).toBe(rateColor(1))
    expect(rateColor(-1)).toBe(rateColor(0))
  })

  test('the legend gradient runs from presence through unmarked to absence', () => {
    const gradient = rateGradient()

    expect(gradient.startsWith(`linear-gradient(to right, ${ATTENDED} 0%`)).toBe(true)
    expect(gradient).toContain(`${UNMARKED} 50%`)
    expect(gradient.endsWith(`${ABSENT} 100%)`)).toBe(true)
  })
})

describe('day marks and unmarked rows', () => {
  test('an unmarked event adds nothing to the colour of a day, it only hatches the dot', () => {
    const [day] = [...groupByDay([
      item('2026-03-02', 'attended', 'a'),
      item('2026-03-02', 'unmarked', 'b'),
      item('2026-03-02', 'upcoming', 'c'),
    ]).values()]

    expect(dayMarks(day).map((mark) => mark.key)).toEqual(['rate', 'upcoming'])
    expect(dayMarks(day)[0]).toMatchObject({ color: rateColor(1), hatch: true })
  })

  test('a day without unmarked events has a plain dot, one with only unmarked ones the neutral hatch', () => {
    const days = groupByDay([
      item('2026-03-02', 'absent', 'a'),
      item('2026-03-03', 'unmarked', 'b'),
    ])

    expect(dayMarks(days.get('2026-03-02')!)).toEqual([{ key: 'rate', color: rateColor(0), hatch: false }])
    expect(dayMarks(days.get('2026-03-03')!)).toEqual([{ key: 'unmarked', outcome: 'unmarked' }])
  })

  test('a row nobody edited is unmarked whatever it stores', () => {
    const edited = '2026-01-01T00:00:00Z'

    expect(isUnmarkedAttendance({ is_attended: false, edited_at: null, is_verified: false })).toBe(true)
    expect(isUnmarkedAttendance({ is_attended: true, edited_at: null, is_verified: false })).toBe(true)
    expect(isUnmarkedAttendance({ is_attended: null, edited_at: edited, is_verified: false })).toBe(true)
    expect(isUnmarkedAttendance({ is_attended: false, edited_at: edited, is_verified: false })).toBe(false)
    expect(isUnmarkedAttendance({ is_attended: false, edited_at: null, is_verified: true })).toBe(false)
  })
})

describe('period ranges', () => {
  const today = new Date(2026, 9, 14)

  test('a rolling period starts on a week start and runs a few weeks ahead', () => {
    const { from, to } = periodRange('rolling', today, 1)

    expect(from.getDay()).toBe(1)
    expect(dayKey(from)).toBe('2025-10-13')
    expect(to.getDay()).toBe(0)
    expect(dayKey(to)).toBe('2026-11-08')
  })

  test('a year period is the calendar year', () => {
    const { from, to } = periodRange(2025, today, 1)

    expect([dayKey(from), dayKey(to)]).toEqual(['2025-01-01', '2025-12-31'])
  })

  test('both stay within what the API accepts', () => {
    for (const period of ['rolling', 2024] as const) {
      const { from, to } = periodRange(period, today, 0)
      expect((to.getTime() - from.getTime()) / 86_400_000).toBeLessThanOrEqual(731)
    }
  })
})

describe('week columns and labels', () => {
  test('whole weeks cover the range', () => {
    const { from, to } = periodRange(2026, new Date(2026, 5, 1), 1)
    const weeks = weekColumns(from, to, 1)

    expect(weeks.every((week) => week.length === 7)).toBe(true)
    expect(dayKey(weeks[0][0])).toBe('2025-12-29')
    expect(weeks.at(-1)!.at(-1)).toEqual(expect.any(Date))
    expect(weeks).toHaveLength(53)
  })

  test('month labels sit on the week the month starts and never crowd each other', () => {
    const { from, to } = periodRange(2026, new Date(2026, 5, 1), 1)
    const labels = monthLabels(weekColumns(from, to, 1), from, to)

    expect(labels.map((label) => label.label.toLowerCase())).toEqual([
      'янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек',
    ])
    for (let i = 1; i < labels.length; i++) expect(labels[i].col - labels[i - 1].col).toBeGreaterThanOrEqual(3)
  })
})

describe('monthSeries', () => {
  test('fills the months the server did not return with zeros', () => {
    const rows: AttendanceByMonth[] = [
      { month: '2026-02-01', attended: 2, absent: 1, unmarked: 0, upcoming: 0 },
    ]

    const series = monthSeries(new Date(2026, 0, 10), new Date(2026, 3, 5), rows)

    expect(series.map((bucket) => bucket.key)).toEqual(['2026-01-01', '2026-02-01', '2026-03-01', '2026-04-01'])
    expect(series.map((bucket) => bucket.attended)).toEqual([0, 2, 0, 0])
    expect(series[1].absent).toBe(1)
  })
})

describe('small formatters', () => {
  test('rate shows a percentage or a dash', () => {
    expect(formatRate(0.666)).toBe('67%')
    expect(formatRate(0)).toBe('0%')
    expect(formatRate(null)).toBe('—')
  })

  test('year chips keep the newest and always include the active one', () => {
    expect(yearChips([2026, 2025, 2024, 2023, 2022, 2021], 'rolling')).toEqual([2026, 2025, 2024, 2023])
    expect(yearChips([2026, 2025, 2024, 2023, 2022], 2021)).toEqual([2026, 2025, 2024, 2023, 2021])
  })
})

describe('AttendanceHeatmap', () => {
  const from = new Date(2026, 2, 1)
  const to = new Date(2026, 2, 31)
  const items = [
    item('2026-03-02', 'attended', 'a'),
    item('2026-03-02', 'attended', 'b'),
    item('2026-03-10', 'absent'),
    item('2026-03-12', 'attended', 'm1'),
    item('2026-03-12', 'absent', 'm2'),
    item('2026-03-15', 'attended', 'h1'),
    item('2026-03-15', 'unmarked', 'h2'),
    item('2026-03-18', 'unmarked'),
    item('2026-03-20', 'upcoming'),
  ]

  function build(selected: string | null = null) {
    return mount(AttendanceHeatmap, { props: { items, from, to, selected, weekStartsOn: 1 } })
  }

  const cells = (wrapper: ReturnType<typeof build>) => wrapper.findAll('button.hm-cell')
  const colour = (wrapper: ReturnType<typeof build>, index: number) =>
    (cells(wrapper)[index].element as HTMLElement).style.getPropertyValue('--att-rate')

  test('only days with events are buttons', () => {
    expect(cells(build())).toHaveLength(6)
  })

  test('a day is coloured by its presence ratio: green, red and in between', () => {
    const wrapper = build()

    expect(colour(wrapper, 0)).toBe(rateColor(1))
    expect(colour(wrapper, 1)).toBe(rateColor(0))
    expect(colour(wrapper, 2)).toBe(rateColor(0.5))
    expect(new Set([colour(wrapper, 0), colour(wrapper, 1), colour(wrapper, 2)]).size).toBe(3)
    for (const index of [0, 1, 2]) expect(cells(wrapper)[index].classes()).toContain('ui-att-rate')
  })

  test('a day with unmarked events too is hatched in the colour its marked events give it', () => {
    const wrapper = build()

    expect(cells(wrapper)[3].classes()).toContain('ui-att-hatch')
    expect(cells(wrapper)[3].classes()).not.toContain('ui-att-rate')
    expect(colour(wrapper, 3)).toBe(rateColor(1))
  })

  test('a day with only unmarked events keeps the neutral hatch, one with only upcoming ones is a ring', () => {
    const wrapper = build()

    expect(cells(wrapper)[4].classes()).toContain('ui-att--unmarked')
    expect(colour(wrapper, 4)).toBe('')
    expect(cells(wrapper)[5].classes()).toContain('ui-att--upcoming')
    expect(colour(wrapper, 5)).toBe('')
  })

  test('the label of a mixed day tells the ratio', () => {
    expect(cells(build())[2].attributes('aria-label')).toContain('Присутствие: 50% (1 из 2)')
  })

  test('days outside the period are hidden', () => {
    const wrapper = build()

    expect(wrapper.findAll('.hm-cell--out').length).toBeGreaterThan(0)
    expect(wrapper.findAll('.hm-cell--out').every((cell) => cell.attributes('aria-hidden') === 'true')).toBe(true)
  })

  test('a click selects a day and a second click clears it', async () => {
    const wrapper = build()
    await cells(wrapper)[1].trigger('click')
    expect(wrapper.emitted('select')![0]).toEqual(['2026-03-10'])

    const selected = build('2026-03-10')
    await cells(selected)[1].trigger('click')
    expect(selected.emitted('select')![0]).toEqual([null])
    expect(cells(selected)[1].classes()).toContain('hm-cell--selected')
  })

  test('hovering a day lists its events and the ratio', async () => {
    const wrapper = build()
    await cells(wrapper)[0].trigger('mouseenter')

    expect(wrapper.find('.hm-tip').text()).toContain('Event a')
    expect(wrapper.find('.hm-tip').text()).toContain('Event b')
    expect(wrapper.find('.hm-tip').text()).toContain('Присутствие: 100% (2 из 2)')

    await wrapper.trigger('mouseleave')
    expect(wrapper.find('.hm-tip').exists()).toBe(false)
  })
})

describe('collectiveDays', () => {
  const day = (date: string, attended: number, absent: number, unmarked: number, upcoming = 0): CollectiveDay => ({
    date, attended, absent, unmarked, upcoming,
  })
  const event = (id: string, date: string, attended: number, absent: number, unmarked = 0): CollectiveEventItem => ({
    event_id: id, event_name: `Event ${id}`, date, status: 'active', type: null, attended, absent, unmarked, upcoming: 0,
  })

  test('a day is rated by the share of the declared roster that came, unmarked places left out', () => {
    const days = collectiveDays(
      [day('2026-03-02', 3, 1, 0), day('2026-03-03', 2, 0, 4), day('2026-03-04', 0, 0, 5), day('2026-03-05', 0, 6, 0)],
      [event('a', '2026-03-02', 3, 1)],
    )

    expect(days.get('2026-03-02')!.rate).toBe(0.75)
    expect(days.get('2026-03-03')!.rate).toBe(1)
    expect(days.get('2026-03-04')!.rate).toBeNull()
    expect(days.get('2026-03-05')!.rate).toBe(0)
    expect(dayRateLabel(days.get('2026-03-02')!)).toBe('75% (3 из 4)')
  })

  test('unmarked places hatch a rated day, and a day with only unmarked ones stays neutral', () => {
    const days = collectiveDays([day('2026-03-03', 2, 0, 4), day('2026-03-04', 0, 0, 5), day('2026-03-02', 3, 1, 0)], [])

    expect(dayMarks(days.get('2026-03-03')!)).toEqual([{ key: 'rate', color: rateColor(1), hatch: true }])
    expect(dayMarks(days.get('2026-03-04')!)).toEqual([{ key: 'unmarked', outcome: 'unmarked' }])
    expect(dayMarks(days.get('2026-03-02')!)).toEqual([{ key: 'rate', color: rateColor(0.75), hatch: false }])
  })

  test('the events of a day are its entries, each with its own share', () => {
    const days = collectiveDays(
      [day('2026-03-02', 5, 3, 0)],
      [event('a', '2026-03-02', 3, 1), event('b', '2026-03-02', 2, 2), event('c', '2026-03-09', 1, 0)],
    )

    expect(days.get('2026-03-02')!.entries).toEqual([
      { id: 'a', label: 'Event a', detail: '3 из 4' },
      { id: 'b', label: 'Event b', detail: '2 из 4' },
    ])
    expect(days.has('2026-03-09')).toBe(false)
    expect(eventRateLabel(event('x', '2026-03-02', 0, 0, 3))).toBe('не отмечено')
  })

  test('the heatmap colours days of a collective and lists its events in the tip', async () => {
    const days = collectiveDays(
      [day('2026-03-02', 3, 1, 0), day('2026-03-03', 2, 0, 4)],
      [event('a', '2026-03-02', 3, 1)],
    )
    const wrapper = mount(AttendanceHeatmap, {
      props: { days, from: new Date(2026, 2, 1), to: new Date(2026, 2, 31), selected: null, weekStartsOn: 1 },
    })
    const cells = wrapper.findAll('button.hm-cell')

    expect(cells).toHaveLength(2)
    expect((cells[0].element as HTMLElement).style.getPropertyValue('--att-rate')).toBe(rateColor(0.75))
    expect(cells[0].classes()).toContain('ui-att-rate')
    expect(cells[1].classes()).toContain('ui-att-hatch')

    await cells[0].trigger('mouseenter')
    expect(wrapper.find('.hm-tip').text()).toContain('Event a')
    expect(wrapper.find('.hm-tip').text()).toContain('3 из 4')
    expect(wrapper.find('.hm-tip').text()).toContain('Присутствие: 75% (3 из 4)')
  })
})

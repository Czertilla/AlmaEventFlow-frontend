import { describe, expect, test } from 'vitest'
import { distanceMeters, formatDistance } from '@/utils/geo'

describe('distanceMeters', () => {
  test('is zero for the same point and symmetric', () => {
    const a = { lat: 55.7583, lon: 37.6116 }
    const b = { lat: 55.7593, lon: 37.6116 }

    expect(distanceMeters(a, a)).toBe(0)
    expect(distanceMeters(a, b)).toBeCloseTo(111.2, 0)
    expect(distanceMeters(b, a)).toBeCloseTo(distanceMeters(a, b), 6)
  })

  test('counts a degree of longitude shorter towards the pole', () => {
    const equator = distanceMeters({ lat: 0, lon: 30 }, { lat: 0, lon: 31 })
    const north = distanceMeters({ lat: 60, lon: 30 }, { lat: 60, lon: 31 })

    expect(equator).toBeCloseTo(111_195, -2)
    expect(north).toBeCloseTo(equator / 2, -2)
  })
})

describe('formatDistance', () => {
  test.each([
    [0, '10 м'],
    [4, '10 м'],
    [123, '120 м'],
    [994, '990 м'],
    [995, '1,0 км'],
    [999, '1,0 км'],
    [1000, '1,0 км'],
    [1234, '1,2 км'],
    [9990, '10,0 км'],
    [15_400, '15 км'],
    [Number.POSITIVE_INFINITY, ''],
  ])('%d m is "%s"', (meters, text) => {
    expect(formatDistance(meters)).toBe(text)
  })
})

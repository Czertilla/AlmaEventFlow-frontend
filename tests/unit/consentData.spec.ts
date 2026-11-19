import { mount } from '@vue/test-utils'
import { describe, expect, test } from 'vitest'
import type { MyProfileReadV3, PolicyExportRead } from '@/api/generated/almaEventFlow'
import SlidingTabs from '@/components/common/SlidingTabs.vue'
import { policyExportTable, sha256Hex, toCsv } from '@/utils/dataAccess'
import { changedPassports, sectionOfField, snapshot, type PassportRow, type ProfileFormLike } from '@/utils/profileFormDiff'
import { passportKeys, profileWrite, withValues } from '@/utils/profileWrite'

const profile: MyProfileReadV3 = {
  id: 'p1',
  surname: 'Иванова',
  name: 'Анна',
  patronymic: null,
  birthdate: null,
  workplace_id: null,
  diet_id: 3,
  diet: null,
  student: null,
  contacts: [{ id: 'c1', type: 'email', value: 'anna@example.org', is_main: true } as MyProfileReadV3['contacts'][number]],
  passports: [],
  created_at: '2026-11-01T10:00:00Z',
  edited_at: null,
}

describe('filling the fields a policy asks for', () => {
  test('the saved profile goes back unchanged and the new values are added', () => {
    const body = withValues(profileWrite(profile), {
      'contact.phone': '8 900 000 00 00',
      'profile.birthdate': '2003-05-06',
      'passport.number': '4510 246813',
      'passport.expire_date': '2031-02-03',
    })

    expect(body.diet_id).toBe(3)
    expect(body.contacts).toEqual([
      { id: 'c1', type: 'email', value: 'anna@example.org', is_main: true },
      expect.objectContaining({ type: 'phone', is_main: true }),
    ])
    expect(body.birthdate).toBe('2003-05-06')
    expect(body.passports).toEqual([
      expect.objectContaining({ number: '4510 246813', expire_date: '2031-02-03', issued_date: null }),
    ])
  })

  test('an empty value changes nothing and an existing passport keeps its id', () => {
    const withPassport: MyProfileReadV3 = {
      ...profile,
      passports: [{
        id: 'pp1', number: '1', expire_date: '2030-01-01', is_foreign: false, issued_date: null,
        issued_authority: null, name_variant: null, created_at: '2026-11-01T10:00:00Z', edited_at: null,
      }],
    }

    const body = withValues(profileWrite(withPassport), { 'passport.issued_authority': 'ОВД', 'contact.vk': ' ' })

    expect(body.contacts).toHaveLength(1)
    expect(body.passports).toEqual([expect.objectContaining({ id: 'pp1', number: '1', issued_authority: 'ОВД' })])
  })

  test('a new passport always asks for its number and term', () => {
    expect(passportKeys(['passport.issued_date'], false)).toEqual([
      'passport.number', 'passport.expire_date', 'passport.issued_date',
    ])
    expect(passportKeys(['passport.issued_date'], true)).toEqual(['passport.issued_date'])
  })
})

describe('the export along a policy', () => {
  test('a member without consent stays a row with empty cells', () => {
    const exported: PolicyExportRead = {
      policy_id: 'v2',
      version: 2,
      exported_at: '2026-11-18T10:00:00Z',
      fields: [{ key: 'contact.phone', label: 'Телефон' }, { key: 'passport.number', label: 'Номер паспорта' }],
      subjects: [
        { person_id: 'a', records: [{ 'contact.phone': '+7900' }], reason: 'consent_outdated', missing_fields: ['passport.number'] },
        { person_id: 'b', records: [], reason: 'consent_missing', missing_fields: ['contact.phone', 'passport.number'] },
      ],
    }

    const table = policyExportTable(exported, new Map([['a', 'Анна'], ['b', 'Борис']]))

    expect(table.header).toEqual(['ФИО', 'Телефон', 'Номер паспорта'])
    expect(table.rows).toEqual([['Анна', '+7900', ''], ['Борис', '', '']])
    expect(toCsv(table)).toContain('Борис;;' + String.fromCharCode(13, 10))
  })

  test('the hash of the shown text is the hex SHA-256', async () => {
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })
})

describe('the passport tab of the profile form', () => {
  const row = (patch: Partial<PassportRow> = {}): PassportRow => ({
    id: 'pp1', number: '1', expireDate: '2030-01-01', issuedDate: null, issuedAuthority: '',
    isForeign: false, hasVariant: false, variant: { surname: '', name: '', patronymic: '' }, ...patch,
  })
  const form = (passports: PassportRow[]) => ({ passports } as unknown as ProfileFormLike)
  const base = (passports: PassportRow[]) => snapshot({
    surname: '', name: '', patronymic: '', birthdate: null, isStudent: false, studentId: '', isBudget: false,
    isFull: false, grade: '', contacts: [], passports,
    university: { id: null, draft: null }, faculty: { id: null, draft: null }, group: { id: null, draft: null },
    degree: { id: null, draft: null }, workplace: { id: null, draft: null }, diet: { id: null, draft: null },
  })

  test('a changed, a new and a removed passport each count once', () => {
    const before = base([row(), row({ id: 'pp2' })])

    expect(changedPassports(before, form([row({ number: '2' }), row({ id: undefined })]))).toBe(3)
    expect(changedPassports(before, form([row(), row({ id: 'pp2' })]))).toBe(0)
  })

  test('a field of a policy points at its tab', () => {
    expect(['contact.phone', 'passport.number', 'name_variant.fullname', 'student.group', 'profile.birthdate', 'x']
      .map(sectionOfField)).toEqual(['contacts', 'passport', 'passport', 'study', 'about', null])
  })

  test('a tab with something to fill pulses', () => {
    const wrapper = mount(SlidingTabs, {
      props: { modelValue: 'a', tabs: [{ key: 'a', label: 'А' }, { key: 'b', label: 'Б', attention: true }] },
      global: { stubs: { IonIcon: true } },
    })
    const [first, second] = wrapper.findAll('.sliding-tab')

    expect(first.classes()).not.toContain('ui-attention')
    expect(second.classes()).toContain('ui-attention')
    wrapper.unmount()
  })
})

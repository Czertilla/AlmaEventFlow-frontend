import type {
  ContactType,
  MyPassportData,
  MyProfileReadV3,
  MyProfileWriteV3,
} from '@/api/generated/almaEventFlow'
import { normalizeContact } from '@/utils/contactTypes'

/** Сохранённая подробная информация как тело `PUT`: всё, что есть, остаётся как было. */
export function profileWrite(profile: MyProfileReadV3): MyProfileWriteV3 {
  const student = profile.student
  return {
    surname: profile.surname,
    name: profile.name,
    patronymic: profile.patronymic,
    birthdate: profile.birthdate,
    workplace_id: profile.workplace_id,
    diet_id: profile.diet_id,
    student: student
      ? {
          student_id: student.student_id,
          group_id: student.group_id,
          faculty_id: student.faculty_id,
          is_budget: student.is_budget,
          is_full: student.is_full,
          is_active: student.is_active,
        }
      : null,
    contacts: profile.contacts.map((c) => ({ id: c.id, type: c.type, value: c.value, is_main: !!c.is_main })),
    passports: (profile.passports ?? []).map(passportWrite),
  }
}

export function passportWrite(passport: NonNullable<MyProfileReadV3['passports']>[number]): MyPassportData {
  return {
    id: passport.id,
    number: passport.number,
    expire_date: passport.expire_date,
    is_foreign: passport.is_foreign,
    issued_date: passport.issued_date,
    issued_authority: passport.issued_authority,
    name_variant: passport.name_variant
      ? {
          surname: passport.name_variant.surname,
          name: passport.name_variant.name,
          patronymic: passport.name_variant.patronymic,
        }
      : null,
  }
}

/** Поля, которые можно дополнить прямо в «Что сделать»; остальные заполняются в форме. */
export const INLINE_FIELDS = new Set([
  'contact.email', 'contact.phone', 'contact.tg', 'contact.vk', 'contact.address',
  'profile.birthdate',
  'passport.number', 'passport.expire_date', 'passport.issued_date', 'passport.issued_authority',
])

export const PASSPORT_REQUIRED = ['passport.number', 'passport.expire_date']

/** Поля паспорта, которые надо спросить: у нового паспорта номер и срок обязательны. */
export function passportKeys(missing: string[], hasPassport: boolean): string[] {
  const asked = missing.filter((key) => key.startsWith('passport.'))
  if (!asked.length || hasPassport) return asked
  return [...new Set([...PASSPORT_REQUIRED, ...asked])]
}

/** Тело `PUT` с дописанными значениями; пустое значение ничего не меняет. */
export function withValues(write: MyProfileWriteV3, values: Record<string, string>): MyProfileWriteV3 {
  const next: MyProfileWriteV3 = {
    ...write,
    contacts: [...(write.contacts ?? [])],
    passports: [...(write.passports ?? [])],
  }
  const value = (key: string) => (values[key] ?? '').trim()
  for (const key of Object.keys(values)) {
    if (!key.startsWith('contact.') || !value(key)) continue
    const type = key.slice('contact.'.length) as ContactType
    const first = !next.contacts!.some((c) => c.type === type)
    next.contacts!.push({ type, value: normalizeContact(type, value(key)), is_main: first })
  }
  if (value('profile.birthdate')) next.birthdate = value('profile.birthdate')
  const passportValues = {
    number: value('passport.number'),
    expire_date: value('passport.expire_date'),
    issued_date: value('passport.issued_date'),
    issued_authority: value('passport.issued_authority'),
  }
  if (Object.values(passportValues).some(Boolean)) {
    const [current, ...rest] = next.passports!
    const base: MyPassportData = current ?? { number: '', expire_date: '', is_foreign: false }
    const merged: MyPassportData = {
      ...base,
      number: passportValues.number || base.number,
      expire_date: passportValues.expire_date || base.expire_date,
      issued_date: passportValues.issued_date || base.issued_date || null,
      issued_authority: passportValues.issued_authority || base.issued_authority || null,
    }
    next.passports = [merged, ...rest]
  }
  return next
}

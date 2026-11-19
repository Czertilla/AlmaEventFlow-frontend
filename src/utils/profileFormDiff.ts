export type SectionKey = 'about' | 'study' | 'extra' | 'contacts' | 'passport'
export type FieldKey =
  | 'surname' | 'name' | 'patronymic' | 'birthdate'
  | 'isStudent' | 'studentId' | 'group' | 'isBudget' | 'isFull'
  | 'workplace' | 'diet'

export const SECTIONS: { key: SectionKey; label: string }[] = [
  { key: 'about', label: 'О вас' },
  { key: 'study', label: 'Учёба' },
  { key: 'extra', label: 'Дополнительно' },
  { key: 'contacts', label: 'Контакты' },
  { key: 'passport', label: 'Паспорт' },
]

/** Вкладка формы, где лежит поле реестра; по ней подсвечивается то, что надо дополнить. */
export function sectionOfField(key: string): SectionKey | null {
  if (key.startsWith('contact.')) return 'contacts'
  if (key.startsWith('passport.') || key.startsWith('name_variant.')) return 'passport'
  if (key.startsWith('student.')) return 'study'
  if (key === 'profile.diet' || key === 'profile.workplace') return 'extra'
  if (key === 'profile.birthdate' || key === 'person.fullname') return 'about'
  return null
}

export interface PassportRow {
  id?: string
  number: string
  expireDate: string | null
  issuedDate: string | null
  issuedAuthority: string
  isForeign: boolean
  hasVariant: boolean
  variant: { surname: string; name: string; patronymic: string }
}

export const SECTION_FIELDS: Record<Exclude<SectionKey, 'contacts' | 'passport'>, FieldKey[]> = {
  about: ['surname', 'name', 'patronymic', 'birthdate'],
  study: ['isStudent', 'studentId', 'group', 'isBudget', 'isFull'],
  extra: ['workplace', 'diet'],
}

interface Choice { id: string | number | null; draft: string | null }

export interface ProfileFormLike {
  surname: string
  name: string
  patronymic: string
  birthdate: string | null
  isStudent: boolean
  studentId: string
  isBudget: boolean
  isFull: boolean
  university: Choice
  faculty: Choice
  group: Choice
  degree: Choice
  grade: string
  workplace: Choice
  diet: Choice
  contacts: { id?: string; type: string; value: string; is_main: boolean }[]
  passports?: PassportRow[]
}

export interface FormSnapshot {
  fields: Record<FieldKey, string>
  contacts: Map<string, string>
  passports: Map<string, string>
}

const text = (value: string | null | undefined) => (value ?? '').trim()
const choice = (value: Choice) => `${value.id ?? ''}|${value.draft ?? ''}`
const contact = (row: ProfileFormLike['contacts'][number]) => `${row.type}|${text(row.value)}|${row.is_main}`
const passport = (row: PassportRow) => [
  text(row.number), text(row.expireDate), text(row.issuedDate), text(row.issuedAuthority), row.isForeign,
  row.hasVariant ? [row.variant.surname, row.variant.name, row.variant.patronymic].map(text).join(' ') : '',
].join('|')

export function groupSignature(form: ProfileFormLike): string {
  return [form.group, form.faculty, form.degree, form.university].map(choice).concat(text(form.grade)).join('/')
}

export function snapshot(form: ProfileFormLike): FormSnapshot {
  return {
    fields: {
      surname: text(form.surname),
      name: text(form.name),
      patronymic: text(form.patronymic),
      birthdate: text(form.birthdate),
      isStudent: String(form.isStudent),
      studentId: text(form.studentId),
      group: groupSignature(form),
      isBudget: String(form.isBudget),
      isFull: String(form.isFull),
      workplace: choice(form.workplace),
      diet: choice(form.diet),
    },
    contacts: new Map(form.contacts.filter((row) => row.id).map((row) => [row.id as string, contact(row)])),
    passports: new Map((form.passports ?? []).filter((row) => row.id).map((row) => [row.id as string, passport(row)])),
  }
}

export function changedPassports(baseline: FormSnapshot, form: ProfileFormLike): number {
  const present = new Set<string>()
  let changed = 0
  for (const row of form.passports ?? []) {
    if (!row.id) changed += 1
    else {
      present.add(row.id)
      if (baseline.passports.get(row.id) !== passport(row)) changed += 1
    }
  }
  for (const id of baseline.passports.keys()) if (!present.has(id)) changed += 1
  return changed
}

export function changedFields(baseline: FormSnapshot, form: ProfileFormLike): Set<FieldKey> {
  const current = snapshot(form).fields
  return new Set((Object.keys(current) as FieldKey[]).filter((key) => current[key] !== baseline.fields[key]))
}

export function changedContacts(baseline: FormSnapshot, form: ProfileFormLike): number {
  const present = new Set<string>()
  let changed = 0
  for (const row of form.contacts) {
    if (!row.id) changed += 1
    else {
      present.add(row.id)
      if (baseline.contacts.get(row.id) !== contact(row)) changed += 1
    }
  }
  for (const id of baseline.contacts.keys()) if (!present.has(id)) changed += 1
  return changed
}

export function sectionCounts(baseline: FormSnapshot, form: ProfileFormLike): Record<SectionKey, number> {
  const changed = changedFields(baseline, form)
  const count = (section: Exclude<SectionKey, 'contacts' | 'passport'>) => SECTION_FIELDS[section].filter((key) => changed.has(key)).length
  return {
    about: count('about'),
    study: count('study'),
    extra: count('extra'),
    contacts: changedContacts(baseline, form),
    passport: changedPassports(baseline, form),
  }
}

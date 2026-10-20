import { optionsFromPairs } from '@/utils/selectOptions'

export type ContactKey = 'email' | 'phone' | 'tg' | 'vk' | 'address'

export interface ContactKind {
  label: string
  placeholder: string
  inputType: 'email' | 'tel' | 'text'
  inputmode: 'email' | 'tel' | 'text'
  autocomplete?: string
  maxlength: number
  normalize: (value: string) => string
  validate: (value: string) => string | null
}

const squash = (value: string) => value.trim().replace(/\s+/g, ' ')

function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (!digits) return ''
  if (digits.length === 11 && (digits[0] === '8' || digits[0] === '7')) return `+7${digits.slice(1)}`
  if (digits.length === 10 && digits[0] === '9') return `+7${digits}`
  return `+${digits}`
}

function normalizeTelegram(value: string): string {
  const name = squash(value).replace(/^(https?:\/\/)?(www\.)?(t|telegram)\.me\//i, '').replace(/^@/, '')
  return name ? `@${name}` : ''
}

function normalizeVk(value: string): string {
  const name = squash(value).replace(/^(https?:\/\/)?(www\.|m\.)?vk\.com\//i, '').replace(/^@/, '')
  return name ? `https://vk.com/${name}` : ''
}

export const CONTACT_KINDS: Record<ContactKey, ContactKind> = {
  email: {
    label: 'Электронная почта',
    placeholder: 'name@example.com',
    inputType: 'email',
    inputmode: 'email',
    autocomplete: 'email',
    maxlength: 256,
    normalize: (value) => value.trim(),
    validate: (value) => (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value) ? null : 'Адрес должен выглядеть как name@example.com'),
  },
  phone: {
    label: 'Телефон',
    placeholder: '+7 900 123-45-67',
    inputType: 'tel',
    inputmode: 'tel',
    autocomplete: 'tel',
    maxlength: 32,
    normalize: normalizePhone,
    validate: (value) => (/^\+\d{10,15}$/.test(value) ? null : 'Номер целиком, с кодом: 10–15 цифр'),
  },
  tg: {
    label: 'Telegram',
    placeholder: '@username',
    inputType: 'text',
    inputmode: 'text',
    maxlength: 64,
    normalize: normalizeTelegram,
    validate: (value) => (/^@[A-Za-z][A-Za-z0-9_]{4,31}$/.test(value) ? null : 'Имя из 5–32 латинских букв, цифр или _, начинается с буквы'),
  },
  vk: {
    label: 'ВКонтакте',
    placeholder: 'vk.com/username',
    inputType: 'text',
    inputmode: 'text',
    maxlength: 128,
    normalize: normalizeVk,
    validate: (value) => (/^https:\/\/vk\.com\/(id\d+|[A-Za-z][A-Za-z0-9_.]{2,31})$/.test(value) ? null : 'Укажите ссылку на страницу или её короткое имя'),
  },
  address: {
    label: 'Адрес',
    placeholder: 'Город, улица, дом',
    inputType: 'text',
    inputmode: 'text',
    autocomplete: 'street-address',
    maxlength: 256,
    normalize: squash,
    validate: (value) => (value.length >= 5 ? null : 'Укажите адрес полностью'),
  },
}

export const contactTypeLabels: Record<string, string> = Object.fromEntries(
  Object.entries(CONTACT_KINDS).map(([key, kind]) => [key, kind.label]),
)

export const CONTACT_TYPE_OPTIONS = optionsFromPairs(Object.entries(contactTypeLabels) as [string, string][])

export function contactKind(type: string): ContactKind | null {
  return (CONTACT_KINDS as Record<string, ContactKind>)[type] ?? null
}

export function normalizeContact(type: string, value: string): string {
  return contactKind(type)?.normalize(value) ?? squash(value)
}

export function contactError(type: string, value: string): string | null {
  const normalized = normalizeContact(type, value)
  if (!normalized) return 'Заполните контакт или уберите его'
  return contactKind(type)?.validate(normalized) ?? null
}

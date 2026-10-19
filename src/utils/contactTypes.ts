import { optionsFromPairs } from '@/utils/selectOptions'

export const contactTypeLabels: Record<string, string> = {
  email: 'Email', phone: 'Телефон', tg: 'Telegram', vk: 'VK', address: 'Адрес',
}

export const CONTACT_TYPE_OPTIONS = optionsFromPairs(Object.entries(contactTypeLabels) as [string, string][])

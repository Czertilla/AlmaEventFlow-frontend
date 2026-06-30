export interface PasswordStrength {
  percent: number
  color: string
  label: string
}

// Единый расчёт сложности пароля и единые требования для регистрации,
// сброса и смены пароля — чтобы критерии нигде не расходились.
export function passwordStrength(p: string): PasswordStrength {
  let score = 0
  if (p.length >= 8) score++
  if (p.length >= 12) score++
  if (/[a-zа-я]/.test(p) && /[A-ZА-Я]/.test(p)) score++
  if (/\d/.test(p)) score++
  if (/[^a-zA-Zа-яА-Я0-9]/.test(p)) score++
  if (score <= 1) return { percent: 20, color: '#FF4757', label: 'Слабый' }
  if (score === 2) return { percent: 45, color: '#FFB800', label: 'Средний' }
  if (score === 3) return { percent: 70, color: '#00BF92', label: 'Хороший' }
  return { percent: 100, color: '#00D9A6', label: 'Надёжный' }
}

export function validatePassword(p: string): string | null {
  if (!p) return 'Введите пароль'
  if (p.length < 8) return 'Минимум 8 символов'
  if (!/\d/.test(p) || !/[a-zA-Zа-яА-Я]/.test(p)) {
    return 'Пароль должен содержать буквы и цифры'
  }
  return null
}

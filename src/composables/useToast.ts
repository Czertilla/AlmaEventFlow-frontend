import { toastController } from '@ionic/vue'
import { apiErrorMessage } from '@/utils/apiErrors'

/**
 * Единая точка показа тостов. Заменяет россыпь `toastController.create(...)`
 * и локальные showError по страницам. Сообщение об ошибке берёт detail из
 * ответа бэкенда (известные коды -- по-русски), иначе — переданный fallback.
 */
export function useToast() {
  async function showSuccess(message: string, duration = 2000) {
    const toast = await toastController.create({ message, duration, color: 'success' })
    toast.present()
  }

  async function showError(err: unknown, fallback: string, duration = 3000) {
    const toast = await toastController.create({ message: apiErrorMessage(err, fallback), duration, color: 'danger' })
    toast.present()
  }

  async function showMessage(message: string, color = 'medium', duration = 3000) {
    const toast = await toastController.create({ message, duration, color })
    toast.present()
  }

  return { showSuccess, showError, showMessage }
}

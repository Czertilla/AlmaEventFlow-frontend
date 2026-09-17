import { alertController } from '@ionic/vue'

/** Глобальное подтверждение действия. Resolve true — пользователь подтвердил.
 * По умолчанию — деструктивное действие («Удалить»); confirmText/confirmRole
 * позволяют переиспользовать ту же модалку для нейтральных действий (например,
 * создания записи), не окрашивая кнопку подтверждения в красный. */
export async function confirmAction(
  header: string,
  message: string,
  confirmText = 'Удалить',
  confirmRole: 'destructive' | 'confirm' = 'destructive',
): Promise<boolean> {
  const alert = await alertController.create({
    header,
    message,
    buttons: [
      { text: 'Отмена', role: 'cancel' },
      { text: confirmText, role: confirmRole },
    ],
  })
  await alert.present()
  const { role } = await alert.onDidDismiss()
  return role === confirmRole
}

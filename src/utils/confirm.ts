import { alertController } from '@ionic/vue'

/** Глобальное подтверждение деструктивного действия. Resolve true — пользователь подтвердил. */
export async function confirmAction(header: string, message: string): Promise<boolean> {
  const alert = await alertController.create({
    header,
    message,
    buttons: [
      { text: 'Отмена', role: 'cancel' },
      { text: 'Удалить', role: 'destructive' },
    ],
  })
  await alert.present()
  const { role } = await alert.onDidDismiss()
  return role === 'destructive'
}

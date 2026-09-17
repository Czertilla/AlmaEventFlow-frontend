// Обновляет адресную строку напрямую через History API, минуя vue-router.
//
// Почему: Ionic'овский <ion-router-outlet> держит отдельный page-stack,
// ключ которого -- буквальный pathname (см. viewStacks.findViewItemByRouteInfo
// в @ionic/vue-router). Даже если /admin/users и /admin/collectives совпадают
// с ОДНОЙ и той же route-записью (`/admin/:pathMatch(.*)*`), для outlet'а это
// две РАЗНЫЕ страницы своего стека -- он создаст новый view-item и прогонит
// вход/выход ion-page на каждый клик, что и даёт «наезд» и мигание при чисто
// внутреннем переключении раздела панели (admin/principal). Единственный
// надёжный способ вообще не запускать эту машинерию -- не отдавать смену
// пути vue-router'у (и, значит, Ionic'у), а обновлять URL в обход обоих.
export function syncAddressBar(path: string) {
  if (window.location.pathname === path) return
  window.history.replaceState(window.history.state, '', path)
}

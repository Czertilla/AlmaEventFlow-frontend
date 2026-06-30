import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router';

import { IonicVue } from '@ionic/vue';

/* Core CSS required for Ionic components to work properly */
import '@ionic/vue/css/core.css';

/* Basic CSS for apps built with Ionic */
import '@ionic/vue/css/normalize.css';
import '@ionic/vue/css/structure.css';
import '@ionic/vue/css/typography.css';

/* Optional CSS utils that can be commented out */
import '@ionic/vue/css/padding.css';
import '@ionic/vue/css/float-elements.css';
import '@ionic/vue/css/text-alignment.css';
import '@ionic/vue/css/text-transformation.css';
import '@ionic/vue/css/flex-utils.css';
import '@ionic/vue/css/display.css';

/**
 * Ionic Dark Mode
 * -----------------------------------------------------
 * For more info, please see:
 * https://ionicframework.com/docs/theming/dark-mode
 */

/* @import '@ionic/vue/css/palettes/dark.always.css'; */
/* @import '@ionic/vue/css/palettes/dark.class.css'; */
import '@ionic/vue/css/palettes/dark.class.css';

/* Theme variables */
import './theme/variables.css';

// Согласуем анимации переходов Ionic с пользовательской настройкой ещё до
// инициализации: 'off' (или системное reduced-motion при 'auto') отключает их.
function resolveAnimated(): boolean {
  try {
    const mode = JSON.parse(localStorage.getItem('animations') ?? '"auto"')
    if (mode === 'on') return true
    if (mode === 'off') return false
  } catch { /* ignore */ }
  return !(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)
}

const pinia = createPinia()
const app = createApp(App)
  .use(IonicVue, { animated: resolveAnimated() })
  .use(pinia)
  .use(router);

router.isReady().then(() => {
  app.mount('#app');
});

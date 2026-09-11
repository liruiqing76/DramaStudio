import { createApp, h } from 'vue'
import './styles/theme.css'
import './composables/useTheme.js'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import { ElConfigProvider } from 'element-plus'
import 'element-plus/dist/index.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import App from './App.vue'
import router from './router'
import i18n from './i18n/index.js'

const app = createApp({
  name: 'RootProvider',
  render() {
    return h(
      ElConfigProvider,
      {
        message: {
          duration: 5000,
          showClose: true,
          offset: 28,
        },
      },
      () => h(App)
    )
  },
})
const pinia = createPinia()

for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.use(pinia)
app.use(router)
app.use(i18n)
app.use(ElementPlus)
app.mount('#app')

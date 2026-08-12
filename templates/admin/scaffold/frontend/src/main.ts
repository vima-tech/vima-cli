import { createApp } from 'vue'
import { createPinia } from 'pinia'
import VimaUiAdmin from '@vima-tech/ui-admin'
import '@vima-tech/ui-admin/style.css'
import './style.css'
import App from './App.vue'
import router from './router'
import { setupAuthDirective } from './directives/auth'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.use(VimaUiAdmin)
setupAuthDirective(app)
app.mount('#app')

/**
 * vima-ui-h5 入口。
 *
 * 组件在 main.ts 里全局注册一次（与 admin 端 `app.use(VimaUiAdmin)` 同款约定），
 * 页面模板直接写 <VmNavbar> / <VmTabbar>，不逐页 import——
 * 逐页 import 会让「哪些是框架能力」变得不可机检。
 */
import type { App } from 'vue'
import VmNavbar from './components/VmNavbar.vue'
import VmTabbar from './components/VmTabbar.vue'
import VmToast from './components/VmToast.vue'
import VmDialog from './components/VmDialog.vue'

export { VmNavbar, VmTabbar, VmToast, VmDialog }
export { toast, confirmAsync } from './feedback'

export default {
  install(app: App) {
    app.component('VmNavbar', VmNavbar)
    app.component('VmTabbar', VmTabbar)
    app.component('VmToast', VmToast)
    app.component('VmDialog', VmDialog)
  },
}

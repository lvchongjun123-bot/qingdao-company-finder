import { createApp } from 'vue'
import { createPinia } from 'pinia'
import AppMobile from './AppMobile.vue'

const app = createApp(AppMobile)
app.use(createPinia())
app.mount('#app')

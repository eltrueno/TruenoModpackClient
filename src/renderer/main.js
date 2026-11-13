import { createApp } from 'vue'
import './tailwind.css'
import App from './App.vue'
import VueLazyload from 'vue-lazyload'

const app = createApp(App);

app.use(VueLazyload)
app.mount('#app')

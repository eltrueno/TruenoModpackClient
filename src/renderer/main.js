import { createApp } from 'vue'
import './tailwind.css'
import App from './App.vue'

const app = createApp(App);

app.config.globalProperties.$status = { isOffline: null };

window.appStatus?.onStatus(({ isOffline }) => {
  app.config.globalProperties.$status.isOffline = isOffline;
});

app.mount('#app')
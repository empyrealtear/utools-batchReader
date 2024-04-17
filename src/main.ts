import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import JsonExcel from "vue-json-excel3"



const app = createApp(App)
app.component("downloadExcel", JsonExcel)
app.use(ElementPlus)
app.mount('#app')


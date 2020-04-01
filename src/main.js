import Vue from 'vue'
import App from './App.vue'
import "leaflet/dist/leaflet.css"

new Vue({
  render: h => h(App),
  dev: {
    port: 8081
  }
}).$mount('#app');

<template>
  <div id="app">
    <Map/>
    <Main/>
  </div>
</template>

<script>
import Main from './components/Main.vue'
import Map from './components/Map.vue'

export default {
  name: 'App',
  components: {
    Main,
    Map
  }
}
</script>

<style>
  body {
    margin: 0;
    font-family: Avenir, Helvetica, Arial, sans-serif;
    color: #111;
    font-size: 12px;
    line-height: 1.35;
    user-select: none;
  }
</style>

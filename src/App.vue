<template>
  <div id="app">
    <el-container>
      <el-main>
        <HomeVue />
      </el-main>
    </el-container>
  </div>
</template>

<script>
import HomeVue from './components/Home.vue';

export default {
  name: 'App',
  components: { HomeVue },
  data() {
    return {

    }
  },
  methods: {

  }
}
</script>

<style scoped></style>

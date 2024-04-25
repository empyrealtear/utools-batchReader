<template>
  <el-container>
    <el-main style="padding: 0px;">
      <HomeVue />
    </el-main>
  </el-container>
</template>

<script lang="ts">
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

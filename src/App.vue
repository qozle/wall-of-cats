<template>
  <div id="app">
    <Title />
    <div class="ml-auto mr-auto" id="nav">
      <router-link to="/">Home</router-link> |
      <router-link to="/about">About</router-link>
    </div>
    <router-view />
  </div>
</template>

<script>
// @ is an alias to /src

import Title from "@/components/Title.vue";

export default {
  name: "app",
  components: {
    Title
  }
};
</script>
<style>
html {
  background-color: #0e0b0e;
}

#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  background-color: #0e0b0e;
}

#nav {
  margin: 30px;
  background-color: #131113;
  width: 110px;
}

#nav a {
  font-weight: bold;
  color: #2c3e50;
}

#nav a.router-link-exact-active {
  color: #42b983;
}
</style>

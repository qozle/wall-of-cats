<template>
  <div class="home">
    <TwittDisplay />
  </div>
</template>

<script>
// @ is an alias to /src
import TwittDisplay from "@/components/TwittDisplay.vue";

export default {
  name: "Home",
  components: {
    TwittDisplay
  }
};
</script>

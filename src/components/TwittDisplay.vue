<template>
  <div class="container-fluid" id="twitt-display">
    <ul class="row mx-auto" id="twitt-row">
      <li v-for="image in images" class="col-4 list-item" :key="image.id">
        <transition name="fade" mode="out-in">
          <img
            :src="image.aUrl"
            v-if="image.aShow"
            class="cat-image"
            :key="image.id + 'a'"
          />
          <img
            :src="image.bUrl"
            v-else
            class="cat-image"
            :key="image.id + 'b'"
          />
        </transition>
      </li>
    </ul>
  </div>
</template>

<script>
export default {
  name: "TwittDisplay",
  data: function() {
    return {
      likes: 0,
      images: [],
      ws: ""
    };
  },
  methods: {},
  mounted: function() {
    var self = this;
    this.ws = new WebSocket("wss://01014.org:3000");
    this.ws.onopen = () => {
      console.log("Now connected");
    };
    
    this.ws.onmessage = event => {
      var data = JSON.parse(event.data);
      switch (data.type) {
        case "update":
          //        console.log(JSON.parse(event.data));
          //        console.log('we got a message: ');
          var newIndex = Math.floor(Math.random() * 9);
          //            console.log(newIndex);
          //            console.log(self.images[newIndex]);
          if (self.images[newIndex].aShow) {
            self.images[newIndex].bUrl = data.data.url;
            self.images[newIndex].aShow = false;
          } else {
            self.images[newIndex].aUrl = data.data.url;
            self.images[newIndex].aShow = true;
          }
          break;
        case "initialData":
          data.data.forEach(function(currentValue, index) {
            self.images.push({
              aShow: true,
              bShow: false,
              aUrl: currentValue,
              bUrl: "",
              id: "image" + String(index)
            });
          });
          console.table(self.images);
          break;
      }
    };
  },
  beforeDestroy: function() {
    this.ws.close();
  }
};
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: 500ms;
}

.fade-enter,
.fade-leave-to {
  opacity: 0;
}

#twitt-row {
  padding: 0;
  max-width: 80%;
}

.cat-image {
  padding: 0;
  height: 200px;
  width: 100%;
}

.list-item {
  list-style-type: none;
  padding: 0;
}

/* EXTRA SMALL DEVICES (PORTRAIT PHONES, <576px)*/
@media (max-width: 575.98px) {
  .cat-image {
    height: 100px;
  }
}

/* SMALL DEVICES (LANDSCAPE PHONES, 576-768PX) */
@media (min-width: 576px) and (max-width: 767.98px) {
  .cat-image {
    height: 150px;
  }
}

/* MEDIUM DEVICES (TABELTS, 768-992px) */
@media (min-width: 768px) and (max-width: 991.98px) {
}

/* LARGE DEVICES (DESKTOPS, 992-1200px) */
@media (min-width: 992px) and (max-width: 1199.98px) {
}

/* EXTRA LARGE DEVICES (LARGE DESKTOPS, >=1200) */
@media (min-width: 1200px) {
  .cat-image {
    height: 225px;
  }
}
</style>

<template>
  <div class="container-fluid" id="twitt-display">
    <ul class="row mx-auto" id="twitt-row">
      <li v-for="tweet in tweets" class="col-4 list-item" :key="tweet.id">
        <transition name="fade" mode="out-in">
          <a
            class="cat-link"
            v-if="tweet.aShow"
            :href="
              `https://twitter.com/${tweet.aTweetName}/status/${tweet.aTweetId}`
            "
            :key="`${tweet.id}linkA`"
            target="_blank"
          >
            <img :src="tweet.aUrl" :key="tweet.id + 'a'" class="cat-image" />
          </a>
          <a
            class="cat-link"
            v-else
            :href="
              `https://twitter.com/${tweet.bTweetName}/status/${tweet.bTweetId}`
            "
            :key="`${tweet.id}linkB`"
            target="_blank"
          >
            <img :src="tweet.bUrl" class="cat-image" :key="tweet.id + 'b'" />
          </a>
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
      tweets: [],
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

    this.ws.onmessage = async (event) => {
      let data = JSON.parse(event.data);
      switch (data.type) {
        case "update":
          //        console.log('we got a message: ');
          var newIndex = Math.floor(Math.random() * 9);
          //            console.log(newIndex);
          //            console.log(self.images[newIndex]);

          if (self.tweets[newIndex].aShow) {
            self.tweets[newIndex].bUrl = data.data.url;
            self.tweets[newIndex].bTweetName = data.data.tweet_name;
            self.tweets[newIndex].bTweetId = data.data.tweet_id;
            self.tweets[newIndex].aShow = false;
          } else {
            self.tweets[newIndex].aUrl = data.data.url;
            self.tweets[newIndex].aTweetName = data.data.tweet_name;
            self.tweets[newIndex].aTweetId = data.data.tweet_id;
            self.tweets[newIndex].aShow = true;
          }
          break;
        case "initialData":
          data.data.forEach(function(tweetInfo, index) {
            self.tweets.push({
              aShow: true,
              bShow: false,
              aUrl: tweetInfo.url,
              aTweetName: tweetInfo.tweet_name,
              aTweetId: tweetInfo.tweet_id,
              bUrl: "",
              bTweetName: "",
              bTWeetId: "",
              id: "image" + String(index)
            });
          });
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
  transition: 500ms;
}

.list-item:hover {
  transform: scale(1.1);
  z-index: 10000000000000;
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

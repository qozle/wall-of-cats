<template>
  <div class="container-fluid about">
    <div class='row'>
      <div class="col-6">
        <p class="cat-paragraph">This is an SPA that interfaces with the twitter API to pull a filtered livestream (of all posts being made, in real time, that mention "cat" || "cats" || "kitty" || "kitten" and don't have mentions and aren't retweets and have images) and display it here [disclaimer: some of these images are def NSFW]. The data is pulled from Twitter and then put into a MYSQL table, and then pushed to the client via a secure web-socket connection. The server is made with Node.JS- the frontend is made with Vue-cli and includes the latest version of Bootstrap.  You can find the code <a href="https://github.com/qozle/wall-of-cats">here on github</a>.
        </p>
      </div>
      <div class="col-6 d-flex">
        <img class="align-self-center img-fluid" src='../assets/cat.jpg' alt="a silly picture of a cute cat">
      </div>
    </div>
</div>
</template>

<script>

</script>

<style scoped>
  a {
   text-decoration: none; 
  }
  
  .cat-paragraph {
    font-size: 1.3em;
    padding-left: 15px;
    padding-right: 15px;
  }

  #about-list {
    font-size: 1.3rem;
  }

  /* EXTRA SMALL DEVICES (PORTRAIT PHONES, <576px)*/
  @media (max-width: 575.98px) {
    .cat-paragraph {
      font-size: 1em;
    }

    #about-list {
      font-size: 1em;
    }
  }

  /* SMALL DEVICES (LANDSCAPE PHONES, 576-768PX) */
  @media (min-width: 576px) and (max-width: 767.98px) {}

  /* MEDIUM DEVICES (TABELTS, 768-992px) */
  @media (min-width: 768px) and (max-width: 991.98px) {}

  /* LARGE DEVICES (DESKTOPS, 992-1200px) */
  @media (min-width: 992px) and (max-width: 1199.98px) {}

  /* EXTRA LARGE DEVICES (LARGE DESKTOPS, >=1200) */
  @media (min-width: 1200px) {}

</style>

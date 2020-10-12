<template>
  <div class="container-fluid about">
    <div class="row">
      <div class="col-6">
        <p class="cat-paragraph">
          This is an SPA that interfaces with the Twitter API to pull posts in realtime that mention "cat" OR "cats" OR "kitty" OR "kitten" AND don't have mentions AND aren't retweets AND have images. These images are then checked with an NSFW image recognition AI model- you may (or may not) be surprised to know that there is a good amount of NSFW tweet content regarding the word "cat".
          <br><br>
          For more info, you can find the code <a href="https://github.com/qozle/wall-of-cats">here on github</a>.
        </p>
      </div>
      <div class="col-6 d-flex">
        <img class="align-self-center img-fluid" src="../assets/cat.jpg" alt="a silly picture of a cute cat" />
      </div>
    </div>
  </div>
</template>

<script></script>

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

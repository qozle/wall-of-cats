<template>
  <div class="container-fluid about">
    <div class="row">
      <div class="col-6">
        <p class="cat-paragraph">
          This is a portfolio project I build that uses a node.js server and interacts with the twitter API to pull a filtered stream of posts concerning cats that have images.  It then uses two AI models to determine if the returned images 1) are safe for work and 2) actually include cats.  It then puts them in a MYSQL database which has a watcher that automatically pushes new entries to the client, which uses Vue and Bootstrap.  
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
    color: silver;
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

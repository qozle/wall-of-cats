const express = require("express");
const app = express();
const https = require("https");
const fs = require("fs");
const WebSocket = require("ws");
const needle = require("needle");
require("dotenv").config();
const tf = require("@tensorflow/tfjs-node");
const cocoSsd = require("@tensorflow-models/coco-ssd");
tf.enableProdMode();
const nsfwjs = require("nsfwjs");
const mysql = require("mysql");
const MySQLEvents = require("@rodrigogs/mysql-events");


//  Here, have some global variables
// Hope you've got a bearer token, bro
const token = process.env.BEARER_TOKEN;
const streamURL = process.env.STREAM_URL
const rulesURL = process.env.RULES_URL
const privKey = process.env.PRIV_KEY
const chainKey = process.env.CHAIN_KEY

// Rules for how to filter the stream of tweets.
const rules = [
  {
    value:
      "(cat OR cats OR kitty OR kitten) has:images -is:quote -is:retweet -has:mentions",
  },
];
const key = fs.readFileSync(
  privKey,
  "utf8"
);
const ca = fs.readFileSync(chainKey, "utf8");
let nsfwModel,
  catModel,
  stream,
  lastData = Date.now(),
  timeout = 0;

// tweetID = 0

//  HTTPS server
const server = https.createServer(
  {
    cert: fs.readFileSync(
      "/etc/letsencrypt/live/01014.org/fullchain.pem",
      "utf8"
    ),
    key: key,
    ca: ca,
  },
  app
);

 //  Simple sleep / delay function for reconnection logic
 const sleep = async (delay) => {
  return new Promise((resolve) => setTimeout(() => resolve(true), delay));
};

//  Reconnection logic (to twitter server)
const reconnect = async () => {
    timeout++;
    try {
      if (stream.request.aborted == false) {
        await stream.request.abort();
        console.log("Stream aborted");
      }
      console.log("Waiting " + 2 ** timeout + " seconds to reconnect...");
      await sleep(2 ** timeout * 1000);
      console.log("Done waiting, trying to reconnect");
      streamConnect();
    } catch (e) {
      console.log(e);
    }
};

// Function to pull whatever rules have already been posted.
const getAllRules = async function() {
  const response = await needle("get", rulesURL, {
    headers: {
      authorization: `Bearer ${token}`,
    },
  }).catch((err) => {
    console.log(err);
  });

  if (response.statusCode !== 200) {
    console.log(response.body);
    throw new Error(response.body);
  }
  console.log("Got all current rules");
  return response.body;
};

// Function to delete all current rules
const deleteAllRules = async function(rules) {
  if (!Array.isArray(rules.data)) {
    return null;
  }
  const ids = rules.data.map((rule) => rule.id);
  const data = {
    delete: {
      ids: ids,
    },
  };
  const response = await needle("post", rulesURL, data, {
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
  }).catch((err) => {
    console.log(err);
  });
  if (response.statusCode !== 200) {
    throw new Error(response.body);
    return null;
  }
  console.log("Cleared all rules");
  return response.body;
};

// Function to set rules
const setRules = async function() {
  const data = {
    add: rules,
  };
  const response = await needle("post", rulesURL, data, {
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
  }).catch((err) => {
    console.log(err);
  });
  if (response.statusCode !== 201) {
    throw new Error(response.body);
    return null;
  }
  console.log("Set all rules for the filtered stream");
  return response.body;
};

//  Setup SQL watcher
const sqlWatcher = async () => {
  const connection = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "193267abC",
    database: "twit",
  });

  const instance = new MySQLEvents(connection, {
    serverId: Math.floor(Math.random() * 1320984),
    startAtEnd: true, // to record only the new binary logs, if set to false
    //  or you didn't provide it, all the events will be console.logged
    //  after you start the app
  });

  await instance
    .start()
    .catch((err) => console.log("something bad happened: \n" + err));

  instance.addTrigger({
    name: "monitor_inserts",
    expression: "twit.*",
    statement: MySQLEvents.STATEMENTS.INSERT,
    onEvent: (e) => {
      if (socketServer.clients.size) {
        socketServer.clients.forEach(function(client) {
          sendOnDbUpdate(e, client);
        });
      }
    },
  });
  instance.on(MySQLEvents.EVENTS.CONNECTION_ERROR, console.error);
  instance.on(MySQLEvents.EVENTS.ZONGJI_ERROR, console.error);
};

//  callback for when there's a DB update
const sendOnDbUpdate = (e, socketClient) => {
  try {
    socketClient.send(
      JSON.stringify({
        type: "update",
        data: e.affectedRows[0].after,
      })
    );
  } catch (err) {
    console.log(err);
  }
  console.log(
    "SQL watcher noticed a change in the database...pushed to client."
  );
};

//  Clear the database of everything older than 3m, check that data is still
//  coming from the twitter API because sometimes it randomly stops but keeps
//  the connection open?
const checkup = function() {
  let clearDbSQL =
    "DELETE FROM cats WHERE date < (DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 3 MINUTE))";
  pool.query(clearDbSQL, function(err) {
    if (err) throw err;
    console.log(
      "Everything older than 3 mins has been cleared from the DB\n"
    );
  });
  //  If we haven't gotten any cat images in 3 minutes, the connection is being
  //  weird, so let's just reconnect because that fixes everything right.
  if (lastData.getTime() < Date.now() - 180000) {
    console.log(`Hey we haven't gotten any images in like two minutes so
          I'm just gonna reconnect`);
    reconnect();
  }
};

//  Function for throttling the connection.  If there have been > 170 tweets in a 15m
//  period, then it kills the connection to the twitter API and reconnects after a minute.
//   const tweetOverflow = function() {
//     let amntOfTweets = 0;
//     let now = new Date().getTime();
//     tweetTimes.forEach((tweet, i) => {
//       if (tweet.time.getTime() < now - 60000) {
//         tweetTimes.splice(i, 1);
//       }
//     });
//     if (tweetTimes.length >= 11) {
//       return true;
//     } else {
//       return false;
//     }
//   };

//  Function to check the catModel results for cats
const areThereCats = function(results) {
  for (let i = 0; i < results.length; i++) {
    if (results[i].class == "cat" && results[i].score > 0.75) {
      console.log("we got a cat!");
      return true;
    }
  }
};

// Create a pool to draw connections from
let pool = mysql.createPool({
  connectionLimit: 25,
  host: "localhost",
  user: "jeme",
  password: "193267abC",
  database: "twit", // secure this by putting it in .env???  or is that less secure...
});

// Function to connect to the stream and parse data
// This could probably be refactored and made a bit more neat
const streamConnect = function() {
  stream = needle.get(streamURL, {
    headers: {
      Authorization: `Bearer ${token}`,
      compressed: true,
    },
  });

  stream.on("data", async (data) => {
    console.log("\ndata received from the twitter server:");
    //  The twitter API sends three kinds of messages:
    //  1) Tweets / Tweet data (in accordance to the rules set),
    //  2) Keep alive signals (in the form of "\r\n"),
    //  3) Error messages.
    //  Watch out for the keep alive signal
    try {
      //  If it's a keep alive signal, just say so.
      if (data.toString() == "\r\n") {
        console.log(
          "I just wanetd to tell you, we just got a keep-alive signal\n"
        );

        //  If it's null or an empty string, just say so
      } else if (data.toString() == "" || data == null) {
        console.log("Got '' or null ???\n");

        //  If there's a connection issue, reconnect
        //  This only picks up connection issues, I think.  Should be
        //  more broad than this.
      } else if (data.connection_issue) {
        console.log("There was a connection issue sent from twitter:\n");
        console.log(data.toString());
        console.log(data);
        reconnect();
      } else if (JSON.parse(data).errors) {
        console.log(JSON.parse(data));

        //  If there's media data, put it in the DB
      } else if (socketServer.clients.size > 0 && JSON.parse(data).includes) {
        lastData = new Date();
        let json = JSON.parse(data);
        // tweetID++;
        // tweetTimes.push({ id: tweetID + 1, time: new Date() });
        // console.log(`flow: ${tweetTimes.length}`);
        // tweetOverflow();
        needle("get", json.includes.media[0].url)
          .then(async (resp) => {
            //  This could be passed to a new thread ??
            const image = await tf.node.decodeImage(resp.body, 3);
            const predictions = await nsfwModel.classify(image);
            const catObjects = await catModel.detect(image);
            image.dispose();
            //  Check that the image isn't NSFW and has a cat in it
            if (
              predictions[0].className != "Hentai" &&
              predictions[0].className != "Porn" &&
              predictions[0].className != "Sexy" &&
              areThereCats(catObjects)
            ) {
              var sqlUpdate =
                "INSERT INTO cats (media_key, type, url) VALUES (?,?,?)";
              var valuesUpdate = [
                [json.includes.media[0].media_key],
                [json.includes.media[0].type],
                [json.includes.media[0].url],
              ];

              pool.query(sqlUpdate, valuesUpdate, (err, result) => {
                if (err) {
                  console.log(
                    "There was an error with the MYSQL connection: \n"
                  );
                  console.log(err);
                }
                console.log("Data inserted into database.");
              });
            } else {
              console.log(
                "Tweet is not safe for work or doesn't have a cat in it"
              );
            }
          })
          .catch((err) => {
            console.log("The nuclear codes have been leaked!: \n");
            console.log(err);
          });
      }
      //  This is some old throttling logic that is mostly unecessary
      // else if (tweetOverflow()) {
      //   console.log(
      //     `Amount of tweets we got in the last minute is ${tweetTimes.length}, waiting 10s and then reconnecting`
      //   );
      //   stream.request.abort();
      //   console.log("stream aborted");
      //   setTimeout(reconnect, 10000);
      // }
    } catch (err) {
      console.log("I have a bad feeling about this...");
      console.log(err);
      console.log(data.toString());
    }
  });

  stream.on("timeout", () => {
    // Reconnect on error
    console.warn("A connection error occurred. Reconnecting…");
    reconnect();
  });
  //  After the header has been processed, just before data is to
  //  be consumed.  I.E., got a "valid" response.
  stream.on("header", (code) => {
    if (code == 200) {
      console.log("Connected to the twitter server.");
      timeout = 0;
    }
    if (code == 429) {
      console.log("Twitter gave us the ol' 429");
      reconnect();
    }
  });

  stream.on("err", (err) => {
    console.log("There was an error:\n");
    console.log(err);
  });

  // return stream;
};

//  Make a new socket connection
const socketServer = new WebSocket.Server({
  clientTracking: 1,
  server: server,
  rejectUnauthorized: false,
});

//  Socket events
socketServer.on("connection", (socketClient) => {
  let checkupInterval;
  console.log("Client connected");
  console.log("client Set length: ", socketServer.clients.size);
  if (socketServer.clients.size == 1) {
    //  Every 3 minutes, delete everything older than 3 minutes.
    checkupInterval = setInterval(checkup, 180000);
    //  Open up the first connection
    streamConnect();
  }
  //  Send the initial data over to populate the grid
  var initialData = [];
  var sql = "SELECT url FROM cats limit 0,9";
  pool.query(sql, function(err, result) {
    if (err) {
      console.log("Error at socketServer.on 'connection': \n");
      console.log(err);
    }
    console.log("Initial data sent");
    result.forEach(function(value, index, array) {
      initialData.push(array[index].url);
    });
    //    console.log(result);
    console.log(initialData);
    socketClient.send(
      JSON.stringify({
        type: "initialData",
        data: initialData,
      })
    );
  });

  //  When the client closes the connection
  socketClient.on("close", (socketClient) => {
    console.log("A client closed their connection");
    console.log("Number of clients: ", socketServer.clients.size);
    if (socketServer.clients.size == 0) {
      stream.request.abort();
      console.log("No users, stream aborted");
      clearInterval(checkupInterval);
      console.log("No users, checkup interval cleared");
    }
  });
});

//  Get, clear, set twitter filter rules, load AI models, startup the SQL watcher
const main = async () => {
  try {
    let currentRules;
    // Gets the complete list of rules currently applied to the stream
    currentRules = await getAllRules();
    // Delete all rules so we don't have overlaps.
    await deleteAllRules(currentRules);
    // Add rules to the stream.
    await setRules();

    //  Load the model once on init
    nsfwjs
      .load("file://model/", {
        size: 299,
      })
      .then(function(theModel) {
        nsfwModel = theModel;
        console.log("NSFW model loaded");
      });
    try {
      // const handler = tfn.io.fileSystem(cocoSSD)
      // let url = "https://storage.googleapis.com/tfjs-models/savedmodel/mobilenet_v2_1.0_224/model.json"
      // catModel = await tf.loadGraphModel(url)
      catModel = await cocoSsd.load();
      console.log("cocoSSD model loaded");
    } catch (err) {
      console.log("The cocoSSD model didn't load =(...");
      console.log(err);
    }

    //  Load the SQL watcher on init
    sqlWatcher()
      .then(() => {
        console.log("SQL Watcher started");
      })
      .catch(console.error);
  } catch (err) {
    console.log(err);
  }
};

//  Port 3000, so that apache2 can redirect traffic to this server
//  If you want to set up this server on your local dev env,
//  prolly should put localhost here.  TLS info at top.
server.listen(3000, "01014.org", () => {
  console.log("server running");
});
//  Start the show
main();

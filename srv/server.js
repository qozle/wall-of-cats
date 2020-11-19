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
const token = process.env.BEARER_TOKEN;
const streamURL = process.env.STREAM_URL;
const rulesURL = process.env.RULES_URL;
const key = fs.readFileSync(process.env.PRIV_KEY, "utf8");
const ca = fs.readFileSync(process.env.CHAIN_KEY, "utf8");
const cert = fs.readFileSync(process.env.CERT_KEY, "utf8");

// Rules for how to filter the stream of tweets.
const rules = [
  {
    value:
      "(cat OR cats OR kitty OR kitten) has:images -is:quote -is:retweet -has:mentions"
  }
];
let nsfwModel,
  catModel,
  stream = null,
  lastData = new Date(),
  timeout = 0,
  reconnecting = false,
  checkupInterval,
  connection,
  instance;

//  HTTPS server
const server = https.createServer({ cert: cert, key: key, ca: ca }, app);

//  Sleep / delay function for reconnection logic
const sleep = async (delay) => {
  return new Promise((resolve) => setTimeout(() => resolve(true), delay));
};

// Function to pull whatever rules have already been posted.
const getAllRules = async function() {
  const response = await needle("get", rulesURL, {
    headers: {
      authorization: `Bearer ${token}`
    }
  }).catch((err) => {
    console.log(err);
  });
  if (response.statusCode !== 200) {
    console.log(response.body);
    throw new Error(response.body);
  }
  return response.body;
};

// Function to delete all current rules
const deleteAllRules = async function(rules) {
  if (!Array.isArray(rules.data)) {
    return null;
  }
  const ids = rules.data.map((rule) => rule.id);
  const data = { delete: { ids: ids } };
  const response = await needle("post", rulesURL, data, {
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`
    }
  }).catch((err) => {
    console.log(err);
  });
  if (response.statusCode !== 200) {
    throw new Error(response.body);
  }
  return response.body;
};

// Function to set rules
const setRules = async function() {
  const data = {
    add: rules
  };
  const response = await needle("post", rulesURL, data, {
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`
    }
  }).catch((err) => {
    console.log(err);
  });
  if (response.statusCode !== 201) {
    throw new Error(response.body);
  }
  return response.body;
};

//  Setup SQL watcher
const sqlWatcher = async () => {
  connection = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "193267abC",
    database: "twit"
  });

  instance = new MySQLEvents(connection, {
    serverId: Math.floor(Math.random() * 1320984),
    startAtEnd: true // to record only the new binary logs, if set to false
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
    }
  });
  instance.on(MySQLEvents.EVENTS.CONNECTION_ERROR, (error) => {
    console.log(error);
    console.log("SQL watcher conneciton died, reconnecting...");
    connection = null;
    instance = null;
    sqlWatcher().then(() => {
      console.log("SQL watcher reestablished!");
    });
  });
  instance.on(MySQLEvents.EVENTS.ZONGJI_ERROR, console.error);
};

//  Callback for when there's a DB update
const sendOnDbUpdate = (e, socketClient) => {
  try {
    socketClient.send(
      JSON.stringify({
        type: "update",
        data: e.affectedRows[0].after
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
    "DELETE FROM cats WHERE date > (SELECT MAX(m.date) FROM (SELECT date FROM cats ORDER BY date LIMIT 100) m);";
  pool.query(clearDbSQL, function(err) {
    if (err) throw err;
    console.log("Database tidied up\n");
  });
  //  If we haven't gotten any cat images in 3 minutes, the connection is being
  //  weird, so let's just reconnect because that fixes everything right.
  if (stream != null && lastData.getTime() < Date.now() - 180000) {
    console.log(`Connection to twitter servers stale, reconnecting`);
    reconnect();
  }
};

//  Reconnection logic (to twitter server)
const reconnect = async () => {
  if (!reconnecting) {
    reconnecting = true;
    timeout++;
    try {
      if (stream.request.aborted == false) {
        await stream.request.abort();
        console.log("Stream aborted");
      }
      console.log("Waiting " + 4 ** timeout + " seconds to reconnect...");
      await sleep(4 ** timeout * 1000);
      console.log("Done waiting, trying to reconnect");
      stream = streamConnect();
      reconnecting = false;
    } catch (e) {
      console.log(e);
    }
  }
};

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
  database: "twit" // secure this by putting it in .env???  or is that less secure...
});

// Function to connect to the stream and parse data
// This could probably be refactored and made a bit more neat
const streamConnect = function() {
  stream = needle.get(streamURL, {
    headers: {
      Authorization: `Bearer ${token}`,
      compressed: true
    }
  });

  stream.on("data", async (data) => {
    console.log("\ndata received from the twitter server");
    //  Watch out for the keep alive signal
    try {
      //  If it's a keep alive signal, just say so.
      if (data.toString() == "\r\n") {
        console.log("*heartbeat*\n");
        //  If it's null or an empty string, just say so
      } else if (data.toString() == "" || data == null) {
        console.log("Got '' or null\n");
        //  If there's an error sent from twitter
      } else if (data.connection_issue) {
        console.log("There was a connection issue sent from twitter:\n");
        console.log(data);
        reconnect();
        //  or maybe this one will work ???
      } else if (JSON.parse(data).errors) {
        console.log(JSON.parse(data));
        //  If there's media data, put it in the DB
      } else if (JSON.parse(data).includes) {
        lastData = new Date();
        let media = JSON.parse(data).includes.media[0];
        needle("get", media.url).then(async (resp) => {
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
            var sqlInsert =
              "INSERT INTO cats (media_key, type, url) VALUES (?,?,?)";
            var valuesInsert = [[media.media_key], [media.type], [media.url]];
            pool.query(sqlInsert, valuesInsert, (err) => {
              if (err) {
                console.log("Data not inserted, error:");
                console.log(err);
              } else {
                console.log("Data inserted into database.");
              }
            });
          } else {
            console.log("Tweet doesn't pass tests");
          }
        });
      } else {
        console.log("Unexpected data:");
        console.log(data);
        console.log(data.toString());
        console.log(JSON.parse(data));
      }
    } catch (err) {
      console.log("Data parsing error:");
      console.log(err);
      console.log(data.toString());
    }
  });
  stream.on("timeout", () => {
    // Reconnect on error
    console.warn("A connection error occurred. Reconnecting…");
    reconnect();
  });
  stream.on("header", (code) => {
    if (code == 200) {
      console.log("Connected to the twitter server.");
      reconnecting = false;
      timeout = 0;
    }
    if (code == 429) {
      console.log("Twitter gave us the ol' code 429");
      reconnect();
    }
  });
  stream.on("err", (err) => {
    console.log("There was an error:\n");
    console.log(err);
  });

  return stream;
};

//  Make the socket server
const socketServer = new WebSocket.Server({
  clientTracking: 1,
  server: server,
  rejectUnauthorized: false
});

//  Socket events
socketServer.on("connection", (socketClient) => {
  console.log(`Client connected at ${new Date()}`);
  console.log("client Set length: ", socketServer.clients.size);
  if (socketServer.clients.size == 1) {
    checkupInterval = setInterval(checkup, 180000);
    if (!reconnecting) {
      stream = streamConnect();
    }
  }
  var initialData = [];
  var sql = "SELECT url FROM cats ORDER BY id DESC limit 0,9";
  pool.query(sql, function(err, result) {
    if (err) {
      console.log("Error at socketServer.on 'connection': \n");
      console.log(err);
    }
    console.log("Initial data sent");
    result.forEach(function(value, index, array) {
      initialData.push(array[index].url);
    });
    socketClient.send(
      JSON.stringify({
        type: "initialData",
        data: initialData
      })
    );
  });

  //  When the client closes the connection
  socketClient.on("close", () => {
    console.log("A client closed their connection");
    console.log("Number of clients: ", socketServer.clients.size);
    if (socketServer.clients.size == 0) {
      stream.request.abort();
      stream = null;
      console.log("No users, stream aborted");
      clearInterval(checkupInterval);
      console.log("No users, checkup interval cleared");
    }
  });
});

//  Preload, start the server
(async () => {
  // Gets the complete list of rules currently applied to the stream
  let p1 = getAllRules();
  let p2 = deleteAllRules(p1);
  let p3 = setRules();
  let p4 = nsfwjs
    .load("file://model/", { size: 299 })
    .then((theModel) => (nsfwModel = theModel));
  let p5 = cocoSsd.load().then((felineModel) => (catModel = felineModel));

  //  Load the SQL watcher on init
  let p6 = sqlWatcher();

  Promise.all([p1, p2, p3, p4, p5, p6])
    .then(() => {
      console.log("Rules set, models loaded");
      server.listen(3000, "01014.org", () => {
        console.log("server running");
      });
    })
    .catch((err) => {
      console.log("There was a problem in the preload");
      console.throw(err);
    });
})();

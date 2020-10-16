const express = require('express');
const history = require('connect-history-api-fallback');
const app = express();
const cors = require('cors');
const https = require('https');
const fs = require('fs');
const WebSocket = require('ws');
const path = require('path');
const needle = require('needle');
require('dotenv').config();
const nsfwjs = require('nsfwjs');
const tf = require('@tensorflow/tfjs-node');
tf.enableProdMode();
const mysql = require('mysql');
const MySQLEvents = require('@rodrigogs/mysql-events');
// Hope you've got a bearer token, bro
const token = process.env.BEARER_TOKEN;
const rulesURL = 'https://api.twitter.com/2/tweets/search/stream/rules'
const streamURL = 'https://api.twitter.com/2/tweets/search/stream?media.fields=url,type,media_key&expansions=attachments.media_keys';


// Rules for how to filter the stream of tweets.
const rules = [
  {
    'value': '(cat OR cats OR kitty OR kitten) has:images -is:quote -is:retweet -has:mentions'
  }
  ];

var timeout = 0;
var model;

//  That SSL tho
const server = https.createServer({
  cert: fs.readFileSync('/etc/letsencrypt/live/01014.org/fullchain.pem', 'utf8'),
  key: fs.readFileSync('/etc/letsencrypt/live/01014.org/privkey.pem', 'utf8'),
  ca: fs.readFileSync('/etc/letsencrypt/live/01014.org/chain.pem', 'utf8')
}, app);

//  Simple sleep / delay function for reconnection logic
const sleep = async (delay) => {
  return new Promise((resolve) => setTimeout(() => resolve(true), delay));
};


//  Reconnection logic (to twitter server) 
const reconnect = async (stream) => {
  timeout++;
  try {
    await stream.request.abort()
    console.log("Stream aborted")
    console.log("Waiting " + (2 ** timeout) + " seconds to reconnect...")
    await sleep((2 ** timeout) * 1000)
    console.log("Done waiting, trying to reconnect")
    streamConnect();

  } catch (e) {
    console.log(e)
  }
};


// Function to pull whatever rules have already been posted.  
async function getAllRules() {
  const response = await needle('get', rulesURL, {
    headers: {
      "authorization": `Bearer ${token}`
    }
  }).catch(err => {
    console.log(err)
  })

  if (response.statusCode !== 200) {
    throw new Error(response.body);
    return null;
  }
  console.log("Got all current rules")
  return (response.body);
}


// Function to delete all current rules
async function deleteAllRules(rules) {
  if (!Array.isArray(rules.data)) {
    return null;
  }
  const ids = rules.data.map(rule => rule.id);
  const data = {
    "delete": {
      "ids": ids
    }
  }
  const response = await needle('post', rulesURL, data, {
    headers: {
      "content-type": "application/json",
      "authorization": `Bearer ${token}`
    }
  }).catch(err => {
    console.log(err)
  })
  if (response.statusCode !== 200) {
    throw new Error(response.body);
    return null;
  }
  console.log("Cleared all rules")
  return (response.body);
}


// Function to set rules
async function setRules() {
  const data = {
    "add": rules
  }
  const response = await needle('post', rulesURL, data, {
    headers: {
      "content-type": "application/json",
      "authorization": `Bearer ${token}`
    }
  }).catch(err => {
    console.log(err)
  })
  if (response.statusCode !== 201) {
    throw new Error(response.body);
    return null;
  }
  console.log("Set all rules for the filtered stream")
  return (response.body);

}


// Function to connect the stream
function streamConnect() {
  const stream = needle.get(streamURL, {
    headers: {
      Authorization: `Bearer ${token}`,
      compressed: true
    }
  });

  stream.on('data', async data => {
    //  The twitter API sends three kinds of messages: 
    //  1) Tweets / Tweet data (in accordance to the rules set),
    //  2) Keep alive signals (in the form of "\r\n"),
    //  3) Error messages.
    //  Watch out for the keep alive signal
    try {

      //  If it's a keep alive signal, just say so.
      if (data.toString() == '\r\n') {
        console.log("\nHey bro, I just wanetd to tell you, we just got a keep-alive signal\n" + new Date + "\n")
        //  If it's null or an empty string, just say so
      } else if (data.toString() == '' || data == null) {
        console.log("Looks like we got something we can't parse, oh well")
        //  If there's a connection issue, reconnect
        //  This only picks up connection issues, I think.  Should be
        //  more broad than this.
      } else if (data.connection_issue) {
        console.log("There was a connection issue sent from twitter:\n")
        console.log(data.toString());
        console.log(data);
        reconnect(stream);
        //  If there's media data, put it in the DB
      } else if (JSON.parse(data).includes) {
        var json = JSON.parse(data)
        needle('get', json.includes.media[0].url).then(async resp => {
          //  This should probably be passed to a new thread or something
          //  I read in the twitter dev documents that stuff shouldn't
          //  be processed right as it received like this because
          //  it could lead to an overload of tweets and a disconnect or 
          //  error ???
          const image = await tf.node.decodeImage(resp.body, 3)
          const predictions = await model.classify(image);
          image.dispose();
          //  Check the image with the NSFW AI
          if (predictions[0].className != "Hentai" && predictions[0].className != "Porn" && predictions[0].className != "Sexy") {
            var sqlUpdate = "INSERT INTO cats (media_key, type, url) VALUES (?,?,?)";
            var valuesUpdate = [[json.includes.media[0].media_key], [json.includes.media[0].type], [json.includes.media[0].url]];
            pool.query(sqlUpdate, valuesUpdate, function (err, result) {
              if (err) {
                console.log("There was an error with the MYSQL connection: \n")
                console.log(err)
              }
              console.log("Data inserted into database.  Bro.");
            });
          }
        }).catch(err => {
          console.log("There was an error with the get request to the twitter server: \n");
          console.log(err)
        })
      }
    } catch (err) {
      console.log("hello from line 194")
      console.log(err)
      console.log(data)
      console.log(data.toString())
    }
  })

  stream.on('timeout', () => {
    // Reconnect on error
    console.warn('A connection error occurred. Reconnecting…');
    reconnect(stream)
  })
  //  After the header has been process, just before data is to
  //  be consumed.  I.E., got a "valid" response.
  stream.on('header', (code) => {
    if (code == 200) {
      console.log('Connected to the twitter server.')
      timeout = 0;
    }
    if (code == 429) {
      console.log("Got code 429 as a response")
      reconnect(stream);
    }
  })

  stream.on("err", (err) => {
    console.log("There was an error:\n")
    console.log(err)
  })

  stream.on("done", err => {
    if (err) console.log("we had an error:\n\r" + err.message);
    console.log("Stream closed for some reason, let's reconnect")
    reconnect(stream)
  })
  return stream;
}


// Create a pool to draw connections from
var pool = mysql.createPool({
  connectionLimit: 25,
  host: "localhost",
  user: "jeme",
  password: "193267abC",
  database: "twit" // secure this by putting it in .env???  or is that less secure...
});

//  Connect the root user to the database to watch for updates 
const sqlWatcher = async () => {
  const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '193267abC',
    database: 'twit'
  });

  const instance = new MySQLEvents(connection, {
    serverId: Math.floor(Math.random() * 1320984),
    startAtEnd: true // to record only the new binary logs, if set to false or you didn't provide it, all the events will be console.logged after you start the app
  });

  await instance.start()
    .catch(err => console.log('something bad happened: \n' + err));

  instance.addTrigger({
    name: 'monitor_inserts',
    expression: 'twit.*',
    statement: MySQLEvents.STATEMENTS.INSERT,
    onEvent: e => {
      if (socketServer.clients.size) {
        socketServer.clients.forEach(function (client) {
          sendOnDbUpdate(e, client);
        });
      }
    }
  });
  instance.on(MySQLEvents.EVENTS.CONNECTION_ERROR, console.error);
  instance.on(MySQLEvents.EVENTS.ZONGJI_ERROR, console.error);
};


//  callback for when there's a DB update
const sendOnDbUpdate = (e, socketClient) => {
  try {
    socketClient.send(JSON.stringify({
      type: 'update',
      data: e.affectedRows[0].after
    }));

  } catch (err) {
    console.log(err);
  }
  console.log('SQL watcher noticed a change in the database...pushed to client.');
}


const clearDbTable = function () {
  let clearDbSQL = 'DELETE FROM cats WHERE date < (DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 3 MINUTE))';
  pool.query(clearDbSQL, function (err) {
    if (err) throw err;
    console.log('Everything older than 3 mins has been cleared from the DB\n')
  });
}


const socketServer = new WebSocket.Server({
  clientTracking: 1,
  server: server,
  rejectUnauthorized: false
});


socketServer.on('connection', (socketClient) => {
  //  console.log(socketServer.clients);
  //  Send the initial data over to populate the grid
  var initialData = [];
  var sql = 'SELECT url FROM cats limit 0,9';
  pool.query(sql, function (err, result) {
    if (err) {
      console.log("Error at socketServer.on 'connection': \n")
      console.log(err)
    };
    console.log("Initial data sent");
    result.forEach(function (value, index, array) {
      initialData.push(array[index].url);
    })
    //    console.log(result);
    console.log(initialData);
    socketClient.send(JSON.stringify({
      type: 'initialData',
      data: initialData
    }));
  });
  console.log('connected');
  console.log('client Set length: ', socketServer.clients.size);

  //  When the client closes the connection
  socketClient.on('close', (socketClient) => {
    console.log('A client closed their connection');
    console.log('Number of clients: ', socketServer.clients.size);
  });
});



//  Put it all into action
(async () => {
  try {
    let currentRules;
    // Gets the complete list of rules currently applied to the stream
    currentRules = await getAllRules();
    // Delete all rules so we don't have overlaps, in case. Comment the line below if you want to keep your existing rules.
    await deleteAllRules(currentRules);
    // Add rules to the stream. Comment the line below if you don't want to add new rules.
    await setRules();

    //  Load the model once on init
    nsfwjs.load("file://model/", {
      size: 299
    }).then(function (theModel) {
      model = theModel
    })
    //  Load the SQL watcher on init
    sqlWatcher().then(() => {
        console.log("SQL Watcher started")
      })
      .catch(console.error);

    //  Every 3 minutes, delete everything older than 3 minutes.
    const clearDbTableInterval = setInterval(clearDbTable, 180000);

    //  Open up the first connection
    streamConnect();

  } catch (err) {
    console.log(err)
  }
})();


//  Serve all necessary static files from subdirectories- this could refined / specified to enhance security
app.use('/wall-of-cats/', express.static(path.join(__dirname, '../wall-of-cats/index.html')));

app.use(cors());

//  Port 3000, so that apache2 can redirect traffic to this server
//  If you want to set up this server on your local dev env, 
//  prolly should put localhost here.  TLS info at top.
server.listen(3000, '01014.org', () => {
  console.log('server running')
});

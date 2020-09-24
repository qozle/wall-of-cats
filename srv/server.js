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
const mysql = require('mysql');
const MySQLEvents = require('@rodrigogs/mysql-events');
// Hope you've got a bearer token, bro
const token = process.env.BEARER_TOKEN;
const rulesURL = 'https://api.twitter.com/2/tweets/search/stream/rules'
const streamURL = 'https://api.twitter.com/2/tweets/search/stream?media.fields=url,type,media_key&expansions=attachments.media_keys';


// Edit rules as desired here below
const rules = [
  {
    'value': '(cat OR cats OR kitty OR kitten) has:images -is:quote -is:retweet -has:mentions'
  }
  ];


// Function to get all rules
async function getAllRules() {
  try {
    const response = await needle('get', rulesURL, {
      headers: {
        "authorization": `Bearer ${token}`
      }
    })

    if (response.statusCode !== 200) {
      throw new Error(response.body);
      return null;
    }

    return (response.body);
  } catch (e) {
    console.log(e);
    process.exit(-1);
  }
}


// Function to delete all rules
async function deleteAllRules(rules) {
  try {

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
    })
    if (response.statusCode !== 200) {
      throw new Error(response.body);
      return null;
    }
    return (response.body);
  } catch (e) {
    console.log(e)
    process.exit(-1)
  }

}


// Function to set rules
async function setRules() {
  try {

    const data = {
      "add": rules
    }
    const response = await needle('post', rulesURL, data, {
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${token}`
      }
    })
    if (response.statusCode !== 201) {
      throw new Error(response.body);
      return null;
    }
    return (response.body);
  } catch (e) {
    console.log(e)
    process.exit(-1)
  }
}


// Function to connect the stream
function streamConnect() {
  //Listen to the stream
  const options = {
    timeout: 20000,
    compressed: true
  }

  const stream = needle.get(streamURL, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  }, options);

  stream.on('data', data => {
    try {
      //      console.log(data.toString());
      if (data.toString() == '\r\n') {
        console.log("Hey bro, I just wanetd to tell you, we just got a keep-alive signal in the form of a carriage return: '\r\n")
      } else if (JSON.parse(data).includes) {
        const json = JSON.parse(data);
        var sqlUpdate = "INSERT INTO cats (media_key, type, url) VALUES (?,?,?)";
        var valuesUpdate = [[json.includes.media[0].media_key], [json.includes.media[0].type], [json.includes.media[0].url]];
        pool.query(sqlUpdate, valuesUpdate, function (err, result) {
          if (err) throw err;
          console.log("Data inserted into database.  Bro.");
        });

      } else if (JSON.parse(data).error) {
        console.log("Bro, we've got an error here, bro:")
        console.log(JSON.parse(data).error)
      }
    } catch (e) {
      // Keep alive signal received. Do nothing.
      console.log(e)
    }
  }).on('error', error => {
    if (error.code === 'ETIMEDOUT') {
      stream.emit('timeout');
    }
    console.log(error)
  });

  return stream;

}

//  Put it all into action, connect the API strea, start pushing data
//  into the mysql database
(async () => {
  let currentRules;

  try {
    // Gets the complete list of rules currently applied to the stream
    currentRules = await getAllRules();

    // Delete all rules. Comment the line below if you want to keep your existing rules.
    await deleteAllRules(currentRules);

    // Add rules to the stream. Comment the line below if you don't want to add new rules.
    await setRules();

  } catch (e) {
    console.error(e);
    process.exit(-1);
  }

  // Listen to the stream.
  // This reconnection logic will attempt to reconnect when a disconnection is detected.
  // To avoid rate limites, this logic implements exponential backoff, so the wait time
  // will increase if the client cannot reconnect to the stream.

  const filteredStream = streamConnect()
  let timeout = 0;
  filteredStream.on('timeout', () => {
    // Reconnect on error
    console.warn('A connection error occurred. Reconnecting…');
    console.log('hey, we timed out from the Twitter servers, bro');
    setTimeout(() => {
      timeout++;
      streamConnect(token);
    }, 2 ** timeout);
    streamConnect(token);
  })
  filteredStream.on('header', () => {
    console.log('Bro, we connected to the twitter servers, bro.')
  })

})();

// Open a connection pool to the MYSQL db
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
    startAtEnd: true // to record only the new binary logs, if set to false or you didn'y provide it all the events will be console.logged after you start the app
  });

  await instance.start()
    .catch(err => console.error('something bad happened', err));

  instance.addTrigger({
    name: 'monitor_inserts',
    expression: 'twit.*', // listen to TEST database !!!
    statement: MySQLEvents.STATEMENTS.INSERT, // you can choose only insert for example MySQLEvents.STATEMENTS.INSERT, but here we are choosing everything
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

sqlWatcher()
  .then(console.log('SQL Watcher started'))
  .catch(console.error);

//  callback for when there's a DB update
const sendOnDbUpdate = (e, socketClient) => {
  try {
    //              console.log(JSON.stringify(e.affectedRows[0].after))
    socketClient.send(JSON.stringify({
      type: 'update',
      data: e.affectedRows[0].after
    }));

  } catch (e) {
    console.log(e);
  }
  console.log('Bro, the SQL watcher noticed a change in the database and pushed it to the client dude.');
}

const clearDbTable = function () {
  let clearDbSQL = 'DELETE FROM cats WHERE date < (DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 3 MINUTE))';
  pool.query(clearDbSQL, function (err) {
    if (err) throw err;
    console.log('Bro.  I cleaned out everything older than 3 minutes ago <3')
  });
}

const clearDbTableInterval = setInterval(clearDbTable, 180000);

const server = https.createServer({
  cert: fs.readFileSync('/etc/letsencrypt/live/01014.org/fullchain.pem', 'utf8'),
  key: fs.readFileSync('/etc/letsencrypt/live/01014.org/privkey.pem', 'utf8'),
  ca: fs.readFileSync('/etc/letsencrypt/live/01014.org/chain.pem', 'utf8')
}, app);

//app.use(history({
//  disableDotRule: true,
//  verbose: true,
//  logger: console.log.bind(console),
//  index: '/wall-of-cats/index.html'
//
//}));
//  Serve all necessary static files from subdirectories- this could refined / specified to enhance security
app.use('/wall-of-cats/', express.static(path.join(__dirname, '../wall-of-cats/index.html')));

//app.get('/wall-of-cats/index.html', (req, res) =>{
//  console.log(req);
//  res.send("Hey, you wanted the index.html file right?")
//})

app.use(cors());






//  Port 3000, so that apache2 can redirect trafic to this server instead of serving content from the apache server.
server.listen(3000, '01014.org', () => {
  console.log('server running')
});

const socketServer = new WebSocket.Server({
  clientTracking: 1,
  server: server,
  rejectUnauthorized: false
});



//console.log(socketServer.clients);
socketServer.on('connection', (socketClient) => {
  //  console.log(socketServer.clients);
  //  Send the initial data over to populate the grid
  var initialData = [];
  var sql = 'SELECT url FROM cats limit 0,9';
  pool.query(sql, function (err, result) {
    if (err) throw err;
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
    //        instance.stop()
    console.log('closed');
    console.log('Number of clients: ', socketServer.clients.size);
  });
});

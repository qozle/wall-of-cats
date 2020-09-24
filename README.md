# twit

You can visit the live version at https://01014.org/wall-of-cats

## Project setup
```
npm install
```
You'll also need to setup a MYSQL database.  Table structure is:
```
+-----------+--------------+------+-----+-------------------+-------------------+
| Field     | Type         | Null | Key | Default           | Extra             |
+-----------+--------------+------+-----+-------------------+-------------------+
| media_key | varchar(120) | YES  |     | NULL              |                   |
| type      | varchar(120) | YES  |     | NULL              |                   |
| url       | varchar(200) | YES  |     | NULL              |                   |
| id        | int          | NO   | PRI | NULL              | auto_increment    |
| date      | datetime     | YES  |     | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
+-----------+--------------+------+-----+-------------------+-------------------+
```

You'll also need a Twitter Dev account, and the resulting bearer token that comes with it, for authenticating the stream.  Check out dev.twitter.com for more details on how to do this. 

### Compiles and hot-reloads for development
```
npm run serve
```

Note that the server.js **should** be running already, so if you don't change anything, the dev version should connect to the server that's already running.  If you don't want to conect to my running server while developing, you'll have to config the server settings yourself (in /srv/server.js) and run it locally with:

```
node server.js
```

### Compiles and minifies for production
```
npm run build
```

Creates a dist folder which should be uploaded into the directory to be served.  My own server uses a mixter of apache2 and the node server.js server, so you may have to do some configuration changes on your web-server to accomodate.  

### Run your unit tests
```
npm run test:unit
```

### Run your end-to-end tests
```
npm run test:e2e
```

### Lints and fixes files
```
npm run lint
```

### Customize configuration
See [Configuration Reference](https://cli.vuejs.org/config/).

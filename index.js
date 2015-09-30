var express = require("express");
var bodyParser = require("body-parser");
var sqlite = require("sqlite3");
var db = new sqlite.Database("./db");

var CELL_UPDATE_INTERVAL = 10;

db.run("create table if not exists cell_observations (" +
    "type TEXT," +
    "cid INTEGER," +
    "mcc INTEGER," +
    "lac INTEGER," +
    "rssi INTEGER," +
    "lat REAL," +
    "lon REAL," +
    "alt REAL," +
    "accuracy REAL);", function(err) {
      if (err) {
        console.error(err);
      }
    });


db.run("create table if not exists cells (" +
    "cid INTEGER," +
    "rssi INTEGER," +
    "lat REAL," +
    "lon REAL," +
    "time DATE);", function(err) {
      if (err) {
        console.error(err);
      }
    });


db.run("create table if not exists aps (" +
    "ssid TEXT," +
    "bssid TEXT," +
    "rssi INTEGER," +
    "frequency INTEGER," +
    "lat REAL," +
    "lon REAL," +
    "time DATE);", function(err) {
      if (err) {
        console.error(err);
      }
    });


db.run("create table if not exists ap_observations (" +
    "ssid TEXT," +
    "bssid TEXT," +
    "rssi INTEGER," +
    "lat REAL," +
    "lon REAL," +
    "accuracy REAL," +
    "time DATE);", function(err) {
      if (err) {
        console.error(err);
      }
    });

var app = express();
app.use(bodyParser.json());

app.use("/map", express.static("map"));

app.get("/", function(req, res) {
  res.send("Running!");
})

app.get("/cellcount", function(req, res) {
  db.all("select count(*) as count from cells;", function(err, rows) {
    db.all("select count(*) as count from cell_observations", function(err2, rows2) {
      if (err) return console.error(err);
      if (err2) return console.error(err2);

      res.send({count: rows[0].count, observations: rows2[0].count});
    })
  })
})

app.get("/apcount", function(req, res) {
  db.all("select count(*) as count from aps;", function(err, rows) {
    if (err) return console.error(err);

    res.send(rows[0]);
  })
})

app.post("/observation", function(req, res) {
  console.log("POST /observation", req.body);
  var type = req.body.type;

  if (type === "cell") {
    var data = req.body.data

    db.run("insert into cell_observations values (?, ?, ?, ?, ?, ?, ?, ?, ?);", [
        data.type,
        data.cid,
        data.mcc,
        data.lac,
        data.rssi,
        data.lat,
        data.lon,
        data.alt,
        data.accuracy
      ], function(err) {
        if (err) {
          console.error(err);
        }
      });
  }
  else if (type === "wifi") {
    
  }

  res.send(200);
})

app.get("/cell_observations", function(req, res) {
  db.all("select * from cell_observations", function(err, rows) {
    if (!err)
      res.send(rows);
    else
      console.error(err);
  })
})

setInterval(function() {
  db.all("select distinct cid from cell_observations", function(err, rows) {
    if (err)
      return console.error(err);

    // this is not a really efficient way of approaching this problem.
    // could be optimised in a lot of ways
    
    var cells = [];
    
    rows.forEach(function(row) {
      
      db.all("select cid, lat, lon, rssi from cell_observations where cid = ?", [row.cid], function(err, rows) {
        if (err)
          return console.error(err);

        var nearest = rows[0];

        if (rows.length !== 1) {
          for (var i = 1; i < rows.length; i++) {
            if (rows[i].rssi > nearest.rssi)
              nearest = rows[i];
          }
        }

        db.run("insert into cells values (?, ?, ?, ?, ?);", [nearest.cid, nearest.rssi, nearest.lat, nearest.lon, Date.now()], function(err) {
          console.log(nearest);
          if (err) console.error(err);
        })
      })


      // this might leave data in a bad state for a while, but that is fine at this scale
      db.run("delete from cells where time < ?;", [Date.now() - 2000], function(err) {
        if (err) console.error(err);
      })
    })
  })
}, CELL_UPDATE_INTERVAL * 1000)

app.get("/cells", function(req, res) {
  db.all("select * from cells", function(err, rows) {
    if (!err)
      res.send(rows);
    else
      console.error(err);
  })
})

app.listen(7898);

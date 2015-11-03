var express = require("express");
var bodyParser = require("body-parser");
var sqlite = require("sqlite3");
var db = new sqlite.Database("./db");
var fs = require("fs");
var exec = require("child_process").exec

var CELL_UPDATE_INTERVAL = 20; // seconds

db.run("create table if not exists cell_observations (" +
    "type TEXT," +
    "cid INTEGER," +
    "mcc INTEGER," +
    "lac INTEGER," +
    "rssi INTEGER," +
    "lat REAL," +
    "lon REAL," +
    "alt REAL," +
    "accuracy REAL," +
    "time DATE," +
    "mnc INTEGER);", function(err) {
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
    "time DATE," +
    "alt REAL);", function(err) {
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
    "time DATE," +
    "alt REAL," +
    "frequency INTEGER);", function(err) {
      if (err) {
        console.error(err);
      }
    });

function log(msg) {
  console.log("[" + (new Date()) + "] " + msg);
  fs.appendFile("cephlo.log", "[" + (new Date()) + "] " + msg + "\n", function(err) {
    if (err) console.log("error writing to logs");
  });
}

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
    var data = req.body.data;

    db.run("insert into cell_observations values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);", [
        data.type,
        data.cid,
        data.mcc,
        data.lac,
        data.rssi,
        data.lat,
        data.lon,
        data.alt,
        data.accuracy,
        data.timestamp,
        data.mnc
      ], function(err) {
        if (err) {
          console.error(err);
        }
      });
  }
  else if (type === "wifi") {
    var data = req.body.data;

    db.run("insert into ap_observations values(?, ?, ?, ?, ?, ?, ?, ?, ?);", [
      data.ssid,
      data.bssid,
      data.rssi,
      data.lat,
      data.lon,
      data.accuracy,
      data.timestamp,
      data.alt,
      data.frequency
        ], function(err) {
          if (err) {
            console.error(err);
          }
        });

  }

  res.send(200);
})

app.get("/cell_observations", function(req, res) {
  db.all("select * from cell_observations where cid != 2147483647 and cid > 0", function(err, rows) {
    if (!err) {
      res.send(rows);
    }
    else {
      console.error(err);
      res.status(200);
    }
  })
})

app.get("/ap_observations", function(req, res) {
  db.all("select * from ap_observations;", function(err, rows) {
    if (!err) {
      res.send(rows);
    }
    else {
      console.error(err);
      res.status(200);
    }
  })
})

app.get("/cells", function(req, res) {
  if (req.query.x && req.query.y && req.query.area) {
    var x = parseFloat(req.query.x);
    var y = parseFloat(req.query.y);
    var area = Math.round(parseFloat(req.query.area) / 100);

    var a = Math.round(area / 2);

    console.log(req.query.area, a, x + a, x - a, y + a, y - a)

    db.all("select * from cells where lat > " + (x - a) + " and lat < " + (x + a) +
      " and lon > " + (y - a) + " and lon < " + (y + a), function(err, rows) {
      if (!err) {
        res.send(rows);
      }
      else {
        console.error(err);
        res.status(200);
      }
    })
  }
  else {
    db.all("select * from cells", function(err, rows) {
      if (!err) {
        res.send(rows);
      }
      else {
        console.error(err);
        res.status(200);
      }
    })
  }
})

app.get("/aps", function(req, res) {
  db.all("select * from aps", function(err, rows) {
    if (!err){
      res.send(rows);
    }
    else {
      console.error(err);
      res.status(200);
    }
  })
})

var updateDate = (new Date(2000, 12, 12)).getTime(); // this will calculate all cells at the beginning

// can't do this in a different process because the DB locks
setInterval(function() {
  log("calculating cell locations");

  // only get the unique cids from cells where new observations available
  db.all("select distinct cid from (select * from cell_observations where time > " + updateDate + ");", function(err, rows) {
    if (err)
      return console.error(err);
    
    var cells = [];
    var date = Date.now();
    
    rows.filter(function(row) {
      return row.cid > 0 // -1 cells are pretty common on my phone and probably others
      && row.cid !== 2147483647; // this seems to be a weird Android or Motorola modem bug - those cells are useless
    }).forEach(function(row) {
      db.all("select cid, lat, lon, rssi from cell_observations where cid = ?", [row.cid], function(err, rows) {
        if (err)
          return console.error(err);

        var nearest = rows[0];
        
        var sorted = rows.sort(function(a, b) {
          return a.rssi - b.rssi;
        });

        // choose the top 5% and a minimum of one cell
        var size = Math.ceil(0.05 * sorted.length);

        var rssiSum = 0;

        for (var i = 0; i < size; i++) {
          rssiSum += 140 + sorted[i].rssi; // there shouldn't be any values below -140dB...
        }

        var latSum = 0, lonSum = 0;

        for (var i = 0; i < size; i++) {
            var r = ((140 + sorted[i].rssi) / rssiSum);
            latSum += sorted[i].lat * r;
            lonSum += sorted[i].lon * r;
        }

        var cell = {
          lat: latSum,
          lon: lonSum,
          cid: row.cid
        };

        // should probably use a transaction
        db.run("delete from cells where cid = " + cell.cid, function(err) {
          if (err) return console.error(err);

          // RSSI is not really useful, so it's just always 100
          db.run("insert into cells values (?, ?, ?, ?, ?);", [cell.cid, -100, cell.lat, cell.lon, date], function(err) {
            if (err) console.error(err);
          })
        })
      })
    })

    updateDate = Date.now();
  })

}, CELL_UPDATE_INTERVAL * 1000)

app.listen(7898);

var map = L.map("map").setView([48, 16], 9);

L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
  attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

$.get("/cells", function(cells) {
  cells.forEach(function(cell) {
    var coords = [cell.lat, cell.lon];

    var text = "cid: " + cell.cid + "<br />"
    + "time: " + new Date(cell.time).toString();

    L.marker(coords)
      .addTo(map)
      .bindPopup(text);
  })
})

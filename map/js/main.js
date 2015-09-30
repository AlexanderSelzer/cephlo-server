var map = L.map("map").setView([48, 16], 9);

L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
  attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

var menu = $(".menu > div");

menu.each(function(i) {
  console.log(this.className);
  
  if (this.className === "menu-cells") {
      $(this).on("click", function() {
        clearMap();
        menu.removeClass("active");
        $(this).addClass("active");
        displayCells()
      });
  }
  else if (this.className === "menu-cell-observations") {
      $(this).on("click", function() {
        clearMap();
        menu.removeClass("active");
        $(this).addClass("active");
        displayCellObservations()
      });
  }
  else if (this.className === "menu-aps") {
      $(this).on("click", displayCells);
  }
  else if (this.className === "menu-ap-observations") {
      $(this).on("click", displayCells);
  }
})

displayCells();

var markers = new L.FeatureGroup();

function clearMap() {
  map.removeLayer(markers);
}

function displayCells() {
  $.get("/cells", function(cells) {
    cells.forEach(function(cell) {
      var coords = [cell.lat, cell.lon];

      var text = "cid: " + cell.cid + "<br />"
      + "time: " + new Date(cell.time).toString();

      L.marker(coords)
        .addTo(markers)
        .bindPopup(text);
    })
    map.addLayer(markers);
  })
}

function displayCellObservations() {
  $.get("/cell_observations", function(cells) {
    cells.forEach(function(cell) {
      var coords = [cell.lat, cell.lon];

      var text = "cid: " + cell.cid + "<br />"
      + "time: " + new Date(cell.time).toString();

      L.marker(coords)
        .addTo(markers)
        .bindPopup(text);
    })
    map.addLayer(markers);
  })
}

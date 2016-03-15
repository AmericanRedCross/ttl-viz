var data, filteredData;;
var locationLookup = {};

// ISSUES //
// ###### //


// FOR BUILDING LOCATION FILTERS.... USE HOUSEHOLD ID, ALL TABLES NEED TO HAVE IT...
// ERROR CHECK FOR JUST THAT MISSING... DEALING WITH DIFFERENT SCENARIOS IS A PAIN...


// # Core Shelter:
// **Table:**
// Household ID, Household Last Name, Household First Name, Construction Completion Date, House Type, Before Picture (from household profiling), After Picture (from 100% core completion)
// **Summary Chart/Graphs:**
// Households completed per barangay, core house completion over time

// # HELPERS
function adminText(locationId, type){
  if(locationLookup[locationId] === undefined){ return "no data"}
  else if (type === "muni") {
    return locationLookup[locationId].barangay;
  } else if (type === "brgy") {
    return locationLookup[locationId].municipality;
  } else { return "error" }
}


function getLocationData(){
  queryStr = 'SELECT * FROM "TARGET_LOCATION";';
  url = window.location.origin + "/query/" + queryStr ;
  $.get(url, queryStr, function(response){
    $.each(response, function(index, location){
      locationLookup[location.location_id] = location;
      locationLookup[location['location_id'].slice(0,2)] = location;
    });

// locationLookup = {
//   "14124": {
//     "id":"24",
//     "location_id":"14124",
//     "barangay_id":"124",
//     "municipality_id":"14",
//     "province":"Leyte",
//     "municipality":"Tacloban",
//     "barangay":"San Paglaum 103A"
//   },
//   "14123": {...},
//   ...
// };

    fetchData();
  });
}

function fetchData(){
  queryStr = 'SELECT * FROM "core_shelter_100_percent_completion";';
  url = window.location.origin + "/query/" + queryStr ;
  $.get(url, queryStr, function(response){
    data = response;
    var counter = 0;
    data.forEach(function(d){
      // # for the filter to work all the filtered data values need to be arrays even if all possibilities are just 1 value
      // # this is keeping the option of filtering on 'proposed_items' open which is a comma seperated data field
      d['hh_type'] = [d['hh_type']];
      d['hh_relocation'] = [d['hh_relocation']];
      d['wash_solution'] = [d['wash_solution']];
      d['location_id'] = [d['hh_municipality'] + d['hh_barangay']];
      d['location'] = [d['hh_municipality'], d['location_id']];
      counter++;
      if(counter === data.length){ buildFilters(); }
    });
  });
}

function buildFilters(){
  // # get the unique values from the data for all our filter fields
  var typeArray = [],
      relocationArray = [],
      washArray = [],
      locationArray = [];
  $.each(data, function(i,item){
    item['hh_type'].forEach(function(d){
      if($.inArray(d, typeArray) === -1){ typeArray.push(d) }
    });
    item['hh_relocation'].forEach(function(d){
      if($.inArray(d, relocationArray) === -1){ relocationArray.push(d) }
    });
    item['wash_solution'].forEach(function(d){
      if($.inArray(d, washArray) === -1){ washArray.push(d) }
    });
    item['location_id'].forEach(function(d){
      if($.inArray(d, locationArray) === -1){ locationArray.push(d) }
    });

  });
  // # alphabetize them arrays
  typeArray.sort(d3.ascending);
  relocationArray.sort(d3.ascending);
  washArray.sort(d3.ascending);
  locationArray.sort(function(a, b) { return a - b; });
  // # build the html and add it to the page
  var panelTitles = [];
  var panelBodies = [];
  function panelHtml(title, dataId, array, geo){
    var thisTitleHtml = '<span class="panel-title">' +
      '<a class="collapsed" role="button" data-toggle="collapse" data-parent="#accordion" href="#collapse-' +
        dataId + '" aria-expanded="false" aria-controls="collapse' + dataId + '">' +
        title + '</a></span>';
    panelTitles.push(thisTitleHtml);
    var thisBodyHtml = '<div id="collapse-' + dataId + '" class="collapse" role="tabpanel">' +
      '<div class="panel-body">';
    if(geo === true) {
      var municipArray = [];
      $.each(array, function(i, a){
        var thisMunicip = a.toString().slice(0,2);
        if($.inArray(thisMunicip, municipArray) === -1){
          municipArray.push(thisMunicip);
          thisBodyHtml += (municipArray.length > 0) ? '<br>' : '';
          thisBodyHtml += '<div class="checkbox"><label><input type="checkbox" name="location" value="' +
              thisMunicip + '" onchange="filter();"><strong>' + locationLookup[thisMunicip].municipality + '<strong></label></div><br>';
        }
        thisBodyHtml += '<div class="checkbox"><label><input type="checkbox" name="location" value="' +
            a + '" onchange="filter();">' + locationLookup[a].barangay + '</label></div>';
      })
    } else {
      $.each(array, function(i, a){
        thisBodyHtml += '<div class="checkbox"><label><input type="checkbox" name="'+
            dataId + '" value="' + a + '" onchange="filter();">' + a + '</label></div>';
      })
    }
    thisBodyHtml += '</div>' + '</div>';
    $('.filter-panel.panel').append(thisBodyHtml);
  }
  panelHtml('House type', 'hh_type', typeArray);
  panelHtml('Relocation', 'hh_relocation', relocationArray);
  panelHtml('Wash solution', 'wash_solution', washArray);
  panelHtml('Location', null, locationArray, true);
  $('.filter-panel.panel-heading').html(panelTitles.join('&nbsp; | &nbsp;'));

  filteredData = data;
  $('#loader').hide();
  // buildBars();

}


function vizByBrgy(){

  var rollup = d3.nest()
    .key(function(d) { return d['location_id']; })
    .rollup(function(values) { return values.length; })
    .entries(data);
  // >>> sum of core per barangay
  // >>> test = [{11102: 45, 11103: 59,...}]
  $('#coreTotal').html(d3.sum(rollup, function(d) { return d.values; }));

  rollup.sort(function(a, b) { return b.values - a.values; });

  var margin = {top: 20, right: 20, bottom: 30, left: 155};
  var width = $('#coreByBarangay').width();
      barHeight = 20;

  var x = d3.scale.linear()
      .range([0, width - margin.left - margin.right])
      .domain([0, d3.max(rollup, function(d) { return d.values; })]);

  var coreByBarangay = d3.select('#coreByBarangay').append('svg')
    .attr("width", width + margin.left + margin.right)
    .attr("height", barHeight * rollup.length);

  var bar = coreByBarangay.selectAll("g")
      .data(rollup).enter().append("g")
      .attr("transform", function(d, i) { return "translate(" + margin.left + "," + i * barHeight + ")"; });
  bar.append("rect")
      .attr("width", function(d) { return x(d.values); })
      .attr("height", barHeight - 1);
  bar.append("text")
      .attr("x", -5)
      .attr("y", barHeight / 2)
      .attr("dy", ".35em")
      .classed("brgy-label", true)
      .text(function(d) {
        return adminText(d.key, 'brgy') + ", " + adminText(d.key, 'muni') ;
      });
  bar.append("text")
      .attr("x", function(d) { return x(d.values) + 3; })
      .attr("y", barHeight / 2)
      .attr("dy", ".35em")
      .classed("brgy-total", true)
      .text(function(d) { return d.values; });
}

function vizTime(){

  dateData = d3.nest()
    .key(function(d) { return d.hh_completed; }).sortKeys(d3.ascending)
    .rollup(function(values) { return values.length; })
    .entries(data);
  var total = 0;
  $.each(dateData, function(index, date){
    total += date.values;
    date['total'] = total;
  });

  var margin = {top: 20, right: 40, bottom: 30, left: 50},
    width = $("#progressGraph").width() - margin.left - margin.right,
    height = 400 - margin.top - margin.bottom;

  var progressGraph = d3.select("#progressGraph").append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
    .append("g")
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  var x = d3.time.scale()
    .range([0, width]);
  var y = d3.scale.linear()
    .range([height, 0]);

  var xAxis = d3.svg.axis()
      .scale(x)
      .orient("bottom");
  var yAxis = d3.svg.axis()
      .scale(y)
      .orient("left");

  var line = d3.svg.line()
      .interpolate("step-after")
      .x(function(d) { return x(d.key); })
      .y(function(d) { return y(d.total); });

  var bisectDate = d3.bisector(function(d) { return d.key; }).left;
  var readableDate = d3.time.format("%d %b");

  dateData.forEach(function(d) {
    d.key = new Date(d.key);
  });

  x.domain(d3.extent(dateData, function(d) { return d.key; }));
  y.domain(d3.extent(dateData, function(d) { return d.total; }));

  progressGraph.append("g")
      .attr("class", "x axis")
      .attr("transform", "translate(0," + height + ")")
      .call(xAxis);

  progressGraph.append("g")
      .attr("class", "y axis")
      .call(yAxis)
    .append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", 6)
      .attr("dy", ".71em")
      .style("text-anchor", "end")
      .text("Total constructed");

  progressGraph.append("path")
    .datum(dateData)
    .attr("class", "line")
    .attr("d", line);

  var focus = progressGraph.append("g")
    .attr("class", "focus")
    .style("display", "none");

  focus.append("circle")
    .attr("r", 5);

  progressGraph.append("text")
    .attr("class", "detail")
    .attr("x", 15 + margin.left)
    .attr("dy", ".35em");

  progressGraph.append("rect")
    .attr("class", "overlay")
    .attr("width", width)
    .attr("height", height)
    .on("mouseover", function() { focus.style("display", null); })
    .on("mouseout", function() { focus.style("display", "none"); })
    .on("mousemove", mousemove);

  function mousemove() {
    var x0 = x.invert(d3.mouse(this)[0]),
    i = bisectDate(dateData, x0, 1),
    d0 = dateData[i - 1],
    d1 = dateData[i],
    d = x0 - d0.key > d1.key - x0 ? d1 : d0;
    focus.attr("transform", "translate(" + x(d.key) + "," + y(d.total) + ")");
    progressGraph.select(".detail").text(readableDate(d.key) + " - " + d.values + " completed, " + d.total + " total");
  }

}

function vizTable(){

  $('#beneficiaryTable').html("<thead><tr>" +
    "<th>First name</th>" +
    "<th>Last name</th>" +
    "<th>Barangay</th>" +
    "<th>Municipality</th>" +
    "<th>Details</th>" +
    "</tr></thead><tbody></tbody>");

  d3.select('#beneficiaryTable tbody').selectAll('tr')
    .data(data).enter()
    .append('tr')
    .html(function(d){
      return "<td>" + d.hh_respondent_first_name + "</td>" +
      "<td>" + d.hh_respondent_last_name + "</td>" +
      "<td>" + adminText(d.location_id, 'brgy') + "</td>" +
      "<td>" + adminText(d.location_id, 'muni') + "</td>" +
      '<td><button type="button" class="btn btn-default" data-toggle="modal" data-target="#pic-modal" data-filename="' + d.photo_shelter_one +
      '" data-uuid="' + d['_uuid'] + '"><b class="fa fa-info"></b></button></td>';
    });

  var modalReadableTime = d3.time.format("%d-%b-%Y");

  $('#pic-modal').on('show.bs.modal', function (event) {
    var button = $(event.relatedTarget); // Button that triggered the modal
    var modal = $(this);
    var src = "http://formhub.redcross.org/attachment/original?media_file=arc_ttl/attachments/" + button.data('filename'); // Extract info from data-* attributes
    modal.find('.modal-body img').attr("src", src);
    for(i=0;i<data.length;i++){
      if(button.data('uuid') === data[i]['_uuid']){
        var hhId = (data[i].hh_id !== null) ? data[i].hh_id.toString() : "<i>QR code not scanned</i>";
        modal.find('#modal-hh-id').html(hhId);
        var benDetailsHtml = "<b>Beneficiary respondent:</b> " + data[i].hh_respondent_first_name + " ";
        benDetailsHtml += (data[i].hh_respondent_middle_name.length > 0) ? data[i].hh_respondent_middle_name + " " : "";
        benDetailsHtml += data[i].hh_respondent_last_name + "<br>" +
          "<b>Location:</b> " + locationLookup[data[i].location_id].barangay + ", " + locationLookup[data[i].location_id].municipality + "<br>" +
          "<b>Type:</b> " + data[i].hh_type + "<br>" +
          "<b>Date completed:</b> " + modalReadableTime(new Date(data[i].hh_completed)) + "<br>" +
          "<b>Team leader:</b> " + data[i].team_leader_first_name + " ";
        benDetailsHtml += (data[i].hh_respondent_middle_name.length > 0) ? data[i].team_leader_middle_name + " " : "";
        benDetailsHtml += data[i].team_leader_last_name;
        modal.find('.modal-body p').html(benDetailsHtml);
        break;
      }
    }
});

  $('#beneficiaryTable').DataTable();

}

function vizMap(){
  function sizeMap(){
  	$('#myMap').css("height", function(){
  		return $(window).height() - 150;
  	});
  }
  $(window).resize(function(){
  	sizeMap();
  });
  sizeMap();
  var mapUrl = 'http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  var mapAttribution = 'Map data &copy; <a href="http://openstreetmap.org" target="_blank">OpenStreetMap</a> | CC-BY <a href="http://redcross.org" title="Red Cross" target="_blank">Red Cross</a> 2015 | <a title="Disclaimer" onClick="showDisclaimer();">Disclaimer</a>';
  var mapTiles = L.tileLayer(mapUrl, {attribution: mapAttribution});
  var map = L.map('myMap', {
      zoom: 3,
      center: [0,0],
      scrollWheelZoom: false,
      layers: [mapTiles]
  });

  var featureCollection= { "type": "featureCollection", "features": [] };
  $.each(data, function(index, item) {
    if(parseFloat(item.gps_long) != NaN && parseFloat(item.gps_lat) != NaN){
      var latlng = [parseFloat(item.gps_long), parseFloat(item.gps_lat)];
      var thisGeoJsonObject = {
        "type": "Feature",
        "properties": {
          "head_of_hh_fname": item.head_of_hh_fname,
          "head_of_hh_lname": item.head_of_hh_lname,
          "head_of_hh_mname": item.head_of_hh_mname,
          "household_id": item.household_id
        },
        "geometry": {
          "type": "Point",
          "coordinates": latlng
        }
      };
      featureCollection.features.push(thisGeoJsonObject);
    }
  });

  var centroidOptions = {
      radius: 5,
      fillColor: "#ED1B2E",
      fillOpacity: 1,
      weight: 0

  };

  locationsLayer = L.geoJson(featureCollection.features, {
    pointToLayer: function (feature, latlng) {
      return L.circleMarker(latlng, centroidOptions);
    },
    onEachFeature: onEachFeature
  }).addTo(map);
  mapBounds = locationsLayer.getBounds();
  map.fitBounds(mapBounds);
  map.addLayer(locationsLayer);

}


// ON WINDOW RESIZE, REDRAW SOME ELEMENTS TO FIT
d3.select(window).on("resize", throttle);
var throttleTimer;
function throttle() {
  window.clearTimeout(throttleTimer);
    throttleTimer = window.setTimeout(function() {
      $('#progressGraph').empty();
      vizTime();
      $('#coreByBarangay').empty();
      vizByBrgy();
    }, 200);
}


getLocationData();

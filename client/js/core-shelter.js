var data, filteredData, dateData;
var locationLookup = {};

// FOR BUILDING LOCATION FILTERS.... USE HOUSEHOLD ID, ALL TABLES NEED TO HAVE IT...

// # Core Shelter:
// **Table:**
// Household ID, Household Last Name, Household First Name, Construction Completion Date, House Type, Before Picture (from household profiling), After Picture (from 100% core completion)
// **Summary Chart/Graphs:**
// Households completed per barangay, core house completion over time

// # HELPERS
function adminText(locationId, type){
  if(locationLookup[locationId] === undefined){ return "no data"}
  else if (type === "brgy") {
    return locationLookup[locationId].barangay;
  } else if (type === "muni") {
    return locationLookup[locationId].municipality;
  } else { return "error" }
}

function clearAllCheckboxes(){
  var allCheckboxes = $.find("input:checkbox");
  $.each(allCheckboxes, function(i, box){ $(box).prop('checked',false); });
  filter();
}

d3.select(window).on("resize", throttle);
var throttleTimer;
function throttle() {
  window.clearTimeout(throttleTimer);
    throttleTimer = window.setTimeout(function() {
      resize();
    }, 200);
}
function resize() {
  d3.select('#brgyBars').select("svg").remove();
  d3.select('#progressGraph').select("svg").remove();
  buildBars();
}



function getLocationData(){
  $.get('query/targetlocations', function(response){
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
  $.get('query/coreshelter100', function(response){
    data = response;
    var counter = 0;
    data.forEach(function(d){
      // # for the filter to work all the filtered data values need to be arrays even if all possibilities are just 1 value
      // # this is keeping the option of filtering on 'proposed_items' open which is a comma seperated data field
      d['hh_type'] = [d['hh_type']];
      d['hh_relocation'] = [d['hh_relocation']];
      d['wash_solution'] = [d['wash_solution']];
      d['location_id'] = (d['hh_id_qr'] === null) ? 'data missing' : d['hh_id_qr'].slice(0,5);
      d['location'] = (d['hh_id_qr'] === null) ? ['data missing','data missing'] : [d['hh_id_qr'].slice(0,2), d['hh_id_qr'].slice(0,5)];
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
    if($.inArray(item['location_id'], locationArray) === -1){ locationArray.push(item['location_id']) }

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
        var thisMunicip = a.slice(0,2);
        if($.inArray(thisMunicip, municipArray) === -1 && locationLookup[thisMunicip] !== undefined){
          municipArray.push(thisMunicip);
          thisBodyHtml += (municipArray.length > 0) ? '<br>' : '';
          thisBodyHtml += '<div class="checkbox"><label><input type="checkbox" name="location" value="' +
              thisMunicip + '" onchange="filter();"><strong>' + locationLookup[thisMunicip].municipality + '<strong></label></div><br>';
        }
        if(locationLookup[a] === undefined){ thisBodyHtml += '<div class="checkbox"><label><input type="checkbox" name="location" value="' +
            a + '" onchange="filter();">' + 'data error' + '</label></div>'; }
        else { thisBodyHtml += '<div class="checkbox"><label><input type="checkbox" name="location" value="' +
            a + '" onchange="filter();">' + locationLookup[a].barangay + '</label></div>'; }
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
  buildBars();

}

function filter(){
  // # look at all the checkboxes and record whats checked
  activeFilters = []
  checkboxes = $(".filter-panel.panel input[type=checkbox]");
    for (i=0; i<checkboxes.length; i++) {
      if(checkboxes[i].checked === true) {
        activeFilters.push({
          filterKey: checkboxes[i].name,
          filterValue: checkboxes[i].value
        })
      }
    }
  // # reformat the data on checks to make it easier to work with
  // ? combine this into what's above
  filterData = d3.nest().key(function(d){ return d.filterKey })
    .rollup(function(values){
      var valuesArray = [];
      values.forEach(function(d){
        valuesArray.push(d.filterValue);
      });
      return valuesArray;
    }).entries(activeFilters)
  // # update the html on the page to let the user know what filters are active
  var keyGroups = [];
  $.each(filterData,function(i,filterKey){
    var keyGroupHtml = '(<b>' + filterKey.key + '</b> <small>=</small> ';
    var valueGroups = [];
    $.each(filterKey.values, function(j,filterValue){
      valueGroups.push('<b>' + filterValue + '</b>');
    })
    keyGroupHtml += valueGroups.join(" <small>OR</small> ") + ")"
    keyGroups.push(keyGroupHtml);
  });
  $('#filter-active-text').html(keyGroups.join(" <small>AND</small> "));
  // # filter the data
  var filterKeyCount = filterData.length;
  filteredData = data.filter(function(d){
    var passCount = 0;
    var project = d;
    $.each(filterData,function(iKey, filterKey){
      var pass = false;
      var thisKey = filterKey.key;
      $.each(filterKey.values, function(iValue, filterValue){
        // # if any of the filter values for a given key are present, that filter key is passed
        if($.inArray(filterValue, project[thisKey]) !== -1){ pass = true; }
      });
      if(pass === true){ passCount ++; }
    });
    // # if all filter keys are passed, the project passes the filtering
    return passCount === filterKeyCount;
  })

  drawBars()

}


var brgyBarsMeas, brgyBars, brgyBarsX;
function buildBars(){
  brgyBarsMeas = {top: 20, right: 50, bottom: 20, left: 170, barHeight: 20, width: $('#brgyBars').innerWidth()};
  brgyBars = d3.select('#brgyBars').append('svg')
      .attr("width", brgyBarsMeas.width)

  brgyBarsX = d3.scale.linear()
      .range([0, brgyBarsMeas.width - brgyBarsMeas.left - brgyBarsMeas.right])

  buildTimeline();

}

var timelineMeas, timelineGraph, timelineX, timelineY, timelineAxisX, timelineAxisY, timelineLine;
function buildTimeline(){
  timelineMeas = {top: 20, right: 40, bottom: 30, left: 50, height: 350, containerWidth: $('#progressGraph').innerWidth()},

  timelineGraph = d3.select("#progressGraph").append("svg")
      .attr("width", timelineMeas.containerWidth)
      .attr("height", timelineMeas.height + timelineMeas.top + timelineMeas.bottom)
    .append("g")
      .attr("transform", "translate(" + timelineMeas.left + "," + timelineMeas.top + ")");

  timelineX = d3.time.scale()
    .range([0, timelineMeas.containerWidth - timelineMeas.left - timelineMeas.right]);
  timelineY = d3.scale.linear()
    .range([timelineMeas.height, 0]);

  timelineAxisX = d3.svg.axis()
        .orient("bottom");
  timelineAxisY = d3.svg.axis()
        .orient("left");

  timelineLine = d3.svg.line()
      .interpolate("step-after")
      .x(function(d) { return timelineX(d.key); })
      .y(function(d) { return timelineY(d.total); });

  var bisectDate = d3.bisector(function(d) { return d.key; }).left;
  var readableDate = d3.time.format("%d %b %Y");

  timelineGraph.append("g")
      .attr("class", "x axis")
      .attr("transform", "translate(0," + timelineMeas.height + ")")

  timelineGraph.append("g")
      .attr("class", "y axis")
    .append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", 6)
      .attr("dy", ".71em")
      .style("text-anchor", "end")
      .text("Total constructed");

  timelineGraph.append("path")
    .attr("class", "line")

  var focus = timelineGraph.append("g")
    .attr("class", "focus")
    .style("display", "none");

  focus.append("circle")
    .attr("r", 5);

  timelineGraph.append("text")
    .attr("class", "detail")
    .attr("x", 15 + timelineMeas.left)
    .attr("dy", ".35em");

  timelineGraph.append("rect")
    .attr("class", "overlay")
    .attr("width", timelineMeas.containerWidth - timelineMeas.left - timelineMeas.right)
    .attr("height", timelineMeas.height)
    .on("mouseover", function() { focus.style("display", null); })
    .on("mouseout", function() { focus.style("display", "none"); })
    .on("mousemove", mousemove);

  function mousemove() {
    var x0 = timelineX.invert(d3.mouse(this)[0]),
    i = bisectDate(dateData, x0, 1),
    d0 = dateData[i - 1],
    d1 = dateData[i],
    d = x0 - d0.key > d1.key - x0 ? d1 : d0;
    focus.attr("transform", "translate(" + timelineX(d.key) + "," + timelineY(d.total) + ")");
    timelineGraph.select(".detail").text(readableDate(d.key) + " - " + d.values + " completed, " + d.total + " total");
  }


  drawBars();

}

function drawBars(){
  // get sume of grants per brgy
  var brgyBarsData = d3.nest()
    .key(function(d) { if(d['hh_id_qr'] === null){ return 'data missing'} else { return d['hh_id_qr'].slice(0,5); } })
    .rollup(function(values) { return values.length; })
    .entries(filteredData);

  brgyBarsX.domain([0, d3.max(brgyBarsData, function(d) { return d.values; })]);

  brgyBars.attr("height", brgyBarsMeas.barHeight * brgyBarsData.length);

  var g = brgyBars.selectAll("g")
      .data(brgyBarsData, function(d){ return d['key']; })

  var gEnter = g.enter().append("g")
  gEnter.append('rect')
      .attr("height", brgyBarsMeas.barHeight - 1)
  gEnter.append("text")
      .attr("class","brgy-label")
      .attr("x", -5)
      .attr("y", brgyBarsMeas.barHeight / 2)
      .attr("dy", ".35em")
  gEnter.append("text")
      .attr("class","brgy-total")
      .attr("y", brgyBarsMeas.barHeight / 2)
      .attr("dy", ".35em")

  g.sort(function(a, b) { return b.values - a.values; }).transition().duration(1000).ease("sin-in-out")
      .attr("transform", function(d, i) { return "translate(" + brgyBarsMeas.left + "," + i * brgyBarsMeas.barHeight + ")"; });
  g.select("rect").transition().duration(1000).ease("sin-in-out")
    .attr("width", function(d) { return brgyBarsX(d.values); })
  g.select(".brgy-label")
      .text(function(d) {
        if(locationLookup[d.key] === undefined){ return d.key; }
        else { return locationLookup[d.key].barangay + ", " + locationLookup[d.key].municipality; }
      });
  g.select(".brgy-total").transition().duration(1000).ease("sin-in-out")
      .attr("x", function(d) { return brgyBarsX(d.values) + 3; })
      .text(function(d) { return d.values; });

  g.exit().remove();

  drawTimeline();

}


function drawTimeline(){

  dateData = d3.nest()
    .key(function(d) { return d.hh_completed; }).sortKeys(d3.ascending)
    .rollup(function(values) { return values.length; })
    // filter out data that is null or way to early
    .entries(filteredData.filter(function(d){ if(d['hh_completed'] !== null && new Date(d['hh_completed']) > new Date('2014-01-01')){ return true; } }));

  var total = 0;
  $.each(dateData, function(index, date){
    date.key = new Date(date.key);
    total += date.values;
    date['total'] = total;
  });

  timelineX.domain(d3.extent(dateData, function(d) { return d.key; }));
  timelineY.domain(d3.extent(dateData, function(d) { return d.total; }));
  timelineAxisX.scale(timelineX);
  timelineAxisY.scale(timelineY);
  timelineGraph.select(".x.axis").transition().duration(1500).ease("sin-in-out").call(timelineAxisX);
  timelineGraph.select(".y.axis").transition().duration(1500).ease("sin-in-out").call(timelineAxisY);
  timelineGraph.select(".line").datum(dateData).attr("d", timelineLine);

  buildList()
}

function buildList(){

  $('#listTable').empty();
  $('#listTable').html('<table data-sortable id="dataTable" class="compact sortable-theme-minimal">' +
        '<thead><tr><th>First</th><th>Last</th><th>Barangay</th><th>Municipality</th><th>Details</th></tr></thead>' +
        '<tfoot><tr><th>First</th><th>Last</th><th>Barangay</th><th>Municipality</th><th>Details</th></tr></tfoot>' +
        '<tbody></tbody></table>')

  $.each(filteredData, function(i,d){
    var rowHtml = '<tr>' +
      '<td>' + d.hh_respondent_first_name + '</td>' +
      '<td>' + d.hh_respondent_last_name + '</td>' +
      '<td>' + adminText(d.location_id, 'brgy') + '</td>' +
      '<td>' + adminText(d.location_id, 'muni') + '</td>' +
      '<td><button type="button" class="btn btn-default btn-xs" data-toggle="modal" data-target="#pic-modal" data-filename="' + d.photo_shelter_one +
      '" data-uuid="' + d['_uuid'] + '"><b class="fa fa-info"></b></button></td>' +
      '</tr>';
    $('#listTable tbody').append(rowHtml);
  });

  var modalReadableTime = d3.time.format("%d-%b-%Y");

  $('#pic-modal').on('show.bs.modal', function (event) {
    var button = $(event.relatedTarget); // Button that triggered the modal
    var modal = $(this);
    modal.find('.modal-body img.img-before').attr("src", "");
    modal.find('.modal-body img.img-after').attr("src", "");

    var src = "http://formhub.redcross.org/attachment/original?media_file=arc_ttl/attachments/" + button.data('filename'); // Extract info from data-* attributes
    modal.find('.modal-body img.img-after').attr("src", src);
    for(i=0;i<data.length;i++){
      if(button.data('uuid') === data[i]['_uuid']){
        $.post('query/enumerationhousephoto', {"id": data[i].hh_id_qr}, function(response){
          // # response should be an array containing one object
          if(response){
            var beforeSrc = "http://formhub.redcross.org/attachment/original?media_file=arc_ttl/attachments/" + response[0]['house_photo'];
            modal.find('.modal-body img.img-before').attr("src", beforeSrc);
          }
        });
        var hhId = (data[i].hh_id_qr !== null) ? data[i].hh_id_qr.toString() : "<i>household ID not found</i>";
        modal.find('#modal-hh-id').html(hhId);
        var benDetailsHtml = "<b>Beneficiary respondent:</b> " + data[i].hh_respondent_first_name + " ";
        if(data[i].hh_respondent_middle_name !== null){
          if(data[i].hh_respondent_middle_name.length > 0){ benDetailsHtml += data[i].hh_respondent_middle_name + " " ; }
        }
        benDetailsHtml += data[i].hh_respondent_last_name + "<br>" +
          "<b>Location:</b> "
        benDetailsHtml += (data[i].location_id === "data missing") ? "data missing" : locationLookup[data[i].location_id].barangay + ", " + locationLookup[data[i].location_id].municipality;
        benDetailsHtml += "<br>" +
          "<b>Type:</b> " + data[i].hh_type + "<br>" +
          "<b>Date completed:</b> " + modalReadableTime(new Date(data[i].hh_completed)) + "<br>" +
          "<b>Team leader:</b> " + data[i].team_leader_first_name + " ";
        if(data[i].team_leader_middle_name !== null){
          if(data[i].team_leader_middle_name.length > 0){ benDetailsHtml += data[i].team_leader_middle_name + " " ; }
        }
        benDetailsHtml += data[i].team_leader_last_name;
        modal.find('.modal-body p').html(benDetailsHtml);
        break;
      }
    }
  });

  $('#dataTable tfoot th').each(function(){
    var title = $(this).text();
    $(this).html('<input type="text" placeholder="Search '+title+'" />');
  });

  var table = $('#dataTable').DataTable({"sDom":'lrtip'});

  table.columns().every( function() {
    var that = this;

    $('input', this.footer() ).on('keyup change', function(){
      if( that.search() !== this.value ){
        that
        .search( this.value )
        .draw();
      }
    });
  });


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

getLocationData();

var data, filteredData;
var locationLookup = {};

function adminText(locationId, type){
  if(locationLookup[locationId] === undefined){ return "no data"}
  else if (type === "muni") {
    return locationLookup[locationId].municipality;
  } else if (type === "brgy") {
    return locationLookup[locationId].barangay;
  } else { return "error" }
}


var commaSeperator = d3.format(",");

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
  d3.select('#perModuleGraph').select("svg").remove();
  d3.select('#modulesAttendedGraph').select("svg").remove();

  buildBars();
}

function clearAllCheckboxes(){
  var allCheckboxes = $.find("input:checkbox");
  $.each(allCheckboxes, function(i, box){ $(box).prop('checked',false); });
  filter();
}

// Household ID, Household Last Name, Household First Name, Household Livelihood Category, Proposal Category, Proposal Value
// **Summary Chart/Graphs:**
// Value of proposals per barangay, Value of proposals per proposal category, Value of proposals per household livelihood category, Number of CCG households per barangay, number of CCG households per proposal category, number of CCG households per livelihood category
// **Map:**
// Thematic map - symbolized by proposal category, thematic map - symbolized by livelihood cateogory, thematic map - symobolized by proposal value

function getLocationData(){
  $.get('query/targetlocations', function(response){
    $.each(response, function(index, location){
      locationLookup[location['location_id']] = location;
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
  $.get('query/phast', function(response){
    data = response;

    data.forEach(function(d){
      d['location_id'] = [d['household_id'].slice(0,5)];
      d['location'] = [d['household_id'].slice(0,2), d['household_id'].slice(0,5)];
    });

    buildFilters();

  });
}

function buildFilters(){
  // # get the unique values from the data for all our filter fields
  var locationArray = [];
  $.each(data, function(i,item){
    item['location_id'].forEach(function(d){
      if($.inArray(d, locationArray) === -1){ locationArray.push(d) }
    });
  });
  // # alphabetize them arrays
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

  drawBars();

}


var brgyBarsMeas, brgyBars, brgyBarsX;
function buildBars(){
  brgyBarsMeas = {top: 20, right: 50, bottom: 20, left: 170, barHeight: 20, width: $('#brgyBars').innerWidth()};
  brgyBars = d3.select('#brgyBars').append('svg')
      .attr("width", brgyBarsMeas.width)

  brgyBarsX = d3.scale.linear()
      .range([0, brgyBarsMeas.width - brgyBarsMeas.left - brgyBarsMeas.right])

  buildGraphs();
}


var perModuleMeas, perModuleSvg, perModuleXscale, perModuleYscale, perModuleYaxis, perModuleYele;
var modulesAttendedMeas, modulesAttendedSvg, modulesAttendedXscale, modulesAttendedYscale, modulesAttendedYaxis, modulesAttendedYele;
function buildGraphs(){

  // ### PARTICIPANTS PER MODULE
  perModuleMeas = {top: 20, right: 60, bottom: 45, left: 60,
    height: 250 - 40, width: $('#perModuleGraph').innerWidth() - 60 - 60 };
  perModuleMeas.barWidth = perModuleMeas.width / (20 * 2),

  perModuleSvg = d3.select('#perModuleGraph').append('svg')
    .attr("width", perModuleMeas.width + perModuleMeas.left + perModuleMeas.right)
    .attr("height", perModuleMeas.height + perModuleMeas.top + perModuleMeas.bottom)
    .append('g').attr("transform", "translate(" + perModuleMeas.left + "," + perModuleMeas.top + ")");

  perModuleYscale = d3.scale.linear()
    .range([perModuleMeas.height, 0])
  perModuleXscale = d3.scale.ordinal()
    .rangeRoundBands([0, perModuleMeas.width], .1)
    .domain(d3.range(1,21))

  var xAxis = d3.svg.axis()
    .scale(perModuleXscale)
    .orient("bottom");
  perModuleSvg.append("g")
    .attr("class", "x axis graph-axis")
    .attr("transform", "translate(0," + perModuleMeas.height + ")")
    .call(xAxis);

  perModuleSvg.append("text")
    .attr("transform", "translate(" + (perModuleMeas.width / 2) + " ," + (perModuleMeas.height + perModuleMeas.bottom - 5) + ")")
    .style("text-anchor", "middle")
    .text("Module #");

  perModuleSvg.append("text")
    .attr("transform", "rotate(-90)")
    .attr("y", 0 - perModuleMeas.left)
    .attr("x", 0 - (perModuleMeas.height / 2))
    .attr("dy", "1em")
    .style("text-anchor", "middle")
    .text("% participants completing");

  perModuleYaxis = d3.svg.axis()
    .scale(perModuleYscale)
    .orient("left").ticks(10, "%");;

  perModuleYele = perModuleSvg.append("g")
    .attr("class", "y axis graph-axis")


  // ### NUMBER OF MODULES COMPLETED

  modulesAttendedMeas = {top: 20, right: 60, bottom: 45, left: 60,
    height: 250 - 40, width: $('#modulesAttendedGraph').innerWidth() - 60 - 60 };
  modulesAttendedMeas.barWidth = modulesAttendedMeas.width / (20 * 2),

  modulesAttendedSvg = d3.select('#modulesAttendedGraph').append('svg')
    .attr("width", modulesAttendedMeas.width + modulesAttendedMeas.left + modulesAttendedMeas.right)
    .attr("height", modulesAttendedMeas.height + modulesAttendedMeas.top + modulesAttendedMeas.bottom)
    .append('g').attr("transform", "translate(" + modulesAttendedMeas.left + "," + modulesAttendedMeas.top + ")");

  modulesAttendedYscale = d3.scale.linear()
    .range([modulesAttendedMeas.height, 0])
  modulesAttendedXscale = d3.scale.ordinal()
    .rangeRoundBands([0, modulesAttendedMeas.width], .1)
    .domain(d3.range(0,21))

  var xAxis = d3.svg.axis()
    .scale(modulesAttendedXscale)
    .orient("bottom");
  modulesAttendedSvg.append("g")
    .attr("class", "x axis graph-axis")
    .attr("transform", "translate(0," + modulesAttendedMeas.height + ")")
    .call(xAxis);

  modulesAttendedSvg.append("text")
    .attr("transform", "translate(" + (modulesAttendedMeas.width / 2) + " ," + (modulesAttendedMeas.height + modulesAttendedMeas.bottom - 5) + ")")
    .style("text-anchor", "middle")
    .text("# of modules completed");

  modulesAttendedSvg.append("text")
    .attr("transform", "rotate(-90)")
    .attr("y", 0 - modulesAttendedMeas.left)
    .attr("x", 0 - (modulesAttendedMeas.height / 2))
    .attr("dy", "1em")
    .style("text-anchor", "middle")
    .text("# participants");

  modulesAttendedYaxis = d3.svg.axis()
    .scale(modulesAttendedYscale)
    .orient("left");

  modulesAttendedYele = modulesAttendedSvg.append("g")
    .attr("class", "y axis graph-axis")


  drawBars();

}

function drawBars(){
  // get sume of grants per brgy
  var brgyBarsData = d3.nest()
    .key(function(d) { return d['household_id'].slice(0,5); })
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
      .text(function(d) { return locationLookup[d.key].barangay + ", " + locationLookup[d.key].municipality; });
  g.select(".brgy-total").transition().duration(1000).ease("sin-in-out")
      .attr("x", function(d) { return brgyBarsX(d.values) + 3; })
      .text(function(d) { return commaSeperator(d.values); });

  g.exit().remove();

  drawModulesAttended();

}

function drawModulesAttended(){

  // ### PARTICIPANTS PER MODULE
  var perModuleData = []
  d3.range(1,21).forEach(function(d){
    perModuleData.push(0);
  })
  filteredData.forEach(function(d){
    d3.range(1,21).forEach(function(n){
      var columnName = "training_activity_" + n;
      if(d[columnName] !== null) {
        if(d[columnName].indexOf("Y") !== -1) { ; perModuleData[n-1]++; }
      }
    })
  })
  $.each(perModuleData, function(i, a){
    // get percentage of participants completing the module
    perModuleData[i] = a / filteredData.length;
  })

  perModuleYscale.domain([0, 1])
  perModuleYele.call(perModuleYaxis)
  var perModuleG = perModuleSvg.selectAll(".bar")
        .data(perModuleData, function(d, i){ return i; })
  perModuleG.enter().append("rect").transition().duration(1000).ease("sin-in-out")
        .attr("class", "graph-bar")
        .attr("x", function(d, i) { return perModuleXscale(i+1); })
        .attr("width", perModuleXscale.rangeBand())
        .attr("y", function(d) { return perModuleYscale(d); })
        .attr("height", function(d) { return perModuleMeas.height - perModuleYscale(d); });
  perModuleG.exit().remove();

  // ### NUMBER OF MODULES COMPLETED
  var modulesAttendedData = d3.nest()
      .key(function(d) { return d.training_total_attendance; } )
      .rollup(function(values) { return values.length; })
      .entries(filteredData);
  modulesAttendedData.forEach(function(d){
    d.key = parseInt(d.key);
  });
  modulesAttendedData.sort(function(a,b){
    return a.key - b.key
  });
  modulesAttendedYscale.domain([0, d3.max(modulesAttendedData, function(d){ return d.values })])
  modulesAttendedYele.call(modulesAttendedYaxis)
  var modulesAttendedG = modulesAttendedSvg.selectAll(".bar")
        .data(modulesAttendedData, function(d){ return d['key']; })
  modulesAttendedG.enter().append("rect").transition().duration(1000).ease("sin-in-out")
        .attr("class", "graph-bar-2")
        .attr("x", function(d) { return modulesAttendedXscale(d.key); })
        .attr("width", modulesAttendedXscale.rangeBand())
        .attr("y", function(d) { return modulesAttendedYscale(d.values); })
        .attr("height", function(d) { return modulesAttendedMeas.height - modulesAttendedYscale(d.values) + 1; });
  modulesAttendedG.exit().remove();

  buildList();

}

var activitiesHeaders = "";
$.each(d3.range(1,21), function(i, a){
  activitiesHeaders += '<th>' + a + '</th>';
})

function buildList(){

  $('#listTable').empty();
  $('#listTable').html('<table data-sortable id="dataTable" class="compact sortable-theme-minimal">' +
        '<thead><tr><th>Household ID</th><th>First</th><th>Last</th><th>Barangay</th><th>Municipality</th>' + activitiesHeaders + '<th>Modules attended</th></tr></thead>' +
        '<tfoot><tr><th>Household ID</th><th>First</th><th>Last</th><th>Barangay</th><th>Municipality</th>' + activitiesHeaders + '<th>Modules attended</th></tr></tfoot><tbody></tbody></table>')
  $.each(filteredData, function(i,d){
    var rowHtml = '<tr>' +
      '<td>' + d['household_id'] + '</td>' +
      '<td>' + d['participant_fname'] + '</td>' +
      '<td>' + d['participant_lname'] + '</td>' +
      '<td>' + adminText(d.location_id, 'brgy') + '</td>' +
      '<td>' + adminText(d.location_id, 'muni') + '</td>';
    $.each(d3.range(1,21), function(i, a){
      var thisSearch = "training_activity_" + a;
      rowHtml += '<td>' + d[thisSearch] + '</td>';
    })
    rowHtml += '<td>' + d['training_total_attendance'] + '</td>' +
      '</tr>';
    $('#listTable tbody').append(rowHtml);
  });

  $('#dataTable tfoot th').each(function(){
    var title = $(this).text();
    $(this).html('<input type="text" placeholder="Search '+title+'" />');
  });

  var table = $('#dataTable').DataTable({"sDom":'lrtip', "scrollX": true});

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

getLocationData();

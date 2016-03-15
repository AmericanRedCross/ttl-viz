var data;
var locationLookup = {};

d3.select(window).on("resize", throttle);
var throttleTimer;
function throttle() {
  window.clearTimeout(throttleTimer);
    throttleTimer = window.setTimeout(function() {
      // $('.coreByBarangay').empty();
      resize();
    }, 200);
}
function resize() {
  d3.select("#genderPie").select("svg").remove();
  d3.select('#civilPie').select("svg").remove();
  d3.select('#trainingPie').select("svg").remove();
  d3.select('#brgyBars').select("svg").remove();

  buildPies();
}

function clearAllCheckboxes(){
  var allCheckboxes = $.find("input:checkbox");
  $.each(allCheckboxes, function(i, box){ $(box).prop('checked',false); });
  filter();
}

// # Skills Training and Enterprise Development (STED)
// **Summary Chart/Graphs:**
// Participants per training course, Gender Breakdown of participants, Civil Status breakdown of participants, Number of STED participants per barangay

function getLocationData(){
  queryStr = 'SELECT * FROM "TARGET_LOCATION";';
  url = window.location.origin + "/query/" + queryStr ;
  $.get(url, queryStr, function(response){
    $.each(response, function(index, location){
      locationLookup[location['location_id']] = location;
      locationLookup[location['location_id'].slice(0,2)] = location;
    });
    fetchSTED();
  });
}

function ageCheck(input) {
  if(isNaN(new Date(input))){
    return "error calculating"
  } else{
    var today = new Date();
    var birth = new Date(input);
    var age = today.getFullYear() - birth.getFullYear() - 1; // Starting point
    if( birth.getMonth() < today.getMonth() ) { age++;} // If it's past their birth month
    if( birth.getMonth() == today.getMonth() && birth.getDate() <= today.getDate()) { age++; } // If it's past their birth day
    return age;
  }
}

function fetchSTED(){
  queryStr = 'SELECT * FROM "LIVELIHOOD_STED_PARTICIPANT";';
  url = window.location.origin + "/query/" + queryStr ;
  $.get(url, queryStr, function(response){
    data = response;
    var counter = 0;
    data.forEach(function(d){
      // # for the filter to work, if any of the data values are arrays then all data values need to be arrays
      d['civil_status'] = [d['civil_status']];
      d['sex'] = [d['sex']];
      d['training_applied_for'] = [d['training_applied_for']];
      d['location'] = [d['location_id'].slice(0,2), d['location_id'].slice(0,5)];
      counter++;
      if(counter === data.length){ buildFilters(); }
    });
  });
}

function buildFilters(){
  // # get the unique values from the data for all our filter fields
   civilArray = [],
      genderArray = [],
      trainingArray = [],
      locationArray = [];
  $.each(data, function(i,item){
    item['civil_status'].forEach(function(d){
      if($.inArray(d, civilArray) === -1){ civilArray.push(d) }
    });
    item['sex'].forEach(function(d){
      if($.inArray(d, genderArray) === -1){ genderArray.push(d) }
    });
    item['training_applied_for'].forEach(function(d){
      if($.inArray(d, trainingArray) === -1){ trainingArray.push(d) }
    });
    if($.inArray(item['location_id'], locationArray) === -1){ locationArray.push(item['location_id']) }

  });
  // # alphabetize them arrays
  civilArray.sort(d3.ascending);
  genderArray.sort(d3.ascending);
  trainingArray.sort(d3.ascending);
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
  panelHtml('Civil status', 'civil_status', civilArray);
  panelHtml('Gender', 'sex', genderArray);
  panelHtml('Training applied for', 'training_applied_for', trainingArray);
  panelHtml('Location', null, locationArray, true);
  $('.filter-panel.panel-heading').html(panelTitles.join('&nbsp; | &nbsp;'));

  filteredData = data;
  $('#loader').hide();
  buildPies();

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

  drawPies()

}

var pieRadius, genderPie, genderPiePath, civilPie, civilPiePath, trainingPie, trainingPiePath;
function buildPies(){

  var widthOnPage = $('#genderPie').innerWidth();
  var width = (widthOnPage < 300) ? widthOnPage : 300;
  var height = width;
  pieRadius = Math.min(width, height) / 2;

  genderPie = d3.select('#genderPie').append("svg")
      .attr("width", width)
      .attr("height", height)
    .append("g")
      .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");
  genderPiePath = genderPie.selectAll("path");

  civilPie = d3.select('#civilPie').append("svg")
      .attr("width", width)
      .attr("height", height)
    .append("g")
      .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");
  civilPiePath = civilPie.selectAll("path");

  trainingPie = d3.select('#trainingPie').append("svg")
      .attr("width", width)
      .attr("height", height)
    .append("g")
      .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");
  trainingPiePath = trainingPie.selectAll("path");

  buildBars();
};

var brgyBarsMeas, brgyBars, brgyBarsX;
function buildBars(){
  brgyBarsMeas = {top: 20, right: 50, bottom: 20, left: 170, barHeight: 20, width: $('#brgyBars').innerWidth()};
  brgyBars = d3.select('#brgyBars').append('svg')
      .attr("width", brgyBarsMeas.width)

  brgyBarsX = d3.scale.linear()
      .range([0, brgyBarsMeas.width - brgyBarsMeas.left - brgyBarsMeas.right])

  drawPies();
}

function drawPies(){
  /////////////////
  // PIE HELPERS //
  // ########### //
  /////////////////
  function findNeighborArc(i, data0, data1, key) {
    var d;
    return (d = findPreceding(i, data0, data1, key)) ? {startAngle: d.endAngle, endAngle: d.endAngle}
    : (d = findFollowing(i, data0, data1, key)) ? {startAngle: d.startAngle, endAngle: d.startAngle}
    : null;
  }
  // # Find the element in data0 that joins the highest preceding element in data1.
  function findPreceding(i, data0, data1, key) {
    var m = data0.length;
    while (--i >= 0) {
      var k = key(data1[i]);
      for (var j = 0; j < m; ++j) {
        if (key(data0[j]) === k) return data0[j];
      }
    }
  }
  // # Find the element in data0 that joins the lowest following element in data1.
  function findFollowing(i, data0, data1, key) {
    var n = data1.length, m = data0.length;
    while (++i < n) {
      var k = key(data1[i]);
      for (var j = 0; j < m; ++j) {
        if (key(data0[j]) === k) return data0[j];
      }
    }
  }

  function key(d) {
    return d.data.key;
  }

  var pie = d3.layout.pie().sort(null).value(function(d) { return d.values; });

  var arc = d3.svg.arc()
        .outerRadius(pieRadius - 10)
        .innerRadius(0);

  function arcTween(d) {
    var i = d3.interpolate(this._current, d);
    this._current = i(0);
    return function(t) { return arc(i(t)); };
  }

  ////////////////
  // GENDER PIE //
  // ########## //
  ////////////////
  var genderColor = d3.scale.category20().domain(data.map(function(d) { return d['sex'][0]; }))

  var genderPieData = d3.nest()
    .key(function(d) { return d['sex'][0]; })
    .rollup(function(values){
      return values.length
    })
    .entries(filteredData)

  var genderData0 = genderPiePath.data(),
    genderData1 = pie(genderPieData);

  genderPiePath = genderPiePath.data(genderData1, key);

  genderPiePath.enter().append("path")
    .each(function(d, i) { this._current = findNeighborArc(i, genderData0, genderData1, key) || d; })
    .attr("fill", function(d) { return genderColor(d.data.key); })
  .append("title")
    .text(function(d) { return d.data.key; });

  genderPiePath.exit()
    .datum(function(d, i) { return findNeighborArc(i, genderData1, genderData0, key) || d; })
  .transition()
    .duration(750)
    .attrTween("d", arcTween)
    .remove();

  genderPiePath.transition()
    .duration(750)
    .attrTween("d", arcTween);

  // Legend
  var genderLegend = d3.select('#genderLegend').selectAll('div').data(genderPieData, function(d) { return d['key']; });
  // UPDATE
  genderLegend.html(function(d){
    return '<i class="fa fa-square" style="color:' + genderColor(d.key) + '"></i> &nbsp;' + d.key + ' <small>(' + d.values + ')</small>';
  })
  // ENTER
  genderLegend.enter().append('div')
  .attr('class', "legend-item")
  .html(function(d){
    return '<i class="fa fa-square" style="color:' + genderColor(d.key) + '"></i> &nbsp;' + d.key + ' <small>(' + d.values + ')</small>';
  })
  // REMOVE
  genderLegend.exit().remove();
  // sort
  genderLegend.sort(function(a, b) {
    return b.values - a.values;
  })

  //////////////////////
  // CIVIL STATUS PIE //
  // ################ //
  //////////////////////
  var civilColor = d3.scale.category20().domain(data.map(function(d) { return d['civil_status'][0]; }))

  var civilPieData = d3.nest()
    .key(function(d) { return d['civil_status'][0]; })
    .rollup(function(values){
      return values.length
    })
    .entries(filteredData)

  var civilData0 = civilPiePath.data(),
    civilData1 = pie(civilPieData);

  civilPiePath = civilPiePath.data(civilData1, key);

  civilPiePath.enter().append("path")
    .each(function(d, i) { this._current = findNeighborArc(i, civilData0, civilData1, key) || d; })
    .attr("fill", function(d) { return civilColor(d.data.key); })
  .append("title")
    .text(function(d) { return d.data.key; });

  civilPiePath.exit()
    .datum(function(d, i) { return findNeighborArc(i, civilData1, civilData0, key) || d; })
  .transition()
    .duration(750)
    .attrTween("d", arcTween)
    .remove();

  civilPiePath.transition()
    .duration(750)
    .attrTween("d", arcTween);

  // Legend
  var civilLegend = d3.select('#civilLegend').selectAll('div').data(civilPieData, function(d) { return d['key']; });
  // UPDATE
  civilLegend.html(function(d){
    return '<i class="fa fa-square" style="color:' + civilColor(d.key) + '"></i> &nbsp;' + d.key + ' <small>(' + d.values + ')</small>';
  })
  // ENTER
  civilLegend.enter().append('div')
  .attr('class', "legend-item")
  .html(function(d){
    return '<i class="fa fa-square" style="color:' + civilColor(d.key) + '"></i> &nbsp;' + d.key + ' <small>(' + d.values + ')</small>';
  })
  // REMOVE
  civilLegend.exit().remove();
  // sort
  civilLegend.sort(function(a, b) {
    return b.values - a.values;
  })

  //////////////////
  // TRAINING PIE //
  // ############ //
  //////////////////
  var trainingColor = d3.scale.category20().domain(data.map(function(d) { return d['training_applied_for'][0]; }))

  var trainingPieData = d3.nest()
    .key(function(d) { return d['training_applied_for'][0]; })
    .rollup(function(values){
      return values.length
    })
    .entries(filteredData)

  var trainingData0 = trainingPiePath.data(),
    trainingData1 = pie(trainingPieData);

  trainingPiePath = trainingPiePath.data(trainingData1, key);

  trainingPiePath.enter().append("path")
    .each(function(d, i) { this._current = findNeighborArc(i, trainingData0, trainingData1, key) || d; })
    .attr("fill", function(d) { return trainingColor(d.data.key); })
  .append("title")
    .text(function(d) { return d.data.key; });

  trainingPiePath.exit()
    .datum(function(d, i) { return findNeighborArc(i, trainingData1, trainingData0, key) || d; })
  .transition()
    .duration(750)
    .attrTween("d", arcTween)
    .remove();

  trainingPiePath.transition()
    .duration(750)
    .attrTween("d", arcTween);

  // Legend
  var trainingLegend = d3.select('#trainingLegend').selectAll('div').data(trainingPieData, function(d) { return d['key']; });
  // UPDATE
  trainingLegend.html(function(d){
    return '<i class="fa fa-square" style="color:' + trainingColor(d.key) + '"></i> &nbsp;' + d.key.toLowerCase() + ' <small>(' + d.values + ')</small>';
  })
  // ENTER
  trainingLegend.enter().append('div')
  .attr('class', "legend-item")
  .html(function(d){
    return '<i class="fa fa-square" style="color:' + trainingColor(d.key) + '"></i> &nbsp;' + d.key.toLowerCase() + ' <small>(' + d.values + ')</small>';
  })
  // REMOVE
  trainingLegend.exit().remove();
  // sort
  trainingLegend.sort(function(a, b) {
    return b.values - a.values;
  })

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
      .text(function(d) {
        if(locationLookup[d.key] === undefined){ return d.key; }
        else { return locationLookup[d.key].barangay + ", " + locationLookup[d.key].municipality; }
      });
  g.select(".brgy-total").transition().duration(1000).ease("sin-in-out")
      .attr("x", function(d) { return brgyBarsX(d.values) + 3; })
      .text(function(d) { return d.values; });

  g.exit().remove();

  buildList();

}

function buildList(){

  $('#listTable').empty();
  $('#listTable').html('<table data-sortable id="dataTable" class="sortable-theme-minimal">' +
        '<thead><th>HH ID</th><th>First name</th><th>Last name</th><th>Course</th><th>Details</th></tr></thead><tbody></tbody></table>')
  $.each(filteredData, function(i,d){
    var rowHtml = '<tr>' +
      '<td>' + d.household_id + '</td>' +
      '<td>' + d.participant_fname + '</td>' +
      '<td>' + d.participant_lname + '</td>' +
      '<td>' + d.training_applied_for + '</td>' +
      '<td><button type="button" class="btn btn-default" data-toggle="modal" data-target="#sted-modal" data-id="' + d.id +
      '"><b class="fa fa-info"></b></button></td>' +
      '</tr>';
    $('#listTable tbody').append(rowHtml);
  });

    $('#sted-modal').on('show.bs.modal', function (event) {
      var buttonId = $(event.relatedTarget).data('id').toString(); // data-id attribute for the button that triggered the modal
      var modal = $(this);
      for(i=0;i<filteredData.length;i++){
        if(buttonId === filteredData[i]['id']){
          var hhId = filteredData[i].household_id.toString();
          var name = filteredData[i].participant_fname + " ";
          name += (filteredData[i].participant_mname !== null) ? filteredData[i].participant_mname + " " : "";
          name += filteredData[i].participant_lname;
          modal.find('.modal-title').html(name);
          var location = (locationLookup[filteredData[i].location_id] === undefined) ? "not known" : locationLookup[filteredData[i].location_id].barangay + ", " +
            locationLookup[filteredData[i].location_id].municipality;
          var detailsHtml = "<b>Training applied for:</b> " + filteredData[i].training_applied_for + "<br>" +
            "<b>Contact number:</b> " + filteredData[i].contact_no + "<br>" +
            "<b>Start date:</b> " + filteredData[i].start_date + "<br>" +
            "<b>Gender:</b> " + filteredData[i].sex + "<br>" +
            "<b>Civil status:</b> " + filteredData[i].civil_status + "<br>" +
            "<b>Birth date:</b> " + filteredData[i].birthdate + "<br>" +
            "<b>Age:</b> " + ageCheck(filteredData[i].birthdate) + "<br>" +
            "<b>Household location:</b> " + location + "<br>";
          modal.find('.modal-body p').html(detailsHtml);
          break;
        }
      }
    });

  $('#dataTable').DataTable();

}

getLocationData();

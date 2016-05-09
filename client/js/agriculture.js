var data, filteredData, dateData;
var locationLookup = {};

// # HELPERS
function adminText(locationId, type){
  if(locationLookup[locationId] === undefined){ return "no data"}
  else if (type === "muni") {
    return locationLookup[locationId].municipality;
  } else if (type === "brgy") {
    return locationLookup[locationId].barangay;
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
  d3.select('#knowledgechangePie').select("svg").remove();
  d3.select('#perTrainingPie').select("svg").remove();
  d3.select('#knowLine').select("svg").remove();
  buildPies();
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
  $.get('query/agriculturetraining', function(response){
    data = response;
    var counter = 0;
    data.forEach(function(d){
      // calculate the value of score change
      if( isNaN(parseFloat(d['score_posttest'])) || isNaN(parseFloat(d['score_pretest'])) ) {
        d['score_change'] = 'data missing';
      } else {
        d['score_change'] = parseFloat(d['score_posttest']) - parseFloat(d['score_pretest']);
      }
      // calculate the cateogory of change
      if (d['score_change'] === 'data missing') {
        d['knowledge_change'] = ['data missing'];
      } else if (d['score_change'] > 0 ) {
        d['knowledge_change'] = ['increase'];
      } else if (d['score_change'] < 0 ) {
        d['knowledge_change'] = ['decrease'];
      } else if (d['score_change'] === 0 ) {
        d['knowledge_change'] = ['maintain'];
      }
      // # for the filter to work all the filtered data values need to be arrays even if all possibilities are just 1 value
      // # this is keeping the option of filtering on 'proposed_items' open which is a comma seperated data field
      d['training_name'] = [d['training_name']];
      d['training_id'] = [d['training_id']];
      d['location'] = (d['location_id'] === null) ? ['data missing','data missing'] : [d['location_id'].slice(0,2), d['location_id'].slice(0,5)];
      counter++;
      if(counter === data.length){ buildFilters(); }
    });
  });
}

function buildFilters(){
  // # get the unique values from the data for all our filter fields
  var trainingnameArray = [],
      trainingidArray = [],
      knowledgechangeArray = [],
      locationArray = [];
  $.each(data, function(i,item){
    item['training_name'].forEach(function(d){
      if($.inArray(d, trainingnameArray) === -1){ trainingnameArray.push(d) }
    });
    item['training_id'].forEach(function(d){
      if($.inArray(d, trainingidArray) === -1){ trainingidArray.push(d) }
    });
    item['knowledge_change'].forEach(function(d){
      if($.inArray(d, knowledgechangeArray) === -1){ knowledgechangeArray.push(d) }
    });
    if($.inArray(item['location_id'], locationArray) === -1){ locationArray.push(item['location_id']) }

  });
  // # alphabetize them arrays
  trainingnameArray.sort(d3.ascending);
  trainingidArray.sort(d3.ascending);
  knowledgechangeArray.sort(d3.ascending);
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
  panelHtml('Training name', 'training_name', trainingnameArray);
  panelHtml('Training ID', 'training_id', trainingidArray);
  panelHtml('Knowledge change', 'knowledge_change', knowledgechangeArray);
  panelHtml('Location', null, locationArray, true);
  $('.filter-panel.panel-heading').html(panelTitles.join('&nbsp; | &nbsp;'));

  filteredData = data;
  $('#loader').hide();
  // buildBars();
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

var pieRadius, knowledgechangePie, knowledgechangePiePath, perTrainingPie, perTrainingPiePath;
function buildPies(){

  var widthOnPage = $('#knowledgechangePie').innerWidth();
  var width = (widthOnPage < 300) ? widthOnPage : 300;
  var height = width;
  pieRadius = Math.min(width, height) / 2;

  knowledgechangePie = d3.select('#knowledgechangePie').append("svg")
      .attr("width", width)
      .attr("height", height)
    .append("g")
      .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");
  knowledgechangePiePath = knowledgechangePie.selectAll("path");

  perTrainingPie = d3.select('#perTrainingPie').append("svg")
      .attr("width", width)
      .attr("height", height)
    .append("g")
      .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");
  perTrainingPiePath = perTrainingPie.selectAll("path");

  buildBars();
};


var brgyBarsMeas, brgyBars, brgyBarsX;
function buildBars(){
  brgyBarsMeas = {top: 20, right: 50, bottom: 20, left: 170, barHeight: 20, width: $('#brgyBars').innerWidth()};
  brgyBars = d3.select('#brgyBars').append('svg')
      .attr("width", brgyBarsMeas.width)

  brgyBarsX = d3.scale.linear()
      .range([0, brgyBarsMeas.width - brgyBarsMeas.left - brgyBarsMeas.right])


  buildKnowledgeLine()

}

var knowLineMeas, knowLineSvg, knowLineY, knowLineX, knowY, knowYaxis;
function buildKnowledgeLine(){

    var changeExt = d3.extent(data, function(d){ return d.score_change; });
    var maxChange = (Math.abs(changeExt[0]) > Math.abs(changeExt[1])) ?  Math.abs(changeExt[0]) : Math.abs(changeExt[1]);

    knowLineMeas = {top: 20, right: 60, bottom: 20, left: 60,
      height: 250 - 40, width: $('#knowLine').innerWidth() - 60 - 60 };
    knowLineMeas.barWidth = knowLineMeas.width / (maxChange * 2),
    knowLineSvg = d3.select('#knowLine').append('svg')
      .attr("width", knowLineMeas.width + knowLineMeas.left + knowLineMeas.right)
      .attr("height", knowLineMeas.height + knowLineMeas.top + knowLineMeas.bottom)
      .append('g').attr("transform", "translate(" + knowLineMeas.left + "," + knowLineMeas.top + ")");




    knowLineY = d3.scale.linear()
      .range([knowLineMeas.height, 0])
    knowLineX = d3.scale.linear()
      .range([0,knowLineMeas.width])
      .domain([-maxChange, maxChange])

    var xAxis = d3.svg.axis()
      .scale(knowLineX)
      .orient("bottom");
    knowLineSvg.append("g")
      .attr("class", "x kaxis")
      .attr("transform", "translate(" + (knowLineMeas.barWidth / 2) + "," + knowLineMeas.height + ")")
      .call(xAxis);

    knowY = d3.svg.axis()
      .scale(knowLineY).tickFormat(d3.format("d"))
      .orient("left");

    knowYaxis = knowLineSvg.append("g")
      .attr("class", "y kaxis")

    knowYaxis.append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", 6)
      .attr("dy", ".71em")
      .style("text-anchor", "end")
      .text("Participants");


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

  //////////////////
  // CATEGORY PIE //
  // ############ //
  //////////////////
  var knowledgechangeColor = d3.scale.category20().domain(data.map(function(d) { return d['knowledge_change'][0]; }))
  var knowledgechangeColor = function(key){
    switch(key) {
      case "increase":
        return "#91cf60";
        break;
      case "decrease":
        return "#fc8d59";
        break;
      case "maintain":
        return "#ffffbf";
        break;
      default:
        return "#e0e0e0";
    }


  }

  var knowledgechangePieData = d3.nest()
    .key(function(d) { return d['knowledge_change'][0]; })
    .rollup(function(values){
      return values.length
    })
    .entries(filteredData)

  var categoryData0 = knowledgechangePiePath.data(),
    categoryData1 = pie(knowledgechangePieData);

  knowledgechangePiePath = knowledgechangePiePath.data(categoryData1, key);

  knowledgechangePiePath.enter().append("path")
    .each(function(d, i) { this._current = findNeighborArc(i, categoryData0, categoryData1, key) || d; })
    .attr("fill", function(d) { return knowledgechangeColor(d.data.key); })
  .append("title")
    .text(function(d) { return d.data.key; });

  knowledgechangePiePath.exit()
    .datum(function(d, i) { return findNeighborArc(i, categoryData1, categoryData0, key) || d; })
  .transition()
    .duration(750)
    .attrTween("d", arcTween)
    .remove();

  knowledgechangePiePath.transition()
    .duration(750)
    .attrTween("d", arcTween);

  // Legend
  var knowledgechangeLegend = d3.select('#knowledgechangeLegend').selectAll('div').data(knowledgechangePieData, function(d) { return d['key']; });
  // UPDATE
  knowledgechangeLegend.html(function(d){
    return '<i class="fa fa-square" style="color:' + knowledgechangeColor(d.key) + '"></i> &nbsp;' + d.key + ' <small>(' + d.values + ')</small>';
  })
  // ENTER
  knowledgechangeLegend.enter().append('div')
  .attr('class', "legend-item")
  .html(function(d){
    return '<i class="fa fa-square" style="color:' + knowledgechangeColor(d.key) + '"></i> &nbsp;' + d.key + ' <small>(' + d.values + ')</small>';
  })
  // REMOVE
  knowledgechangeLegend.exit().remove();
  // sort
  knowledgechangeLegend.sort(function(a, b) {
    return b.values - a.values;
  })

  //////////////////////
  // PER TRAINING PIE //
  // ################ //
  //////////////////////
  var perTrainingColor = d3.scale.category20().domain(data.map(function(d) { return d['training_name'][0]; }))

  var perTrainingData = d3.nest()
    .key(function(d) { return d['training_name'][0]; })
    .rollup(function(values){
      return values.length
    })
    .entries(filteredData)

  var perTrainingData0 = perTrainingPiePath.data(),
    perTrainingData1 = pie(perTrainingData);

  perTrainingPiePath = perTrainingPiePath.data(perTrainingData1, key);

  perTrainingPiePath.enter().append("path")
    .each(function(d, i) { this._current = findNeighborArc(i, perTrainingData0, perTrainingData1, key) || d; })
    .attr("fill", function(d) { return perTrainingColor(d.data.key); })
  .append("title")
    .text(function(d) { return d.data.key; });

  perTrainingPiePath.exit()
    .datum(function(d, i) { return findNeighborArc(i, perTrainingData1, perTrainingData0, key) || d; })
  .transition()
    .duration(750)
    .attrTween("d", arcTween)
    .remove();

  perTrainingPiePath.transition()
    .duration(750)
    .attrTween("d", arcTween);

  // Legend
  var perTrainingLegend = d3.select('#perTrainingLegend').selectAll('div').data(perTrainingData, function(d) { return d['key']; });
  // UPDATE
  perTrainingLegend.html(function(d){
    return '<i class="fa fa-square" style="color:' + perTrainingColor(d.key) + '"></i> &nbsp;' + d.key + ' <small>(' + d.values + ')</small>';
  })
  // ENTER
  perTrainingLegend.enter().append('div')
  .attr('class', "legend-item")
  .html(function(d){
    return '<i class="fa fa-square" style="color:' + perTrainingColor(d.key) + '"></i> &nbsp;' + d.key + ' <small>(' + d.values + ')</small>';
  })
  // REMOVE
  perTrainingLegend.exit().remove();
  // sort
  perTrainingLegend.sort(function(a, b) {
    return b.values - a.values;
  })

  //
  drawBars();
}

function drawBars(){
  // get sume of participants per brgy
  var brgyBarsData = d3.nest()
    .key(function(d) { if(d['location_id'] === null){ return 'data missing'} else { return d['location_id']; } })
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

  // drawTimeline();
  drawKnowLine();

}

function drawKnowLine(){

  var knowLineData = d3.nest()
      .key(function(d) { return Math.round(parseFloat(d.score_change)); } )
      .rollup(function(values) { return values.length; })
      .entries(filteredData.filter(function(d){ return d.score_change !== "data missing"}));
  knowLineData.forEach(function(d){
    d.key = parseFloat(d.key);
  });
  knowLineData.sort(function(a,b){
    return a.key - b.key
  });

  knowLineY.domain(d3.extent(knowLineData, function(d){ return d.values }))

  knowYaxis.call(knowY)

  var g = knowLineSvg.selectAll(".bar")
        .data(knowLineData, function(d){ return d['key']; })

  g.enter().append("rect").transition().duration(1000).ease("sin-in-out")
        .attr("class", "bar")
        .attr("x", function(d) { return knowLineX(d.key) + 1; })
        .attr("width", knowLineMeas.barWidth - 2)
        .attr("y", function(d) { return knowLineY(d.values); })
        .attr("height", function(d) { return knowLineMeas.height - knowLineY(d.values) + 1; });

  g.exit().remove();


  buildList();

}

function buildList(){

  $('#listTable').empty();
  $('#listTable').html('<table data-sortable id="dataTable" class="compact sortable-theme-minimal">' +
        '<thead><tr><th>First</th><th>Last</th><th>Barangay</th><th>Municipality</th><th>Training</th><th>Pre</th><th>Post</th><th>Change</th><th>Change</th></tr></thead>' +
        '<tfoot><tr><th>First</th><th>Last</th><th>Barangay</th><th>Municipality</th><th>Training</th><th>Pre</th><th>Post</th><th>Change</th><th>Change</th></tr></tfoot>' +
        '<tbody></tbody></table>')

  var readableTime = d3.time.format("%d-%b-%Y");

  $.each(filteredData, function(i,d){
    var rowHtml = '<tr>' +
      '<td>' + d.participant_fname + '</td>' +
      '<td>' + d.participant_lname + '</td>' +
      '<td>' + adminText(d.location_id, 'brgy') + '</td>' +
      '<td>' + adminText(d.location_id, 'muni') + '</td>' +
      '<td>' + d.training_name[0] + '</td>' +
      '<td>' + d.score_pretest+ '</td>' +
      '<td>' + d.score_posttest + '</td>' +
      '<td>' + d.score_change + '</td>' +
      '<td>' + d.knowledge_change[0] + '</td>' +
      '</tr>';
    $('#listTable tbody').append(rowHtml);
  });

  var table = $('#dataTable').DataTable({"sDom":'lrtip'});

  var readableTime = d3.time.format("%d-%b-%Y");

  $('#dataTable tfoot th').each(function(){
    var title = $(this).text();
    $(this).html('<input type="text" placeholder="'+title+'" />');
  });

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

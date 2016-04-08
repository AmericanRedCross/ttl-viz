var data, filteredData;
var locationLookup = {};

var commaSeperator = d3.format(",");

d3.select(window).on("resize", throttle);
var throttleTimer;
function throttle() {
  window.clearTimeout(throttleTimer);
    throttleTimer = window.setTimeout(function() {
      $('.coreByBarangay').empty();
      resize();
    }, 200);
}
function resize() {
  d3.select("#categoryPie").select("svg").remove();
  d3.select('#cgiPie').select("svg").remove();
  d3.select('#amountPie').select("svg").remove();
  d3.select('#brgyBars').select("svg").remove();

  buildPies();
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
  $.get('query/sra', function(response){
    data = response;
    var counter = 0;
    data.forEach(function(d){
      // # for the filter to work all the filtered data values need to be arrays even if all possibilities are just 1 value
      // # this is keeping the option of filtering on 'proposed_items' open which is a comma seperated data field
      d['c_u_category'] = [d['c_u_category']];
      d['c_u_amount_assigned'] = [d['c_u_amount_assigned']];
      d['c_u_number_of_CGI'] = [d['c_u_number_of_CGI']];
      d['location_id'] = [d['c_u_household_id'].slice(0,5)];
      d['location'] = [d['c_u_household_id'].slice(0,2), d['c_u_household_id'].slice(0,5)];
      // # get the names
      $.post('/query/namefromid', {"id": d.c_u_household_id}, function(response){
        // # response should be an array containing one object
        for(var key in response[0]){
          d[key] = response[0][key];
        }
        counter++;
        if(counter === data.length){ buildFilters(); }
      });

    });


  });
}

function buildFilters(){
  // # get the unique values from the data for all our filter fields
  var categoryArray = [],
      amountArray = [],
      cgiArray = [],
      locationArray = [];
  $.each(data, function(i,item){
    item['c_u_category'].forEach(function(d){
      if($.inArray(d, amountArray) === -1){ amountArray.push(d) }
    });
    item['c_u_amount_assigned'].forEach(function(d){
      if($.inArray(d, categoryArray) === -1){ categoryArray.push(d) }
    });
    item['c_u_number_of_CGI'].forEach(function(d){
      if($.inArray(d, cgiArray) === -1){ cgiArray.push(d) }
    });
    item['location_id'].forEach(function(d){
      if($.inArray(d, locationArray) === -1){ locationArray.push(d) }
    });

  });
  // # alphabetize them arrays
  categoryArray.sort(d3.ascending);
  amountArray.sort(function(a, b) { return a - b; });
  cgiArray.sort(function(a, b) { return a - b; });
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
  panelHtml('Category', 'c_u_category', categoryArray);
  panelHtml('Amount assigned', 'c_u_amount_assigned', amountArray);
  panelHtml('Number of CGI', 'c_u_number_of_CGI', cgiArray);
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
  console.log(filteredData.length)

  drawPies()

}


var pieRadius, categoryPie, categoryPiePath, cgiPie, cgiPiePath, amountPie, amountPiePath;
function buildPies(){

  var widthOnPage = $('#categoryPie').innerWidth();
  var width = (widthOnPage < 300) ? widthOnPage : 300;
  var height = width;
  pieRadius = Math.min(width, height) / 2;

  categoryPie = d3.select('#categoryPie').append("svg")
      .attr("width", width)
      .attr("height", height)
    .append("g")
      .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");
  categoryPiePath = categoryPie.selectAll("path");

  cgiPie = d3.select('#cgiPie').append("svg")
      .attr("width", width)
      .attr("height", height)
    .append("g")
      .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");
  cgiPiePath = cgiPie.selectAll("path");

  amountPie = d3.select('#amountPie').append("svg")
      .attr("width", width)
      .attr("height", height)
    .append("g")
      .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");
  amountPiePath = amountPie.selectAll("path");

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

  //////////////////
  // CATEGORY PIE //
  // ############ //
  //////////////////
  var categoryColor = d3.scale.category20().domain(data.map(function(d) { return d['c_u_category'][0]; }))

  var categoryPieData = d3.nest()
    .key(function(d) { return d['c_u_category'][0]; })
    .rollup(function(values){
      return values.length
    })
    .entries(filteredData)

  var categoryData0 = categoryPiePath.data(),
    categoryData1 = pie(categoryPieData);

  categoryPiePath = categoryPiePath.data(categoryData1, key);

  categoryPiePath.enter().append("path")
    .each(function(d, i) { this._current = findNeighborArc(i, categoryData0, categoryData1, key) || d; })
    .attr("fill", function(d) { return categoryColor(d.data.key); })
  .append("title")
    .text(function(d) { return d.data.key; });

  categoryPiePath.exit()
    .datum(function(d, i) { return findNeighborArc(i, categoryData1, categoryData0, key) || d; })
  .transition()
    .duration(750)
    .attrTween("d", arcTween)
    .remove();

  categoryPiePath.transition()
    .duration(750)
    .attrTween("d", arcTween);

  // Legend
  var categoryLegend = d3.select('#categoryLegend').selectAll('div').data(categoryPieData, function(d) { return d['key']; });
  // UPDATE
  categoryLegend.html(function(d){
    return '<i class="fa fa-square" style="color:' + categoryColor(d.key) + '"></i> &nbsp;' + d.key + ' <small>(' + d.values + ')</small>';
  })
  // ENTER
  categoryLegend.enter().append('div')
  .attr('class', "legend-item")
  .html(function(d){
    return '<i class="fa fa-square" style="color:' + categoryColor(d.key) + '"></i> &nbsp;' + d.key + ' <small>(' + d.values + ')</small>';
  })
  // REMOVE
  categoryLegend.exit().remove();
  // sort
  categoryLegend.sort(function(a, b) {
    return b.values - a.values;
  })

  /////////////
  // CGI PIE //
  // ####### //
  /////////////
  var cgiColor = d3.scale.category20().domain(data.map(function(d) { return d['c_u_number_of_CGI'][0]; }))

  var cgiPieData = d3.nest()
    .key(function(d) { return d['c_u_number_of_CGI'][0]; })
    .rollup(function(values){
      return values.length
    })
    .entries(filteredData)

  var cgiData0 = cgiPiePath.data(),
    cgiData1 = pie(cgiPieData);

  cgiPiePath = cgiPiePath.data(cgiData1, key);

  cgiPiePath.enter().append("path")
    .each(function(d, i) { this._current = findNeighborArc(i, cgiData0, cgiData1, key) || d; })
    .attr("fill", function(d) { return cgiColor(d.data.key); })
  .append("title")
    .text(function(d) { return d.data.key; });

  cgiPiePath.exit()
    .datum(function(d, i) { return findNeighborArc(i, cgiData1, cgiData0, key) || d; })
  .transition()
    .duration(750)
    .attrTween("d", arcTween)
    .remove();

  cgiPiePath.transition()
    .duration(750)
    .attrTween("d", arcTween);

  // Legend
  var cgiLegend = d3.select('#cgiLegend').selectAll('div').data(cgiPieData, function(d) { return d['key']; });
  // UPDATE
  cgiLegend.html(function(d){
    return '<i class="fa fa-square" style="color:' + cgiColor(d.key) + '"></i> &nbsp;' + d.key + ' <small>(' + d.values + ')</small>';
  })
  // ENTER
  cgiLegend.enter().append('div')
  .attr('class', "legend-item")
  .html(function(d){
    return '<i class="fa fa-square" style="color:' + cgiColor(d.key) + '"></i> &nbsp;' + d.key + ' <small>(' + d.values + ')</small>';
  })
  // REMOVE
  cgiLegend.exit().remove();
  // sort
  cgiLegend.sort(function(a, b) {
    return b.values - a.values;
  })

  //////////////////
  // AMOUNT PIE //
  // ############ //
  //////////////////
  var amountColor = d3.scale.category20().domain(data.map(function(d) { return d['c_u_amount_assigned'][0]; }))

  var amountPieData = d3.nest()
    .key(function(d) { return d['c_u_amount_assigned'][0]; })
    .rollup(function(values){
      return values.length
    })
    .entries(filteredData)

  var amountData0 = amountPiePath.data(),
    amountData1 = pie(amountPieData);

  amountPiePath = amountPiePath.data(amountData1, key);

  amountPiePath.enter().append("path")
    .each(function(d, i) { this._current = findNeighborArc(i, amountData0, amountData1, key) || d; })
    .attr("fill", function(d) { return amountColor(d.data.key); })
  .append("title")
    .text(function(d) { return d.data.key; });

  amountPiePath.exit()
    .datum(function(d, i) { return findNeighborArc(i, amountData1, amountData0, key) || d; })
  .transition()
    .duration(750)
    .attrTween("d", arcTween)
    .remove();

  amountPiePath.transition()
    .duration(750)
    .attrTween("d", arcTween);

  // Legend
  var amountLegend = d3.select('#amountLegend').selectAll('div').data(amountPieData, function(d) { return d['key']; });
  // UPDATE
  amountLegend.html(function(d){
    return '<i class="fa fa-square" style="color:' + amountColor(d.key) + '"></i> &nbsp;' + commaSeperator(d.key) + ' <small>(' + d.values + ')</small>';
  })
  // ENTER
  amountLegend.enter().append('div')
  .attr('class', "legend-item")
  .html(function(d){
    return '<i class="fa fa-square" style="color:' + amountColor(d.key) + '"></i> &nbsp;' + commaSeperator(d.key) + ' <small>(' + d.values + ')</small>';
  })
  // REMOVE
  amountLegend.exit().remove();
  // sort
  amountLegend.sort(function(a, b) {
    return b.values - a.values;
  })
  //
  drawBars();
}

function drawBars(){
  // get sume of grants per brgy
  var brgyBarsData = d3.nest()
    .key(function(d) { return d['c_u_household_id'].slice(0,5); })
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
      .text(function(d) { return d.values; });

  g.exit().remove();

  buildList();

}

function buildList(){

  $('#listTable').empty();
  $('#listTable').html('<table data-sortable id="dataTable" class="sortable-theme-minimal">' +
        '<thead><tr><th>Last</th><th>First</th><th>Category</th><th>Amount assigned</th><th>CGI</th><th>Household ID</th></tr></thead><tbody></tbody></table>')
  $.each(filteredData, function(i,d){
    var rowHtml = '<tr>' +
      '<td>' + d['head_of_hh_lname'] + '</td>' +
      '<td>' + d['head_of_hh_fname'] + '</td>' +
      '<td>' + d['c_u_category'] + '</td>' +
      '<td>' + commaSeperator(d['c_u_amount_assigned']) + '</td>' +
      '<td>' + d['c_u_number_of_CGI'] + '</td>' +
      '<td>' + d['c_u_household_id'] + '</td>' +
      '</tr>';
    $('#listTable tbody').append(rowHtml);
  });

  $('#dataTable').DataTable();


}

getLocationData();

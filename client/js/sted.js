// # Skills Training and Enterprise Development (STED)
// **Summary Chart/Graphs:**
// Participants per training course, Gender Breakdown of participants, Civil Status breakdown of participants, Number of STED participants per barangay

var data;
var locationLookup = {};

function getLocationData(){
  queryStr = 'SELECT * FROM "TARGET_LOCATION";';
  url = window.location.origin + "/query/" + queryStr ;
  $.get(url, queryStr, function(response){
    $.each(response, function(index, location){
      locationLookup[location.location_id] = location;
    });
    fetchSTED();
  });
}

function fetchSTED(){
  queryStr = 'SELECT * FROM "LIVELIHOOD_STED_PARTICIPANT";';
  url = window.location.origin + "/query/" + queryStr ;
  $.get(url, queryStr, function(response){
    data = response;
    vizTable();
  });
}



function vizTable(){

  $('#beneficiaryTable').html("<thead><tr>" +
    "<th>HH ID</th>" +
    "<th>First name</th>" +
    "<th>Last name</th>" +
    "<th>Course</th>" +
    "<th>Details</th>" +
    "</tr></thead><tbody></tbody>");

  d3.select('#beneficiaryTable tbody').selectAll('tr')
    .data(data).enter()
    .append('tr')
    .html(function(d){
      return "<td>" + d.household_id + "</td>" +
      "<td>" + d.participant_fname + "</td>" +
      "<td>" + d.participant_lname + "</td>" +
      "<td>" + d.training_applied_for + "</td>" +
      '<td><button type="button" class="btn btn-default" data-toggle="modal" data-target="#sted-modal" data-id="' + d.id +
      '"><b class="fa fa-info"></b></button></td>';
    });

  var ageCheck = function(input) {
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

  $('#sted-modal').on('show.bs.modal', function (event) {
    var buttonId = $(event.relatedTarget).data('id').toString(); // data-id attribute for the button that triggered the modal
    var modal = $(this);
    for(i=0;i<data.length;i++){
      if(buttonId === data[i]['id']){
        var hhId = data[i].household_id.toString();
        var name = data[i].participant_fname + " ";
        name += (data[i].participant_mname.length > 0) ? data[i].participant_mname + " " : "";
        name += data[i].participant_lname;
        modal.find('.modal-title').html(name);
        var location = (locationLookup[data[i].location_id] === undefined) ? "not known" : locationLookup[data[i].location_id].barangay + ", "
        + locationLookup[data[i].location_id].municipality;
        var detailsHtml = "<b>Training applied for:</b> " + data[i].training_applied_for + "<br>" +
          "<b>Contact number:</b> " + data[i].contact_no + "<br>" +
          "<b>Start date:</b> " + data[i].start_date + "<br>" +
          "<b>Sex:</b> " + data[i].sex + "<br>" +
          "<b>Civil status:</b> " + data[i].civil_status + "<br>" +
          "<b>Birth date:</b> " + data[i].birthdate + "<br>" +
          "<b>Age:</b> " + ageCheck(data[i].birthdate) + "<br>" +
          "<b>Household location:</b> " + location + "<br>";
        modal.find('.modal-body p').html(detailsHtml);
        break;
      }
    }
});

  $('#beneficiaryTable').DataTable();

}

getLocationData();

var reports = {};

reports.list_all_tables = "SELECT table_name FROM information_schema.tables \
WHERE table_schema='public' AND table_type='BASE TABLE';";

reports.retrieve_locations = "SELECT ST_AsGeoJSON(geom) as shape FROM enumeration";

reports.shelter = "SELECT * FROM core_shelter_100_percent_completion";

reports.household_list = 'SELECT * FROM "HOUSEHOLD"';

try{
  module.exports = reports;
}
catch(e){

}

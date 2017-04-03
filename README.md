# user-auth
express, handlebars, sqlite, passport, foundation


### permission levels
- user
- editor
  - add/edit images in gallery
  - add/edit documents
- admin
  - all lower permissions, add/edit users


### deployment
- `npm install` to install node dependencies
- `gulp` to build stylesheets
- need postgres running
- change the permissions of the db, backups and tmp folders so the app can write to it, e.g. `sudo chown -R ubuntu:ubuntu /ttl-viz/db/` `sudo chown -R ubuntu:ubuntu /ttl-viz/backups/` and `sudo chown -R ubuntu:ubuntu /ttl-viz/tmp/` (there are better user management practices for your server)
- after running the app once with sudo to generate the sqlite db files you can change permission to make those writeable and then shouldn't have to run the app using sudo again, eg. `sudo chown -R ubuntu:ubuntu /ttl-viz/db/sessions.db` and `sudo chown -R ubuntu:ubuntu /ttl-viz/db/site.db`
- adjust commented out `var` on lines 66-69 in `routes/postGresRefresh.js`
- create `settings.js` file from `settings.js.example` and adjust settings for your deployment
- use PM2 or something similar to keep the app up and running

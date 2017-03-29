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
- need postgres running
- change the permissions of the backups and tmp folders so the app can write to it, e.g. `sudo chown -R ubuntu:ubuntu /ttl-viz/backups/` and `sudo chown -R ubuntu:ubuntu /ttl-viz/tmp/`
- adjust commented out `var` on lines 66-69 in `routes/postGresRefresh.js`
- create `settings.js` file from `settings.js.example` and adjust settings for your deployment
!!!

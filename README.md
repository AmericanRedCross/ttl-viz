### ttl-viz

- `sudo npm install` to get all the node modules
- change the permissions of the backups and tmp folders so the app can write to it `sudo chown -R ubuntu:ubuntu /ttl-viz/backups/` and `sudo chown -R ubuntu:ubuntu /ttl-viz/tmp/`
- create a config.js file from config.js.example and adjust settings for your deployment
- start mongo and postgres
- install imagemagick and graphicsmagick on your system

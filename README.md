
**American Red Cross and Kevin Lustig**

## Installation

**Install via NPM**

```console
npm install
```

**Start mongo and postgres databases**

**Start the application**

```console
node server
```

**Visit the application in your browser**

If you used port 80, the URL should simply be the IP address or URL of the server where you're running the application

```console
http://www.mydomain.com
```

If you used any other port, specify the port along with the IP address/URL (or set up a Virtual Host as appropriate to redirect traffic to the correct port)

```console
http://www.myassetmanager.com:myport
```

e.g.,

```console
http://www.redcross.org:8888
```

**Log in with the default super user**

```console
default/123
```

**Go to /users and create a new user**

***Very Important:*** **Delete the default super user**

## Run the Application

You'll want to keep the application up and running on your server. There are multiple tools that will help you do this. We recommend [PM2](https://github.com/Unitech/pm2) or [Forever](https://github.com/foreverjs/forever).

### PM2

**Install PM2**

```console
sudo npm install pm2 -g
```

**Start the App**

From the directory where the Asset Manager is installed:

```console
pm2 start server.js
```

**Restart the Asset Manager with your server**

To have the Asset Manager restart itself after a reboot, server downtime, etc., you can generate a startup script.

Check the [PM2 documentation](https://github.com/Unitech/pm2#startup-script-generation) on this for more details.

## Customizing the Interface

All local resources for the default Asset Manager interface are in the "client" directory.

**Templates**

Most pages are templated using Handlebars in conjunction with Express from within the Node application. These templates can be found in the "views" directory.

Components of the interface that display data fetched via AJAX (right now, just the create/edit modals) are rendered via Handlebars in the browser. These templates can be found in the "client/js/views" directory.

**Logos**

A Handlebars helper displays the logos in the footer. It scrapes the "client/media/logos" directory for files and displays each as an image.

To modify these logos, simply add or remove files from that directory.

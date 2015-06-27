# Disaster Asset Manager

**American Red Cross and Kevin Lustig**

A Node.js server that enables storing and maintaining assets for disaster relief such as situation reports and maps. Assets can be accessed for display and use via a robust API.

## Installation

### In the project directory, simply install via NPM

```console
npm install
```

### Configure the application by modifying **config.js** in the project directory. 

**siteName**: The name of the site as it will be displayed to your users in the site header.

**description**: The description of the site as it will be displayed to your users on the homepage.

**db**: The name of the MongoDB database you will use for this application (will store users, assets, and asset files.) When you start the application for the first time, this database will be created if it doesn't already exist.

**port**: The port at which to run the application's public-facing server. If you do not have any other HTTP activity on your server, use port **80**. 

**asset_opts > extents**: Available geographic area tags that can be applied to your assets for filtering and sorting. 

**asset_opts > sectors**: Available keyword tags that can be applied to your assets for filtering and sorting.

### Start the application

```console
node server
```

### Visit the application in your browser

If you used port 80, the URL should simply be the IP address or URL of the server where you're running the application

```console
http://www.mydomain.com
```

If you used any other port, specify the port along with the IP address/URL (or set up a Virtual Host as appropriate to redirect traffic to the correct port)

```console
http://www.mydomain.com:myport
```

e.g.,

```console
http://www.redcross.org:8888
```

### Log in with the default super user

Username: defaultUser@redcross.org

Password: pa$$w0rd

### Go to /users and create a new user

### **Very Important:** Delete the default super user
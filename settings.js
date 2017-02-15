var settings = {}

settings.page = {
	siteName: "Tindog Tabang Leyteno",
	description: "Use this site to view progress of TTL programs.",
  nginxlocation: "/"
// nginxlocation: "/ttl/"
}

settings.app = {
  defaultpass: '123',
  defaultuser: 'me',
	port: 3001,
	db: 'site.db'
}

module.exports = settings;

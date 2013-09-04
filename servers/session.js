var express = require('express');

// Session
// =======
module.exports = function(db) {
	var server = express();

	// Routes
	// ======

	// Linking
	server.all('/',
		function (req, res, next) {
			// Set links
			res.setHeader('Link', [
				'<http://grimwire.net:8000/>; rel="up service via grimwire.com/-p2pw/service"; title="Grimwire.net P2PW"',
				'<http://grimwire.net:8000/session>; rel="self service grimwire.com/-session"; id="session"'
			].join(', '));

			// Load session
			db.getSession(req.session, function(err, dbres) {
				if (err) {
					console.error('Failed to get session info from DB', err);
					res.send(500);
					return;
				}
				res.locals.session = dbres ? dbres.rows[0] : null;
				next();
			});
		}
	);
	server.head('/', function(req, res) { return res.send(204); });

	// Whoami?
	server.get('/', function(req, res) {
		if (!req.accepts('json')) {
			return res.send(406);
		}
		return res.json(res.locals.session);
	});

	// Log In
	server.post('/',
		function (req, res, next) {
			// Validate inputs
			var errors = validateSessionCreate(req.body);
			if (errors) {
				res.writeHead(422, 'bad entity', {'Content-Type': 'application/json'});
				res.end(JSON.stringify(errors));
				return;
			}

			// Fetch the user
			db.getUser(req.body.id, function(err, dbres) {
				if (err || !dbres.rows[0]) {
					res.writeHead(422, 'bad entity', {'Content-Type': 'application/json'});
					res.end(JSON.stringify({errors:['Invalid username or password.']}));
					return;
				}
				res.locals.user = dbres.rows[0];
				next();
			});
		},
		function (req, res, next) {
			// Check password
			checkPassword(req.body.password, res.locals.user.password, function(err) {
				if (err) {
					res.writeHead(422, 'bad entity', {'Content-Type': 'application/json'});
					res.end(JSON.stringify({errors:['Invalid username or password.']}));
					return;
				}
				next();
			});
		},
		function (req, res, next) {
			// Create the session
			db.createSession(req.body.id, null, function(err, dbres) {
				if (err || !dbres.rows[0]) {
					console.error('Failed to create session info in DB', err);
					res.send(500);
					return;
				}

				// Set new session cookie
				req.session = dbres.rows[0].id;
				res.send(204);
			});
		}
	);

	// Log Out
	server.delete('/', function(req, res) {
		// Remove the session cookie
		req.session = null;
		res.send(204);
	});

	return server;
};


// Business Logic
// ==============
function validateSessionCreate(body) {
	if (!body) {
		return { errors: ['Body is required.'] };
	}
	var errors = [];
	if (body.id && typeof body.id != 'string') {
		errors.push('`id` must be a string');
	}
	if (body.password && typeof body.password != 'string') {
		errors.push('`password` must be a string');
	}
	if (errors.length > 0) {
		return { errors: errors };
	}
	return false;
}
function checkPassword(plaintext, encrypted, cb) {
	// :TODO: for now, no encryption is in place
	cb(plaintext != encrypted);
}
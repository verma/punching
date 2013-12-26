// server.js
// Listen to requests for hole-punching
//

var
	jot = require('json-over-tcp'),
	dgram = require('dgram'),
	crypto = require('crypto'),
	sigmund = require('sigmund'),
	_ = require('lodash'),

	os = require('os');

var go = function() {
	"use strict";
	var states = [];

	var findLocalIP = function() {
		var devs = ["en0", "eth0"];
		var hostDevs = os.networkInterfaces();

		var dev = _.find(devs, function(d) {
			return _.has(hostDevs, d);
		});

		var addr = _.find(hostDevs[dev], function(a) {
			return a.family === 'IPv4'
		});

		if (!addr)
			throw new Error('Could not determine local IP.');

		return addr.address;
	};

	var localAddress = findLocalIP();

	var createID = function() {
		return crypto.randomBytes(20).toString('hex');
	};

	var handleRequest = function(data, conn) {
		var state = _.find(states, function(s) { return s.socket === conn });

		if (data.req === 'address')
			return conn.write({ req: 'address', host: localAddress, port: 19090 });
		else if(data.req === 'id') {
			return conn.write({ req: 'id', id: state.id });
		}

		return conn.write({ error: true, message: 'Unknown request' });
	};

	var saveState = function(state) {
		var id = createID();
		state.id = id;

		states.push(state);
	}

	var clearState = function(state) {
		_.remove(states, state);
	};

	var server = jot.createServer();
	var dgramServer = dgram.createSocket('udp4');

	dgramServer.bind(19090, function() {
		server.on('listening', function() {
			console.log('Local IP:', localAddress);
			console.log('The server is now listening...');
		});

		server.on('connection', function(c) {
			var state = {
				socket: c
			};

			saveState(state);
			c.on('data', function(data) {
				handleRequest(data, c);
			});

			c.on('end', function() {
				clearState(state);
				console.log('Connection went away.');
			});
		});

		server.listen(9090);
	});

	var triggerExchange = function() {
		var a = states[0];
		var b = states[1];

		console.log('Triggering exchange...');
		console.log('a:', a.udp, 'b:', b.udp);

		a.socket.write({ req: 'peer', id: b.id, host: b.udp.host, port: b.udp.port });
		b.socket.write({ req: 'peer', id: a.id, host: a.udp.host, port: a.udp.port });
	}


	dgramServer.on('message', function(msg, rinfo) {
		var id = msg.toString();
		var newAddr = { host: rinfo.address, port: rinfo.port };

		var state = _.find(states, function(s) { return s.id === id; });
		if (!state)
			return console.log('Zombies are active');

		if (sigmund(state.udp) !== sigmund(newAddr)) {
			console.log(id, 'at', newAddr);
			state.udp = newAddr;

			if (_.size(states) === 2
				&& _.all(states, function(s) { return s.udp; })) {
				triggerExchange();
			}
		}
	});
};

process.nextTick(go);

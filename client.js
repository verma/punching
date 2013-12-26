// client.js
// Connect to a server and receive data
//

var
	jot = require('json-over-tcp'),
	dgram = require('dgram');

var go = function() {
	"use strict";

	var setupSignalling = function() {
		var myId = null;

		var socket = jot.connect(9090, 'localhost', function() {
			socket.write({ req: 'id' });
		});

		var dhost = null, dport = null;
		var startSendingDGRAM = function(host, port) {
			dhost = host;
			dport = port;

			if (myId === null)
				return console.log('Cannot start sending dgrams without ID');
			var s = dgram.createSocket('udp4');
			var b = new Buffer(myId);

			s.on('message', function(msg, rinfo) {
				console.log('dgram, valid:',
					(rinfo.address === dhost &&
					 rinfo.port == dport));
			});

			setInterval(function() {
				s.send(b, 0, b.length, dport, dhost);
			}, 500);
		};

		socket.on('data', function(data) {
			if (data.req === 'id') {
				myId = data.id;
				console.log('Got id from server:', myId);

				socket.write({ req: 'address' });
			}
			else if (data.req === 'address') {
				console.log('dgram server address:', data.host, data.port);
				startSendingDGRAM(data.host, data.port);
			}
			else if (data.req === 'peer') {
				console.log('Got peer:', data.id, data.host, data.port);
				dhost = data.host;
				dport = data.port;
				console.log('Destination switched!');
			}
		});
	};

	setupSignalling();
};

process.nextTick(go);

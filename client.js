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

		var socket = jot.connect(9090, process.env.PUNCH_HOST || 'localhost', function() {
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
			var packs = [];

			s.on('message', function(msg, rinfo) {
				var valid = (rinfo.address === dhost &&
					 rinfo.port == dport);

				console.log('dgram, valid:', valid);
				if (!valid) {
					console.log('rinfo:', rinfo.address, rinfo.port, 'd:', dhost, dport);
					if (_.size(packs) === 0 ||
						sigmund(_.last(packs)) === sigmund({ host: rinfo.address, port: rinfo.port }))
						packs.push({ host: rinfo.address, port: rinfo.port });
					else
						packs.length = 0;

					if (_.size(packs) >= 10) {
						console.log('Too many packets from invalid source, switching...');
						var a = _.last(packs);
						dhost = a.host;
						dport = a.port;
					}
				}
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

var express = require('express');
var app = express();
var https = require('https')
var fs = require("fs");

process.on('uncaughtException', (err) => {
    console.log(err);
});

var socket_map = {}; 
var options = {
    key: fs.readFileSync('./certs/demo.localhost.key.pem'),
    cert: fs.readFileSync('./certs/demo.localhost.cert.pem')
};

var server = https.createServer(options, app);
var io = require('socket.io')(server); 

app.use('/', express.static(__dirname + '/public')); 
server.listen(3011, function () {
    console.log('Https server listening on port ' + 3011);
});


function getOther(socket) {
    for (let key in socket_map) {
        if (socket_map[key] !== socket) {
            return socket_map[key];
        }
    }
    return null;
}

io.on('connection', function(socket) {

    console.log("a new connection: ");
    socket.on('join', function(msg) {
        console.log('my id is ', msg);
        socket_map[msg] = socket;
        if (Object.keys(socket_map).length === 2) {
            socket.emit('negotiationneeded', '');
        }
    })

    var list = ['offer', 'icecandidate', 'answer']
    list.forEach(e => {
        socket.on(e, function(msg) {
            console.log(msg);
            let socket2 = getOther(socket);
            if (socket2) {
                socket2.emit(e, msg);
            }
        });
    });

    socket.on('disconnect', function(msg) {
        console.log('断开',msg)
        for (let key in socket_map) {
            if (socket_map[key] === socket) {
                delete socket_map[key];
                return;
            }
        }
    })
});

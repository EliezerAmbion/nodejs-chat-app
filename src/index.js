const path = require('path');
const http = require('http'); // needed for socket.io
const express = require('express');
const socketio = require('socket.io');
const Filter = require('bad-words');
const {
  generateMessage,
  generateLocationMessage,
} = require('./utils/messages');
const {
  addUser,
  removeUser,
  getUser,
  getUsersInRoom,
} = require('./utils/users');

const app = express();
const server = http.createServer(app);
const io = socketio(server);

const port = process.env.PORT || 3000;
const publicDirectoryPath = path.join(__dirname, '../public');

app.use(express.static(publicDirectoryPath));

io.on('connection', (socket) => {
  console.log('New WebSocket connection');

  // acknowledgement function is the callback, same as every callbacks below
  socket.on('join', (options, callback) => {
    const { error, user } = addUser({ id: socket.id, ...options }); // socket.id is the id of the user

    if (error) {
      return callback(error);
    }

    // socket.join is only available on the server
    // this allows us to join a given chat room and we pass to it the name of the room
    socket.join(user.room);

    socket.emit(
      'message',
      generateMessage('Admin', `Welcome to room, ${user.room}`)
    );

    // this is going to broadcast to everybody except this particular socket
    // socket.broadcast.emit('message', generateMessage('A new user has joined!'));
    socket.broadcast
      .to(user.room)
      .emit(
        'message',
        generateMessage('Admin', `${user.username} has joined!`)
      );
    io.to(user.room).emit('roomData', {
      room: user.room,
      users: getUsersInRoom(user.room),
    });

    callback(); // w/o arguments mean w/o an error

    // socket.emit -> sends an event to a specific client.
    // io.emit -> sends an event to every connected client
    // socket.broadcast.emit -> sends an event to every connected client except for the one the emits it.
    // io.to.emit -> this emits an event to everybody in a specific room
    // socket.broadcast.to.emit -> This is sending an event to everyone except for the specific client, but it's limiting it to a specific chat room.
  });

  socket.on('sendMessage', (message, callback) => {
    const user = getUser(socket.id);
    const filter = new Filter();

    if (filter.isProfane(message)) {
      return callback('Profanity is not allowed!');
    }

    io.to(user.room).emit('message', generateMessage(user.username, message));
    callback();
  });

  // sendLocation
  socket.on('sendLocation', (coords, callback) => {
    const user = getUser(socket.id);
    io.to(user.room).emit(
      'locationMessage',
      generateLocationMessage(
        user.username,
        `https://google.com/maps?q=${coords.latitude},${coords.longitude}`
      )
    );
    callback();
  });

  // disconnect is used to when a user left or gets disconnected
  // the name should be disconnect
  socket.on('disconnect', () => {
    const user = removeUser(socket.id);

    if (user) {
      // emitting to everybody
      io.to(user.room).emit(
        'message',
        generateMessage('Admin', `${user.username} has left!`)
      );
      io.to(user.room).emit('roomData', {
        room: user.room,
        users: getUsersInRoom(user.room),
      });
    }
  });
});

server.listen(port, () => {
  console.log(`Listening to port ${port}`);
});

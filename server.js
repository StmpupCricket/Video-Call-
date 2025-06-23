const express = require('express');
const socketIO = require('socket.io');
const { v4: uuidV4 } = require('uuid');
const WebSocket = require('ws');

const app = express();
const server = require('http').createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Store active rooms
const rooms = {};

app.get('/', (req, res) => {
  res.send('Video Chat Server is running');
});

io.on('connection', socket => {
  socket.on('join-room', (roomId, userId) => {
    if (!rooms[roomId]) {
      rooms[roomId] = new Set();
    }
    
    rooms[roomId].add(userId);
    socket.join(roomId);
    socket.to(roomId).broadcast.emit('user-connected', userId);
    
    socket.on('disconnect', () => {
      rooms[roomId].delete(userId);
      socket.to(roomId).broadcast.emit('user-disconnected', userId);
      if (rooms[roomId].size === 0) {
        delete rooms[roomId];
      }
    });
  });
});

// Random matchmaking endpoint
app.get('/random-room', (req, res) => {
  let availableRoom = Object.keys(rooms).find(room => rooms[room].size === 1);
  
  if (!availableRoom) {
    availableRoom = uuidV4();
    rooms[availableRoom] = new Set();
  }
  
  res.json({ roomId: availableRoom });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

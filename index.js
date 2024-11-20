import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import bodyParser from 'body-parser';
// Initialize Express
const app = express();
 // creating server from express
const server = createServer(app);
const port = process.env.PORT || 3000;
// Configure CORS

app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json({ extended: true }));
app.get('/', (req, res) => {
    res.send("url hit sucessfully");
})

// Initialize Socket.IO
const io = new Server(server);

const rooms = {}; // Store room information

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Handle joining a room
    socket.on('join-room', (roomId) => {
        // If the room doesn't exist, create it
        if (!rooms[roomId]) {
            // Create an empty array to store users
            rooms[roomId] = [];
        }

        rooms[roomId].push(socket.id);
        socket.join(roomId);

        console.log(`User ${socket.id} joined room ${roomId}`);
        io.to(socket.id).emit('room-joined');

        // If this is the second user in the room, initiate the call
        if (rooms[roomId].length === 2) {
            io.to(rooms[roomId][0]).emit('initiate-call');
        }
    });

    // Handle offer
    socket.on('offer', ({ roomId, offer }) => {
        const otherUser = rooms[roomId].find(id => id !== socket.id);
        if (otherUser) {
            io.to(otherUser).emit('offer', offer);
        }
    });

    // Handle answer
    socket.on('answer', ({ roomId, answer }) => {
        const otherUser = rooms[roomId].find(id => id !== socket.id);
        if (otherUser) {
            io.to(otherUser).emit('answer', answer);
        }
    });

    // Handle ICE candidates
    socket.on('ice-candidate', ({ roomId, candidate }) => {
        const otherUser = rooms[roomId].find(id => id !== socket.id);
        if (otherUser) {
            io.to(otherUser).emit('ice-candidate', candidate);
        }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);

        // Remove the user from any rooms
        for (const roomId in rooms) {
            rooms[roomId] = rooms[roomId].filter(id => id !== socket.id);
            if (rooms[roomId].length === 0) {
                delete rooms[roomId];
            }
        }
    });
});

server.listen(port, () => {
    console.log('Server is running');
});
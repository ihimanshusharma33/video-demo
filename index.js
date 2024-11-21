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
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
        allowedHeaders: ["*"],
        credentials: true
    }
});

const rooms = {}; // Store room information

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    socket.on('join-room', ({ roomId, userName }) => {
        if (!rooms[roomId]) {
            rooms[roomId] = [];
        }

        rooms[roomId].push(socket.id);
        socket.join(roomId);

        console.log(`${userName} joined room: ${roomId}`);
        io.to(socket.id).emit('room-joined');

        if (rooms[roomId].length === 2) {
            io.to(rooms[roomId][0]).emit('initiate-call');
        }
    });

    socket.on('offer', ({ roomId, offer }) => {
        const otherUser = rooms[roomId].find((id) => id !== socket.id);
        if (otherUser) {
            io.to(otherUser).emit('offer', offer);
        }
    });

    socket.on('answer', ({ roomId, answer }) => {
        const otherUser = rooms[roomId].find((id) => id !== socket.id);
        if (otherUser) {
            io.to(otherUser).emit('answer', answer);
        }
    });

    socket.on('ice-candidate', ({ roomId, candidate }) => {
        const otherUser = rooms[roomId].find((id) => id !== socket.id);
        if (otherUser) {
            io.to(otherUser).emit('ice-candidate', candidate);
        }
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        for (const roomId in rooms) {
            rooms[roomId] = rooms[roomId].filter((id) => id !== socket.id);
            if (rooms[roomId].length === 0) {
                delete rooms[roomId];
            }
        }
    });
});

server.listen(port, () => {
    console.log('Server is running');
});
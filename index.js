import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import bodyParser from 'body-parser';

// Initialize Express
const app = express();

// Create HTTP server from Express
const server = createServer(app);
const port = process.env.PORT || 3000;

// Configure CORS
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json({ extended: true }));

app.get('/', (req, res) => {
    res.send('Server is up and running!');
});

// Initialize Socket.IO
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
        allowedHeaders: ['*'],
        credentials: true,
    },
});

const rooms = {}; // Store room information

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Acknowledge connection
    socket.emit('connectAck', socket.id);

    // Create a room
    socket.on('createRoom', ({ roomID, userName }) => {
        if (rooms[roomID]) {
            socket.emit('error', { message: 'Room already exists', status: 400 });
        } else {
            rooms[roomID] = {
                host: socket.id,
                users: [socket.id],
                userNames: { [socket.id]: userName },
            };
            socket.join(roomID);
            socket.emit('roomCreated', { roomID });
            console.log(`Room ${roomID} created by ${userName}`);
        }
    });

    // Join a room
    socket.on('joinRoom', ({ roomID, userName }) => {
        const room = rooms[roomID];
        if (room) {
            room.users.push(socket.id);
            room.userNames[socket.id] = userName;
            socket.join(roomID);
            socket.emit('roomJoined', { roomID });
            console.log(`${userName} joined room ${roomID}`);
            io.to(roomID).emit('userJoined', { userName });
        } else {
            socket.emit('error', { message: 'Room not found', status: 404 });
        }
    });

    // Handle WebRTC offer
    socket.on('offer', ({ roomID, offer }) => {
        const room = rooms[roomID];
        if (room && room.host !== socket.id) {
            io.to(room.host).emit('offer', { from: socket.id, offer });
            console.log(`Offer sent from ${socket.id} to host of room ${roomID}`);
        }
    });

    // Handle WebRTC answer
    socket.on('answer', ({ to, answer }) => {
        console.log(`Answer received from ${socket.id} to ${to}`);
        io.to(to).emit('answer', { from: socket.id, answer });
        console.log(`Answer sent from ${socket.id} to ${to}`);
    });

    // Handle ICE candidate
    socket.on('icecandidate', ({ roomID, candidate }) => {
        if (candidate && roomID) {
            socket.to(roomID).emit('icecandidate', { candidate });
            console.log('ICE candidate relayed:', candidate, 'to room', roomID);
        } else {
            console.warn('Invalid ICE candidate or missing roomID:', { roomID, candidate });
        }
    })
    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        // Remove user from rooms
        for (const roomID in rooms) {
            const room = rooms[roomID];
            if (room.users.includes(socket.id)) {
                room.users = room.users.filter((id) => id !== socket.id);
                delete room.userNames[socket.id];
                if (room.users.length === 0) {
                    delete rooms[roomID];
                    console.log(`Room ${roomID} deleted as it became empty.`);
                }
                break;
            }
        }
    });
});

server.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

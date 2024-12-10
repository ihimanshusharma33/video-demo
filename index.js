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
// Store room information
let rooms = {}; // Store room information

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Create a room
    socket.on('createRoom', ({ roomID, userName }) => {
        if (rooms[roomID]) {
            socket.emit('error', { message: 'Room already exists', status: 400 });
        } else {
            rooms[roomID] = {
                host: socket.id,
                users: [],
                userNames: { [socket.id]: userName },
            };
            socket.join(roomID);
            console.log(`Host ${socket.id} created room ${roomID}`);
        }
    });
    socket.on('askToHost', ({ otherUser, roomID, socketID }) => {
        const room = rooms[roomID];
        if (!room || !room.host) {
            console.log(room)
            console.log('host of room is not available during askto host')
            return;
        }
        console.log('Asking to host:', room.host);
        io.to(room.host).emit('askToHost', { otherUser, roomID, socketID })
    })
    // Join a room
    socket.on('joinRoom', ({ otherUser, roomID, socketID }) => {
        const room = rooms[roomID];
        if (room) {
            room.users.push(socketID);
            room.userNames[socketID] = otherUser;
            const targetSocket = io.sockets.sockets.get(socketID);
            if (targetSocket) {
                targetSocket.join(roomID);
                console.log(`Socket ${socketID} joined room ${roomID}`);
                io.to(room.users[0]).emit('hostAcceptOffer', { message: "host has accept your offer", otherUser, roomID });
            } else {
                console.log(`Socket with ID ${socketID} not found.`);
                socket.emit('error', { message: 'Socket not found', status: 404 });
            }
        }
        else {
            socket.emit('error', { message: 'Room not found', status: 404 });
        }
    });

    // Handle WebRTC offer
    socket.on('offer', ({ roomID, offer }) => {
        const room = rooms[roomID];
        if (!room.host) {
            console.log('Host of the room is not avialable')
        }
        if (room && room.host !== socket.id) {
            io.to(room.host).emit('offer', { from: socket.id, offer });
        }
    });

    // Handle WebRTC answer
    socket.on('answer', ({ to, answer }) => {
        io.to(to).emit('answer', { from: socket.id, answer });
    });

    // Handle ICE candidate
    socket.on('icecandidate', ({ roomID, candidate }) => {
        socket.to(roomID).emit('icecandidate', { candidate });
    });

    socket.on('privateMessage', ({ FormatedMessage, socketID, roomID }) => {
        console.log('Received message:', FormatedMessage, 'in room', roomID, 'with socketID', socketID);
        const room = rooms[roomID];
        if (room) {
            io.to(roomID).emit('ReceiveMessage', { FormatedMessage, socketID, roomID });
        } else {
            console.log(`Room ${roomID} not found.`);
        }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        for (const roomID in rooms) {
            const room = rooms[roomID];
            if (room.host === socket.id) {
                delete rooms[roomID];
                io.to(roomID).emit('roomClosed');
            } else if (room.users.includes(socket.id)) {
                const userIndex = room.users.indexOf(socket.id);
                if (userIndex !== -1) room.users.splice(userIndex, 1);
                const userName = room.userNames[socket.id];
                delete room.userNames[socket.id];
                io.to(roomID).emit('userLeft', { userName });
            }
        }
        console.log(`User disconnected: ${socket.id}`);
    });
});


server.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

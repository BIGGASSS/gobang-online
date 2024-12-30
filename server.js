const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

const rooms = new Map();

io.on('connection', (socket) => {
    console.log('用户连接:', socket.id);

    socket.on('create-room', () => {
        const roomId = Math.random().toString(36).substr(2, 6);
        rooms.set(roomId, {
            players: [socket.id],
            board: Array(15).fill().map(() => Array(15).fill(null)),
            currentTurn: 'black'
        });
        
        socket.join(roomId);
        socket.emit('player-color', 'black');
        socket.emit('room-created', roomId);
        console.log('房间创建:', roomId); // 调试信息
    });

    socket.on('join-room', (roomId) => {
        console.log('尝试加入房间:', roomId); // 调试信息
        const room = rooms.get(roomId);
        
        if (!room) {
            socket.emit('error-message', '房间不存在！');
            return;
        }
        
        if (room.players.length >= 2) {
            socket.emit('error-message', '房间已满！');
            return;
        }

        room.players.push(socket.id);
        socket.join(roomId);
        socket.emit('player-color', 'white');
        socket.emit('room-joined', roomId);
        
        // 通知所有玩家游戏开始
        io.to(roomId).emit('game-start');
        io.to(roomId).emit('turn', 'black');
        
        console.log('玩家加入房间:', roomId); // 调试信息
    });

    socket.on('make-move', ({ x, y, color, roomId }) => {
        const room = rooms.get(roomId);
        if (!room) return;

        if (room.currentTurn !== color) {
            socket.emit('error-message', '还没到你的回合！');
            return;
        }

        room.board[y][x] = color;
        io.to(roomId).emit('move', { x, y, color });

        room.currentTurn = color === 'black' ? 'white' : 'black';
        io.to(roomId).emit('turn', room.currentTurn);
    });

    socket.on('disconnect', () => {
        console.log('用户断开连接:', socket.id); // 调试信息
        for (const [roomId, room] of rooms.entries()) {
            const index = room.players.indexOf(socket.id);
            if (index !== -1) {
                room.players.splice(index, 1);
                if (room.players.length === 0) {
                    rooms.delete(roomId);
                    console.log('房间删除:', roomId); // 调试信息
                } else {
                    io.to(roomId).emit('error-message', '对手已断开连接！');
                }
            }
        }
    });

    // 添加获胜事件处理
    socket.on('game-win', ({color, roomId}) => {
        const room = rooms.get(roomId);
        if (room) {
            io.to(roomId).emit('game-over', { winner: color });
            
            // 重置房间状态
            room.board = Array(15).fill().map(() => Array(15).fill(null));
            room.currentTurn = 'black';
        }
    });

    socket.on('restart-game', ({ roomId }) => {
        const room = rooms.get(roomId);
        if (room) {
            room.board = Array(15).fill().map(() => Array(15).fill(null));
            room.currentTurn = 'black';
            io.to(roomId).emit('game-reset');
        }
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`服务器运行在端口 ${PORT}`);
});

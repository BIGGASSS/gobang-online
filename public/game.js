class Game {
    constructor() {
        this.canvas = document.getElementById('chessboard');
        this.ctx = this.canvas.getContext('2d');
        this.boardSize = 15;
        this.cellSize = this.canvas.width / this.boardSize;
        this.board = Array(this.boardSize).fill().map(() => Array(this.boardSize).fill(null));
        this.currentPlayer = 'black';
        this.socket = io();
        this.playerColor = null;
        this.isMyTurn = false;
        this.roomId = null;
        
        this.initBoard();
        this.initSocketEvents();
        this.initDOMEvents();
    }

    initBoard() {
        // 清空画布
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 绘制棋盘背景
        this.ctx.fillStyle = '#f0c78a';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // 绘制网格线
        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 1;

        for (let i = 0; i < this.boardSize; i++) {
            // 垂直线
            this.ctx.beginPath();
            this.ctx.moveTo((i + 0.5) * this.cellSize, this.cellSize / 2);
            this.ctx.lineTo((i + 0.5) * this.cellSize, this.canvas.height - this.cellSize / 2);
            this.ctx.stroke();

            // 水平线
            this.ctx.beginPath();
            this.ctx.moveTo(this.cellSize / 2, (i + 0.5) * this.cellSize);
            this.ctx.lineTo(this.canvas.width - this.cellSize / 2, (i + 0.5) * this.cellSize);
            this.ctx.stroke();
        }

        // 绘制天元和星点
        const points = [
            {x: 3, y: 3}, {x: 11, y: 3},
            {x: 3, y: 11}, {x: 11, y: 11},
            {x: 7, y: 7}  // 天元
        ];

        points.forEach(point => {
            this.ctx.beginPath();
            this.ctx.arc(
                (point.x + 0.5) * this.cellSize,
                (point.y + 0.5) * this.cellSize,
                4,
                0,
                Math.PI * 2
            );
            this.ctx.fillStyle = '#000';
            this.ctx.fill();
        });
    }

    placePiece(x, y, color) {
        this.board[y][x] = color;
        
        // 绘制棋子
        this.ctx.beginPath();
        this.ctx.arc(
            (x + 0.5) * this.cellSize,
            (y + 0.5) * this.cellSize,
            this.cellSize * 0.4,
            0,
            Math.PI * 2
        );
        
        this.ctx.fillStyle = color;
        this.ctx.fill();
        this.ctx.strokeStyle = color === 'black' ? '#000' : '#000';
        this.ctx.lineWidth = 1;
        this.ctx.stroke();

        // 检查是否获胜
        if (this.checkWin(x, y, color)) {
            this.socket.emit('game-win', {
                color: color,
                roomId: this.roomId
            });
        }
    }

    // 检查是否获胜
    checkWin(x, y, color) {
        const directions = [
            [[0, 1], [0, -1]],  // 垂直方向
            [[1, 0], [-1, 0]],  // 水平方向
            [[1, 1], [-1, -1]], // 主对角线
            [[1, -1], [-1, 1]]  // 副对角线
        ];

        return directions.some(direction => {
            const count = 1 + this.countInDirection(x, y, direction[0], color)
                           + this.countInDirection(x, y, direction[1], color);
            return count >= 5;
        });
    }

    // 在指定方向上计算连续相同颜色的棋子数量
    countInDirection(x, y, [dx, dy], color) {
        let count = 0;
        let currentX = x + dx;
        let currentY = y + dy;

        while (
            currentX >= 0 && currentX < this.boardSize &&
            currentY >= 0 && currentY < this.boardSize &&
            this.board[currentY][currentX] === color
        ) {
            count++;
            currentX += dx;
            currentY += dy;
        }

        return count;
    }

    initSocketEvents() {
        this.socket.on('player-color', (color) => {
            this.playerColor = color;
            document.getElementById('player-info').textContent = 
                `你的颜色: ${color === 'black' ? '黑棋' : '白棋'}`;
        });

        this.socket.on('turn', (color) => {
            this.currentPlayer = color;
            this.isMyTurn = (color === this.playerColor);
            document.getElementById('turn-info').textContent = 
                `当前回合: ${color === 'black' ? '黑棋' : '白棋'}`;
        });

        this.socket.on('move', ({ x, y, color }) => {
            this.placePiece(x, y, color);
        });

        this.socket.on('room-created', (roomId) => {
            this.roomId = roomId;
            document.getElementById('room-info').textContent = `房间号: ${roomId}`;
            console.log('创建房间:', roomId); // 调试信息
        });

        this.socket.on('room-joined', (roomId) => {
            this.roomId = roomId;
            document.getElementById('room-info').textContent = `房间号: ${roomId}`;
            console.log('加入房间:', roomId); // 调试信息
        });

        this.socket.on('game-start', () => {
            alert('游戏开始！');
        });

        this.socket.on('error-message', (message) => {
            alert(message);
        });

        this.socket.on('game-over', ({ winner }) => {
            const message = winner === this.playerColor ? 
                '恭喜你获胜！' : 
                `游戏结束，${winner === 'black' ? '黑棋' : '白棋'}获胜！`;
            
            alert(message);
            
            // 可以在这里添加重新开始的逻辑
            this.resetGame();
        });
    }

    initDOMEvents() {
        this.canvas.addEventListener('click', (e) => {
            if (!this.isMyTurn) {
                alert('还没到你的回合！');
                return;
            }

            const rect = this.canvas.getBoundingClientRect();
            const x = Math.floor((e.clientX - rect.left) / this.cellSize);
            const y = Math.floor((e.clientY - rect.top) / this.cellSize);
            
            if (this.isValidMove(x, y)) {
                this.socket.emit('make-move', { 
                    x, 
                    y, 
                    color: this.playerColor,
                    roomId: this.roomId
                });
            }
        });

        document.getElementById('create-room').addEventListener('click', () => {
            this.socket.emit('create-room');
        });

        document.getElementById('join-room').addEventListener('click', () => {
            const roomId = document.getElementById('room-id').value.trim();
            if (roomId) {
                this.socket.emit('join-room', roomId);
            } else {
                alert('请输入房间号！');
            }
        });
        
        document.getElementById('restart-game').addEventListener('click', () => {
            if (this.roomId) {
                this.socket.emit('restart-game', { roomId: this.roomId });
            }
        });
    }

    isValidMove(x, y) {
        return x >= 0 && x < this.boardSize && 
               y >= 0 && y < this.boardSize && 
               !this.board[y][x];
    }
}

// 创建游戏实例
window.onload = () => {
    const game = new Game();
};

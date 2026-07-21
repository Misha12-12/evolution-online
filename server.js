const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// --- ГЛАВНОЕ ИЗМЕНЕНИЕ ЗДЕСЬ ---
// Теперь сервер ищет файлы прямо там, где лежит server.js.
// Это решает проблему, если ты не смог создать папку public на GitHub.
app.use(express.static(__dirname)); 
// -------------------------------

// Хранилище состояния игры (в памяти сервера)
let gameState = {
    deck: [],
    hand: [],
    field: [],
    log: ['Сервер запущен...'],
    currentPlayer: 0
};

// Простая функция инициализации колоды (для теста)
function initDeck() {
    const CARD_TYPES = [
        { type: 'Травоядное', power: 2, css: 'type-herbivore' },
        { type: 'Хищник', power: 4, css: 'type-predator' }
    ];
    gameState.deck = [];
    for(let i = 0; i < 10; i++) {
        const t = CARD_TYPES[Math.floor(Math.random() * CARD_TYPES.length)];
        gameState.deck.push({ 
            id: i, 
            ...t, 
            hunger: t.type === 'Хищник' ? 1 : 0 
        });
    }
}
initDeck();

io.on('connection', (socket) => {
    console.log('Игрок подключился:', socket.id);
    
    // Отправляем текущее состояние сразу при подключении
    socket.emit('init_state', gameState);

    // Слушаем ходы
    socket.on('move_request', (data) => {
        // ТУТ БУДЕТ ТВОЯ ЛОГИКА ИГРЫ
        
        // Эмуляция действия для теста:
        gameState.log.unshift(`[Игрок ${socket.id}] сделал ход: ${JSON.stringify(data)}`);
        
        // Рассылаем обновленное состояние всем подключенным игрокам
        io.emit('update_state', gameState);
    });

    socket.on('disconnect', () => {
        console.log('Игрок отключился:', socket.id);
    });
});

// Render сам подставит порт через process.env.PORT
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});

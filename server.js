const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// 1. Раздаем статические файлы (твой index.html лежит в папке public)
app.use(express.static(path.join(__dirname, 'public')));

// Хранилище состояния игры. 
// В реальной игре тут должна быть база данных, но для старта хватит памяти сервера.
let gameState = {
    deck: [],
    hand: [],
    field: [],
    log: ['Сервер запущен...'],
    currentPlayer: 0 // 0 - Игрок 1, 1 - Игрок 2
};

io.on('connection', (socket) => {
    console.log('Игрок подключился:', socket.id);
    
    // При подключении сразу отправляем текущее состояние игры
    socket.emit('init_state', gameState);

    // --- ОБРАБОТКА ХОДОВ ---
    
    // Игрок хочет взять карту из колоды
    socket.on('take_card', (cardId) => {
        // Тут должна быть сложная проверка: чей сейчас ход, есть ли карта в колоде и т.д.
        // Для примера просто эмулируем действие и обновляем состояние
        gameState.log.unshift(`[${socket.id}] Взял карту (ID: ${cardId})`);
        
        // Рассылаем новое состояние всем подключенным
        io.emit('update_state', gameState);
    });

    // Игрок выложил карту на поле
    socket.on('play_card', (cardId) => {
        gameState.log.unshift(`[${socket.id}] Выложил карту (ID: ${cardId}) на поле`);
        io.emit('update_state', gameState);
    });

    // Фаза кормления
    socket.on('feed_phase', () => {
        gameState.log.unshift('🍖 ЗАПУЩЕНА ФАЗА ПИТАНИЯ!');
        // Здесь вызывается твоя сложная логика эволюции
        // applySymbiosis(), processPredators() и т.д.
        // Но менять gameState нужно аккуратно!
        
        io.emit('update_state', gameState);
    });

    socket.on('disconnect', () => {
        console.log('Игрок отключился:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});

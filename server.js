const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Раздаем файлы из текущей папки
app.use(express.static(__dirname));

let gameState = {
    deck: [],
    hand: [],
    field: [],
    log: ['Сервер запущен...'],
    currentPlayer: 0
};

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
    // Перемешаем колоду для интереса
    gameState.deck.sort(() => Math.random() - 0.5);
}
initDeck();

io.on('connection', (socket) => {
    console.log('Игрок подключился:', socket.id);
    
    // Отправляем текущее состояние при подключении
    socket.emit('init_state', gameState);

    // --- ЛОГИКА: Взять карту из колоды в руку ---
    socket.on('take_card', (cardId) => {
        // 1. Ищем карту в колоде
        const cardIndex = gameState.deck.findIndex(c => c.id === cardId);
        
        if (cardIndex !== -1) {
            const card = gameState.deck.splice(cardIndex, 1)[0]; // Удаляем из колоды
            gameState.hand.push(card); // Добавляем в руку
            
            gameState.log.unshift(`[Игрок ${socket.id}] взял карту ID:${card.id} (${card.type})`);
            io.emit('update_state', gameState); // Сообщаем всем игрокам об изменении
            console.log(`Карта ${card.id} перемещена в руку`);
        } else {
            console.warn(`Карта ${cardId} не найдена в колоде`);
        }
    });

    // --- ЛОГИКА: Сыграть карту с руки на поле ---
    socket.on('play_card', (cardId) => {
        // Ищем карту в руке
        const handIndex = gameState.hand.findIndex(c => c.id === cardId);
        
        if (handIndex !== -1) {
            const card = gameState.hand.splice(handIndex, 1)[0]; // Удаляем из руки
            gameState.field.push(card); // Кладем на поле
            
            gameState.log.unshift(`[Игрок ${socket.id}] сыграл карту ID:${card.id}`);
            io.emit('update_state', gameState);
            console.log(`Карта ${card.id} сыграна на поле`);
        }
    });

    // --- ЛОГИКА: Фаза кормления (заглушка) ---
    socket.on('feed_phase', () => {
        gameState.log.unshift(`[Игрок ${socket.id}] начал фазу кормления`);
        io.emit('update_state', gameState);
    });

    socket.on('disconnect', () => {
        console.log('Игрок отключился:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`✅ Сервер запущен на порту ${PORT}`);
});

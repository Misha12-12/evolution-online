const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

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
            hunger: t.type === 'Хищник' ? 1 : 0 // У хищников голод 1, у травоядных 0
        });
    }
    gameState.deck.sort(() => Math.random() - 0.5);
}
initDeck();

io.on('connection', (socket) => {
    console.log('Игрок подключился:', socket.id);
    socket.emit('init_state', gameState);

    // --- Взять карту ---
    socket.on('take_card', (cardId) => {
        const cardIndex = gameState.deck.findIndex(c => c.id === cardId);
        if (cardIndex !== -1) {
            const card = gameState.deck.splice(cardIndex, 1)[0];
            gameState.hand.push(card);
            gameState.log.unshift(`[Игрок ${socket.id}] взял карту ID:${card.id}`);
            io.emit('update_state', gameState);
        }
    });

    // --- Сыграть карту ---
    socket.on('play_card', (cardId) => {
        const handIndex = gameState.hand.findIndex(c => c.id === cardId);
        if (handIndex !== -1) {
            const card = gameState.hand.splice(handIndex, 1)[0];
            gameState.field.push(card);
            gameState.log.unshift(`[Игрок ${socket.id}] сыграл карту ID:${card.id}`);
            io.emit('update_state', gameState);
        }
    });

    // --- ФАЗА КОРМЛЕНИЯ (НОВАЯ ЛОГИКА) ---
    socket.on('feed_phase', () => {
        gameState.log.unshift(`[Фаза кормления] Начинаем кормление...`);
        
        // 1. Сначала обрабатываем Травоядных (они просто едят траву)
        for (let i = gameState.field.length - 1; i >= 0; i--) {
            const card = gameState.field[i];
            if (card.type === 'Травоядное') {
                // Травоядное всегда наедается, если у него был голод (хотя в нашей механике у них голод 0)
                // Но оставим логику на будущее: если вдруг добавим механику "переедания"
                card.hunger = 0; 
            }
        }

        // 2. Теперь обрабатываем Хищников
        // ВАЖНО: Мы проходим циклом, пока есть хищники, которым нужно есть.
        // Это позволяет одному хищнику съесть одного травоядного за ход.
        let predatorsFed = true;
        
        while(predatorsFed) {
            predatorsFed = false; // Предполагаем, что никто больше не поест
            
            for (let i = gameState.field.length - 1; i >= 0; i--) {
                const card = gameState.field[i];
                
                if (card.type === 'Хищник' && card.hunger > 0) {
                    // Ищем жертву (любое травоядное на поле)
                    const preyIndex = gameState.field.findIndex(c => c.type === 'Травоядное');
                    
                    if (preyIndex !== -1) {
                        // ХИЩНИК ЕСТ!
                        const prey = gameState.field.splice(preyIndex, 1)[0]; // Удаляем жертву
                        card.hunger = 0; // Хищник наелся
                        
                        gameState.log.unshift(`🦁 Хищник ID:${card.id} съел Травоядное ID:${prey.id}!`);
                        predatorsFed = true; // Кто-то поел, значит, цикл может продолжиться (на случай цепочки атак, хотя тут 1 к 1)
                        break; // Прерываем цикл for, чтобы пересчитать индексы массива field заново
                    } else {
                        // Жертв нет, хищник голодает
                        card.hunger -= 1;
                        if (card.hunger <= 0) {
                             // Хищник умирает от голода! Удаляем его с поля
                             gameState.log.unshift(`💀 Хищник ID:${card.id} умер от голода!`);
                             gameState.field.splice(i, 1);
                        }
                    }
                }
            }
        }

        io.emit('update_state', gameState);
        console.log('Фаза кормления завершена');
    });

    socket.on('disconnect', () => console.log('Игрок отключился'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`✅ Сервер запущен на порту ${PORT}`));

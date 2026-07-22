const express = require('express');
const http = require('http');
const { Server } = require('socket.io'); // Правильный импорт для новых версий

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Разрешаем запросы с любого домена (для тестов)
        methods: ["GET", "POST"]
    }
});

app.use(express.static(__dirname));

// --- ГЛОБАЛЬНОЕ СОСТОЯНИЕ ---
let gameState = {
    deck: [],
    field: [], // { playerId, card, isDead }
    log: ['Сервер запущен...'],
    players: [], // Массив socket.id активных игроков
    currentTurnIndex: 0,
    phase: 'draw' // draw, play, feed
};

// Руки игроков: { 'socket.id': [cards...] }
const playerHands = {}; 

// Инициализация колоды
function initDeck() {
    const CARD_TYPES = [
        { type: 'Травоядное', power: 2, css: 'type-herbivore', hunger: 0 },
        { type: 'Хищник', power: 4, css: 'type-predator', hunger: 1 }
    ];
    gameState.deck = [];
    for(let i = 0; i < 40; i++) {
        const t = CARD_TYPES[Math.floor(Math.random() * CARD_TYPES.length)];
        // Уникальный ID важен!
        gameState.deck.push({ id: Date.now() + i, ...t }); 
    }
    // Перемешиваем
    gameState.deck.sort(() => Math.random() - 0.5);
}
initDeck();

io.on('connection', (socket) => {
    console.log('👤 Игрок подключился:', socket.id);
    
    // 1. Создаем руку для нового игрока
    playerHands[socket.id] = [];
    gameState.players.push(socket.id);

    // Отправляем состояние ТОЛЬКО этому игроку при входе
    sendStateToPlayer(socket.id);
    io.emit('player_joined', { playersCount: gameState.players.length });

    socket.on('disconnect', () => {
        console.log('🚪 Игрок ушел:', socket.id);
        gameState.players = gameState.players.filter(id => id !== socket.id);
        delete playerHands[socket.id];
        io.emit('player_left', { playersCount: gameState.players.length });
        
        // Если игроков не осталось, можно сбросить игру
        if (gameState.players.length === 0) {
            initDeck();
            gameState.field = [];
            gameState.log = ['Игра сброшена. Ждем новых игроков...'];
        }
    });

    // --- ДЕЙСТВИЯ ---

    // Взять карту
    socket.on('take_card', (cardId) => {
        if (gameState.phase !== 'draw') return;
        if (socket.id !== getCurrentPlayerId()) return;

        const idx = gameState.deck.findIndex(c => c.id === cardId);
        if (idx !== -1) {
            const card = gameState.deck.splice(idx, 1)[0];
            playerHands[socket.id].push(card);
            
            gameState.log.unshift(`🖐 Игрок ${socket.id.substring(0,4)} взял карту: ${card.type}`);
            broadcastState();
        } else {
            socket.emit('error', 'Карта не найдена в колоде');
        }
    });

    // Сыграть карту
    socket.on('play_card', (cardId) => {
        if (gameState.phase !== 'play') return;
        if (socket.id !== getCurrentPlayerId()) return;

        const hand = playerHands[socket.id];
        const idx = hand.findIndex(c => c.id === cardId);
        
        if (idx !== -1) {
            const card = hand.splice(idx, 1)[0]; 
            
            // Кладем на поле
            gameState.field.push({ playerId: socket.id, card: card, isDead: false });
            
            gameState.log.unshift(`🎮 Игрок ${socket.id.substring(0,4)} выложил: ${card.type}`);
            broadcastState();
        } else {
            socket.emit('error', 'Карты нет в вашей руке');
        }
    });

    // Конец хода
    socket.on('end_turn', () => {
        if (socket.id !== getCurrentPlayerId()) return;

        let nextIndex = gameState.currentTurnIndex + 1;
        
        // Если круг замкнулся -> Фаза кормления
        if (nextIndex >= gameState.players.length) {
            nextIndex = 0;
            gameState.phase = 'feed';
            performFeedPhase();
            return; 
        }

        gameState.currentTurnIndex = nextIndex;
        gameState.log.unshift(`⏳ Ход перешел к игроку ${gameState.players[nextIndex].substring(0,4)}`);
        broadcastState();
    });
});

function getCurrentPlayerId() {
    if (gameState.players.length === 0) return null;
    return gameState.players[gameState.currentTurnIndex];
}

function performFeedPhase() {
    gameState.log.unshift('--- НАЧАЛО ФАЗЫ КОРМЛЕНИЯ ---');
    
    // Создаем копию поля для безопасной итерации, если нужно удалять
    // Но так как мы удаляем элементы, лучше идти с конца или использовать фильтр
    
    let predatorsAte = false;

    // Проходим по всем существам
    for (let i = gameState.field.length - 1; i >= 0; i--) {
        const item = gameState.field[i];
        if (item.isDead) continue;

        if (item.card.type === 'Хищник' && item.card.hunger > 0) {
            // Ищем жертву (любое живое травоядное)
            const preyIndex = gameState.field.findIndex((p, idx) => 
                idx !== i && p.card.type === 'Травоядное' && !p.isDead
            );

            if (preyIndex !== -1) {
                // ХИЩНИК ЕСТ!
                gameState.field.splice(preyIndex, 1); // Удаляем жертву
                item.card.hunger = 0; // Хищник наелся
                predatorsAte = true;
                gameState.log.unshift(`🦁 Хищник съел жертву!`);
                // Не увеличиваем i, так как массив сдвинулся
            } else {
                // Жертв нет. Хищник голодает.
                item.card.hunger -= 1;
                if (item.card.hunger <= 0) {
                    item.isDead = true;
                    gameState.log.unshift(`💀 Хищник умер от голода.`);
                }
            }
        }
    }

    if (!predatorsAte) {
         gameState.log.unshift('🌾 Никто не пострадал в фазе кормления.');
    }

    // Ждем 3 секунды и новый раунд
    setTimeout(() => {
        gameState.phase = 'draw';
        gameState.currentTurnIndex = 0;
        gameState.log.unshift('--- НОВЫЙ РАУНД НАЧАЛСЯ ---');
        broadcastState();
    }, 3000);
}

// --- ОТПРАВКА ДАННЫХ ---

function sendStateToPlayer(playerId) {
    // Важно: io.sockets.sockets устарел в v4. Используем io.sockets.connected
    const socket = io.sockets.connected[playerId];
    if (!socket) return;
    
    socket.emit('state_update', {
        deck: gameState.deck,
        hand: playerHands[playerId] || [], 
        field: gameState.field,
        log: gameState.log,
        currentPlayer: getCurrentPlayerId(),
        phase: gameState.phase,
        myId: playerId,
        playersCount: gameState.players.length
    });
}

function broadcastState() {
    Object.keys(playerHands).forEach(pid => {
        sendStateToPlayer(pid);
    });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`✅ Сервер запущен на порту ${PORT}`));

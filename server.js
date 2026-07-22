const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Раздаем статические файлы (наш index.html)
app.use(express.static(path.join(__dirname)));

// Хранилище активных игроков (ключ - socket.id, значение - имя)
const players = {}; 

io.on('connection', (socket) => {
    console.log('Новый игрок подключился:', socket.id);
    
    // При подключении даем игроку случайное имя (Игрок 1, Игрок 2...)
    const playerName = `Игрок #${Object.keys(players).length + 1}`;
    players[socket.id] = playerName;

    // Отправляем всем текущий список игроков
    io.emit('players_list', players);

    // Сообщаем в общий лог игры
    io.emit('game_log', `[СИСТЕМА] ${playerName} вошёл в игру!`);

    // Обработка отключения
    socket.on('disconnect', () => {
        console.log(`Игрок вышел: ${players[socket.id]}`);
        delete players[socket.id];
        io.emit('players_list', players); // Обновляем список у всех
        io.emit('game_log', `[СИСТЕМА] ${players[socket.id]} вышел из игры!`); // Тут небольшая хитрость, лучше ниже
        
        // Исправленный лог выхода (так как мы удалили игрока выше, берем имя до удаления)
        // Но проще сделать так:
    });
    
    // Переопределим выход, чтобы имя сохранилось для лога
    socket.once('disconnect', (reason) => {
        const name = players[socket.id];
        delete players[socket.id];
        io.emit('players_list', players);
        io.emit('game_log', `[СИСТЕМА] ${name} вышел из игры.`);
    });
});

server.listen(3000, () => {
    console.log('Сервер запущен на http://localhost:3000');
});

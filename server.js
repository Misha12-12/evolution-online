<script>
  const socket = io();
  let myId = null;
  let gameState = {};
  let selectedCardId = null; 
  let draggedCard = null; // Для Drag & Drop

  const elDeck = document.getElementById('deck');
  const elHand = document.getElementById('hand');
  const elField = document.getElementById('field');
  const elLog = document.getElementById('log');
  const elStatus = document.getElementById('status');
  const elFood = document.getElementById('food-count');
  const elSpecies = document.getElementById('species-count');

  function log(msg) {
      elLog.innerText = `[${new Date().toLocaleTimeString()}] ${msg}\n` + elLog.innerText;
  }

  // --- ОТРИСОВКА ---
  function render(state) {
      gameState = state;
      myId = state.myId;

      // 1. Колода
      elDeck.innerHTML = '';
      state.deck.forEach(card => elDeck.appendChild(createCardElement(card, false, 'deck')));

      // 2. Рука
      elHand.innerHTML = '';
      const myHand = state.hand || []; 
      myHand.forEach(card => {
          const el = createCardElement(card, true, 'hand');
          el.addEventListener('dragstart', (e) => dragStart(e, card));
          el.addEventListener('click', () => selectCard(el, card.id));
          elHand.appendChild(el);
      });

      // 3. Поле
      elField.innerHTML = '';
      state.field.forEach(item => {
          const el = createCardElement(item.card, false, 'field');
          
          if (item.playerId === myId) {
              el.style.border = '2px solid var(--accent)'; 
          } else {
              el.style.opacity = '0.6'; 
          }
          
          if (item.isDead) {
              el.style.filter = 'grayscale(1)';
              el.style.pointerEvents = 'none'; 
              el.style.cursor = 'default';
          }

          elField.appendChild(el);
      });

      updateStats(state);
      updateUI(state);
  }

  function createCardElement(card, isMyCard, zone) {
      const cardEl = document.createElement('div');
      cardEl.className = 'card';
      cardEl.dataset.cardId = card.id; 
      cardEl.draggable = (zone === 'hand') ? true : false; 
      
      let bgColor = '#fff';
      let typeClass = '';
      if (card.css === 'type-predator') { bgColor = '#ffe6e6'; typeClass = 'pred-label'; }
      else if (card.css === 'type-herbivore') { bgColor = '#e6ffe6'; typeClass = 'herb-label'; }
      
      cardEl.style.background = bgColor;

      const hungerPercent = (card.hunger / 3) * 100; 

      cardEl.innerHTML = `
        <div class="power-badge">${card.power}</div>
        <div style="flex-grow:1; display:flex; align-items:center; justify-content:center;">
           <span class="type-label ${typeClass}">${card.type}</span>
        </div>
        ${card.hunger !== undefined ? `
          <div class="hunger-bar"><div class="hunger-fill" style="width: ${100 - hungerPercent}%"></div></div>
          <span style="font-size:10px; color:#666;">Голод: ${card.hunger}</span>
        ` : ''}
      `;

      return cardEl;
  }

  function updateStats(state) {
      const field = state.field || [];
      const mySpecies = field.filter(f => f.playerId === myId && !f.isDead).length;
      elSpecies.innerText = mySpecies;
      elFood.innerText = 0; 
  }

  // --- DRAG & DROP ---
  function dragStart(event, card) {
      draggedCard = card;
      event.dataTransfer.setData('text', card.id);
      log(`Начинаем тащить карту ID: ${card.id}`);
  }

  function allowDrop(event) {
      event.preventDefault();
  }

  function handleDrop(event) {
      if (!draggedCard) return;
      
      const cardId = parseInt(event.dataTransfer.getData('text'));
      
      if (gameState.phase === 'play' && gameState.currentPlayer === myId) {
          socket.emit('play_card', cardId);
          log(`Карта ${cardId} отправлена на сервер!`);
          draggedCard = null;
      } else {
          log('Нельзя сыграть карту сейчас (не ваш ход или неправильная фаза)');
      }
  }

  function selectCard(element, id) {
      document.querySelectorAll('.card').forEach(c => c.classList.remove('selected'));
      element.classList.add('selected');
      selectedCardId = id;
  }

  // --- КНОПКИ ---
  window.handleTakeCard = () => {
      if (!selectedCardId) {
          log("⚠️ Сначала выберите карту из колоды!");
          return;
      }
      socket.emit('take_card', selectedCardId);
      resetSelection();
  };

  window.handlePlayCard = () => {
      if (!selectedCardId) {
          log("⚠️ Сначала выберите карту из руки!");
          return;
      }
      socket.emit('play_card', selectedCardId);
      resetSelection();
  };

  window.handleEndTurn = () => {
      socket.emit('end_turn');
      log("Конец хода отправлен");
  };

  function resetSelection() {
      selectedCardId = null;
      document.querySelectorAll('.card').forEach(c => c.classList.remove('selected'));
  }

  // --- ПОЛНАЯ ФУНКЦИЯ UI (Твое продолжение) ---
  function updateUI(state) {
      const isMyTurn = (state.currentPlayer === myId);
      
      if (state.phase === 'draw') {
          if (isMyTurn) {
              elStatus.innerText = "✅ ВАШ ХОД: Возьмите карту из колоды!";
              elStatus.style.color = "#2ecc71";
          } else {
              elStatus.innerText = `⏳ Ожидание: Игрок ${state.currentPlayer?.substring(0,4) || '...'} берет карту...`;
              elStatus.style.color = "#f39c12";
          }
      } 
      else if (state.phase === 'play') {
          if (isMyTurn) {
              elStatus.innerText = "✅ ВАШ ХОД: Сыграйте карту (перетащите на поле)!";
              elStatus.style.color = "#2ecc71";
          } else {
              elStatus.innerText = `⏳ Ожидание: Игрок ${state.currentPlayer?.substring(0,4) || '...'} разыгрывает карту...`;
              elStatus.style.color = "#f39c12";
          }
      } 
      else if (state.phase === 'feed') {
          elStatus.innerText = "🍖 ФАЗА КОРМЛЕНИЯ: Автоматическое распределение еды...";
          elStatus.style.color = "#e74c3c";
      }
      else if (state.phase === 'end') {
          elStatus.innerText = "🏆 РАУНД ЗАВЕРШЕН! Подсчет очков...";
          elStatus.style.color = "#d35400";
      }

      const btnTake = document.getElementById('btnTake');
      const btnPlay = document.getElementById('btnPlay');
      const btnEnd = document.getElementById('btnEndTurn');

      if (state.phase === 'draw') {
          btnTake.disabled = !isMyTurn;
          btnPlay.disabled = true;
          btnEnd.disabled = true;
      } 
      else if (state.phase === 'play') {
          btnTake.disabled = true;
          btnPlay.disabled = true; // Используем Drag & Drop вместо кнопки
          btnEnd.disabled = true;
      } 
      else {
          // feed и end
          btnTake.disabled = true;
          btnPlay.disabled = true;
          btnEnd.disabled = true;
      }
  }

  // --- СОКЕТЫ ---
  socket.on('connect', () => log("✅ Подключено к серверу"));
  socket.on('disconnect', () => log("❌ Потеряно соединение"));
  
  socket.on('state_update', (state) => render(state));
  socket.on('player_joined', (data) => log(`👥 В игре теперь ${data.playersCount} игроков`));
  socket.on('error', (msg) => log(`❌ Ошибка сервера: ${msg}`));
</script>

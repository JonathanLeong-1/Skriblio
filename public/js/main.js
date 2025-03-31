// Connect to server
const socket = io();

// DOM elements
// Screens
const mainMenu = document.getElementById('main-menu');
const joinRoomScreen = document.getElementById('join-room');
const createRoomScreen = document.getElementById('create-room');
const waitingRoomScreen = document.getElementById('waiting-room');
const wordSelectionScreen = document.getElementById('word-selection');
const gameScreen = document.getElementById('game-screen');
const roundEndScreen = document.getElementById('round-end');
const gameEndScreen = document.getElementById('game-end');
const notification = document.getElementById('notification');

// Main menu
const playerNameInput = document.getElementById('playerName');
const createRoomBtn = document.getElementById('createRoomBtn');
const joinRoomBtn = document.getElementById('joinRoomBtn');

// Join room
const roomCodeInput = document.getElementById('roomCode');
const joinBtn = document.getElementById('joinBtn');
const backFromJoinBtn = document.getElementById('backFromJoinBtn');

// Create room
const roundsInput = document.getElementById('rounds');
const drawTimeInput = document.getElementById('drawTime');
const customWordsInput = document.getElementById('customWords');
const createBtn = document.getElementById('createBtn');
const backFromCreateBtn = document.getElementById('backFromCreateBtn');

// Waiting room
const roomCodeDisplay = document.getElementById('roomCodeDisplay');
const playersList = document.getElementById('playersList');
const hostControls = document.getElementById('hostControls');
const startGameBtn = document.getElementById('startGameBtn');
const leaveRoomBtn = document.getElementById('leaveRoomBtn');

// Word selection
const wordOptions = document.querySelectorAll('.word-option');

// Game screen
const currentRoundElement = document.getElementById('currentRound');
const totalRoundsElement = document.getElementById('totalRounds');
const wordDisplay = document.getElementById('word-display');
const currentWordElement = document.getElementById('currentWord');
const timeLeftElement = document.getElementById('timeLeft');
const drawingCanvas = document.getElementById('drawingCanvas');
const colorBtns = document.querySelectorAll('.color-btn');
const brushBtns = document.querySelectorAll('.brush-btn');
const eraserBtn = document.getElementById('eraserBtn');
const undoBtn = document.getElementById('undoBtn');
const clearBtn = document.getElementById('clearBtn');
const inGamePlayersList = document.getElementById('inGamePlayersList');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendMsgBtn = document.getElementById('sendMsgBtn');
const chatInputContainer = document.querySelector('.chat-input');

// Round end
const revealedWord = document.getElementById('revealedWord');
const scoresList = document.getElementById('scoresList');

// Game end
const winnerName = document.getElementById('winnerName');
const winnerScore = document.getElementById('winnerScore');
const finalScoresList = document.getElementById('finalScoresList');
const backToMenuBtn = document.getElementById('backToMenuBtn');

// Game state
let currentPlayer = {
    id: null,
    name: '',
    isDrawing: false
};

let currentRoom = {
    id: null,
    players: [],
    settings: {},
    isHost: false
};

let canvas, ctx;
let isDrawing = false;
let lastX = 0;
let lastY = 0;
let currentColor = '#000000';
let currentBrushSize = 5;
let isEraser = false;
let drawingHistory = [];
let timer;

// Initialize the app
function init() {
    setupEventListeners();
    showScreen(mainMenu);
}

// Setup all event listeners
function setupEventListeners() {
    // Main menu
    createRoomBtn.addEventListener('click', () => {
        if (validatePlayerName()) {
            showScreen(createRoomScreen);
        }
    });
    
    joinRoomBtn.addEventListener('click', () => {
        if (validatePlayerName()) {
            showScreen(joinRoomScreen);
        }
    });
    
    // Join room
    joinBtn.addEventListener('click', joinRoom);
    backFromJoinBtn.addEventListener('click', () => showScreen(mainMenu));
    
    // Create room - category selection
    const createRoomCategory = document.getElementById('createRoomCategory');
    const customWordsContainer = document.getElementById('customWordsContainer');
    
    createRoomCategory.addEventListener('change', function() {
        if (this.value === 'custom') {
            customWordsContainer.classList.add('visible');
        } else {
            customWordsContainer.classList.remove('visible');
        }
    });
    
    // Create room
    createBtn.addEventListener('click', createRoom);
    backFromCreateBtn.addEventListener('click', () => showScreen(mainMenu));
    
    // Waiting room
    startGameBtn.addEventListener('click', startGame);
    leaveRoomBtn.addEventListener('click', leaveRoom);
    
    // Word selection
    wordOptions.forEach(option => {
        option.addEventListener('click', function() {
            selectWord(this.textContent);
        });
    });
    
    // Drawing tools
    colorBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            setActiveColor(this);
        });
    });
    
    brushBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            setActiveBrush(this);
        });
    });
    
    eraserBtn.addEventListener('click', toggleEraser);
    undoBtn.addEventListener('click', undoLastAction);
    clearBtn.addEventListener('click', clearCanvas);
    
    // Chat
    chatInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendChatMessage();
        }
    });
    
    sendMsgBtn.addEventListener('click', sendChatMessage);
    
    // Game end
    backToMenuBtn.addEventListener('click', resetAndGoToMainMenu);
    
    // Socket events
    socket.on('roomCreated', handleRoomCreated);
    socket.on('roomNotFound', () => showNotification('Room not found!'));
    socket.on('updatePlayers', updatePlayersList);
    socket.on('gameState', handleGameState);
    socket.on('newHost', handleNewHost);
    socket.on('gameStarted', handleGameStarted);
    socket.on('chooseWord', handleChooseWord);
    socket.on('roundStarted', handleRoundStarted);
    socket.on('wordSelected', handleWordSelected);
    socket.on('drawLine', handleDrawLine);
    socket.on('erase', handleErase);
    socket.on('redraw', handleRedraw);
    socket.on('clearCanvas', handleClearCanvas);
    socket.on('wordHint', handleWordHint);
    socket.on('chatMessage', handleChatMessage);
    socket.on('correctGuess', handleCorrectGuess);
    socket.on('roundEnded', handleRoundEnded);
    socket.on('newRound', handleNewRound);
    socket.on('gameEnded', handleGameEnded);
    socket.on('notification', data => showNotification(data.message));
}

// Validate player name input
function validatePlayerName() {
    const name = playerNameInput.value.trim();
    if (name === '') {
        showNotification('Please enter your name.');
        return false;
    }
    
    currentPlayer.name = name;
    return true;
}

// Show specific screen and hide others
function showScreen(screen) {
    const screens = [
        mainMenu, 
        joinRoomScreen, 
        createRoomScreen, 
        waitingRoomScreen, 
        wordSelectionScreen, 
        gameScreen, 
        roundEndScreen, 
        gameEndScreen
    ];
    
    // First hide all screens with animation
    screens.forEach(s => {
        if (!s.classList.contains('hidden')) {
            // Apply transition out effect
            s.style.opacity = '0';
            s.style.transform = 'translateY(10px)';
            
            // After transition completes, hide the element
            setTimeout(() => {
                s.classList.add('hidden');
                s.style.opacity = '';
                s.style.transform = '';
            }, 300);
        }
    });
    
    // Then show the requested screen with animation after a slight delay
    setTimeout(() => {
        screen.classList.remove('hidden');
        
        // Apply transition in effect
        setTimeout(() => {
            screen.style.opacity = '1';
            screen.style.transform = 'translateY(0)';
        }, 50);
        
        // Special handling for game screen
        if (screen === gameScreen) {
            setupCanvas();
        }
    }, 350);
}

// Show notification
function showNotification(message) {
    notificationMessage.textContent = message;
    notification.classList.remove('hidden');
    
    // Auto hide after animation completes
    setTimeout(() => {
        notification.classList.add('hidden');
    }, 3000);
}

// Join a room
function joinRoom() {
    const roomId = roomCodeInput.value.trim();
    if (roomId === '') {
        showNotification('Please enter a room code.');
        return;
    }
    
    socket.emit('joinRoom', {
        roomId: roomId,
        playerName: currentPlayer.name
    });
}

// Create a new room
function createRoom() {
    const rounds = parseInt(roundsInput.value);
    const drawTime = parseInt(drawTimeInput.value);
    const categorySelect = document.getElementById('createRoomCategory');
    const selectedCategory = categorySelect.value;
    const customWords = customWordsInput.value.trim();
    
    // Parse custom words if "custom" category is selected
    let wordList = null;
    let wordCategory = selectedCategory;
    
    if (selectedCategory === 'custom') {
        if (customWords === '') {
            showNotification('Please enter some custom words.');
            return;
        }
        
        wordList = customWords.split(',')
            .map(word => word.trim())
            .filter(word => word !== '');
            
        if (wordList.length < 5) {
            showNotification('Please enter at least 5 custom words.');
            return;
        }
    }
    
    socket.emit('createRoom', {
        playerName: currentPlayer.name,
        settings: {
            rounds: rounds,
            drawTime: drawTime,
            wordList: wordList,
            wordCategory: wordCategory
        }
    });
}

// Handle room created event
function handleRoomCreated(data) {
    currentRoom.id = data.roomId;
    currentRoom.isHost = true;
    currentRoom.settings = data.gameState.settings;
    
    roomCodeDisplay.textContent = data.roomId;
    
    // Display the selected word category
    document.getElementById('waitingRoomCategory').textContent = currentRoom.settings.wordCategory;
    
    showScreen(waitingRoomScreen);
    
    // Show host controls
    hostControls.classList.remove('hidden');
    
    // Update player list
    updatePlayersList(Object.values(data.gameState.players));
}

// Update the players list
function updatePlayersList(players) {
    // Empty the list
    playersList.innerHTML = '';
    inGamePlayersList.innerHTML = '';
    
    // Find the player with the highest score
    let highestScore = -1;
    let highestScorerId = null;
    
    players.forEach(player => {
        if (player.score > highestScore) {
            highestScore = player.score;
            highestScorerId = player.id;
        }
    });
    
    // Add players to both lists
    players.forEach(player => {
        // Waiting room list
        const li = document.createElement('li');
        li.textContent = player.name;
        
        // Add host badge if player is host
        if (player.isHost) {
            const hostBadge = document.createElement('span');
            hostBadge.className = 'host-badge';
            hostBadge.textContent = 'HOST';
            li.appendChild(hostBadge);
        }
        
        playersList.appendChild(li);
        
        // In-game list
        const inGameLi = document.createElement('li');
        const nameSpan = document.createElement('span');
        
        // Add crown to player with highest score (if any player has a score)
        if (player.id === highestScorerId && highestScore > 0) {
            nameSpan.textContent = '👑 ' + player.name;
        } else {
            nameSpan.textContent = player.name;
        }
        
        // Add drawer indicator if needed
        if (player.id === currentRoom.drawer) {
            const drawerBadge = document.createElement('span');
            drawerBadge.className = 'drawer-indicator';
            drawerBadge.textContent = 'DRAWING';
            nameSpan.appendChild(drawerBadge);
            inGameLi.classList.add('drawer');
            inGameLi.style.fontWeight = 'bold';
        }
        
        const scoreSpan = document.createElement('span');
        scoreSpan.className = 'score';
        scoreSpan.textContent = player.score || 0;
        
        inGameLi.appendChild(nameSpan);
        inGameLi.appendChild(scoreSpan);
        
        inGamePlayersList.appendChild(inGameLi);
    });
    
    // Save players list to current room
    currentRoom.players = players;
}

// Handle game state update
function handleGameState(gameState) {
    currentRoom.settings = gameState.settings;
    
    // Display room code
    roomCodeDisplay.textContent = gameState.id;
    
    // Display the selected word category
    document.getElementById('waitingRoomCategory').textContent = currentRoom.settings.wordCategory;
    
    // Check if current player is host
    const currentPlayerData = gameState.players[socket.id];
    currentRoom.isHost = currentPlayerData && currentPlayerData.isHost;
    
    // Show/hide host controls
    hostControls.classList.toggle('hidden', !currentRoom.isHost);
    
    // Show appropriate screen based on game state
    if (gameState.state === 'waiting') {
        showScreen(waitingRoomScreen);
    } else if (gameState.state === 'playing') {
        // We joined in the middle of a game
        currentRoundElement.textContent = gameState.currentRound;
        totalRoundsElement.textContent = gameState.settings.rounds;
        
        // Check if we're the drawer
        currentPlayer.isDrawing = gameState.currentDrawer === socket.id;
        currentRoom.drawer = gameState.currentDrawer;
        
        // Update drawer status and chat access
        updateChatAccess();
        setupDrawingControls(currentPlayer.isDrawing);
        
        showScreen(gameScreen);
    }
}

// Handle new host assignment
function handleNewHost(newHostId) {
    // Check if current player is the new host
    if (newHostId === socket.id) {
        currentRoom.isHost = true;
        hostControls.classList.remove('hidden');
        showNotification('You are now the host!');
    }
    
    // Update player list to show the new host
    updatePlayersList(currentRoom.players.map(player => {
        if (player.id === newHostId) {
            player.isHost = true;
        } else {
            player.isHost = false;
        }
        return player;
    }));
}

// Start the game
function startGame() {
    socket.emit('startGame');
}

// Leave the current room
function leaveRoom() {
    // Disconnect and reconnect to server
    socket.disconnect();
    socket.connect();
    
    // Reset state
    resetState();
    showScreen(mainMenu);
}

// Reset game state
function resetState() {
    currentRoom = {
        id: null,
        players: [],
        settings: {},
        isHost: false
    };
    
    currentPlayer.isDrawing = false;
    
    // Clear timers
    if (timer) {
        clearInterval(timer);
    }
}

// Handle game started event
function handleGameStarted(gameState) {
    // Make sure all clients transition to game screen
    currentRoundElement.textContent = gameState.currentRound;
    totalRoundsElement.textContent = gameState.settings.rounds;
    
    // Check if current player is the first drawer
    if (gameState.currentDrawer === socket.id) {
        currentPlayer.isDrawing = true;
        // Drawer goes to word selection screen
        showScreen(wordSelectionScreen);
    } else {
        currentPlayer.isDrawing = false;
        // Non-drawers go to game screen and wait
        showScreen(gameScreen);
        
        // Add system message
        addChatMessage({
            system: true,
            message: `Waiting for ${gameState.players[gameState.currentDrawer].name} to choose a word...`
        });
    }
    
    // Store current drawer in room state
    currentRoom.drawer = gameState.currentDrawer;
    
    // Update drawer status and chat access
    updateChatAccess();
    
    // Update players list to reflect new state
    updatePlayersList(Object.values(gameState.players));
}

// Handle choose word event
function handleChooseWord(wordOptions) {
    // Populate word option buttons
    document.querySelectorAll('.word-option').forEach((btn, i) => {
        btn.textContent = wordOptions[i] || '';
    });
    
    // Only show word selection screen if you are the drawer
    if (currentPlayer.isDrawing) {
        showScreen(wordSelectionScreen);
    }
}

// Select a word to draw
function selectWord(word) {
    socket.emit('selectWord', word);
    showScreen(gameScreen);
}

// Handle round started event
function handleRoundStarted(data) {
    // If not drawing, show word as underscores
    if (!currentPlayer.isDrawing) {
        const wordPlaceholder = '_ '.repeat(data.wordLength).trim();
        currentWordElement.textContent = wordPlaceholder;
        wordDisplay.classList.remove('hidden');
    }
    
    // Enable/disable drawing based on role
    setupDrawingControls(currentPlayer.isDrawing);
    
    // Reset drawing history
    drawingHistory = [];
    
    // Update chat access
    updateChatAccess();
    
    // Add system message
    addChatMessage({
        system: true,
        message: `${data.drawer} is drawing now!`
    });
    
    showScreen(gameScreen);
    
    // Start timer
    startTimer(currentRoom.settings.drawTime);
}

// Handle word selected event
function handleWordSelected(data) {
    // Update word display
    currentWordElement.textContent = currentPlayer.isDrawing ? data.word : data.hint;
    
    // Start drawing timer for all players
    startTimer(data.drawTime);
    
    // Update UI for the round
    if (currentPlayer.isDrawing) {
        // Enable drawing tools
        setupDrawingControls(true);
        
        // Disable chat
        updateChatAccess();
    }
    
    // Add system message
    addChatMessage({
        system: true,
        message: `Round ${data.round} has started! ${currentPlayer.isDrawing ? 'You are' : data.drawer + ' is'} drawing.`
    });
}

// Handle word hint update
function handleWordHint(hint) {
    if (!currentPlayer.isDrawing) {
        currentWordElement.textContent = hint;
    }
}

// Setup the canvas
function setupCanvas() {
    canvas = drawingCanvas;
    ctx = canvas.getContext('2d');
    
    // Set canvas size to match container
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Setup drawing event listeners
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);
    
    // Touch events for mobile
    canvas.addEventListener('touchstart', handleTouch);
    canvas.addEventListener('touchmove', handleTouchMove);
    canvas.addEventListener('touchend', stopDrawing);
    
    // Set initial active tools
    setActiveColor(colorBtns[0]);
    setActiveBrush(brushBtns[1]);
}

// Resize canvas to fit container
function resizeCanvas() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
}

// Setup drawing controls based on role
function setupDrawingControls(isDrawer) {
    const drawingTools = document.querySelector('.drawing-tools');
    
    if (isDrawer) {
        drawingTools.classList.remove('hidden');
        canvas.style.cursor = 'crosshair';
    } else {
        drawingTools.classList.add('hidden');
        canvas.style.cursor = 'default';
    }
}

// Update chat access based on role and game state
function updateChatAccess() {
    const isDrawer = currentPlayer.isDrawing;
    const hasGuessedCorrectly = currentRoom.players.find(p => p.id === socket.id)?.guessedCorrectly;
    
    if (isDrawer || hasGuessedCorrectly) {
        // Disable chat for drawer and correct guessers
        chatInputContainer.classList.add('disabled');
        chatInput.disabled = true;
        sendMsgBtn.disabled = true;
        
        if (isDrawer) {
            chatInput.placeholder = "You are the drawer and cannot chat";
        } else {
            chatInput.placeholder = "You already guessed correctly!";
        }
    } else {
        // Enable chat for guessers
        chatInputContainer.classList.remove('disabled');
        chatInput.disabled = false;
        sendMsgBtn.disabled = false;
        chatInput.placeholder = "Type your guess here...";
    }
}

// Drawing event handlers
function startDrawing(e) {
    if (!currentPlayer.isDrawing) return;
    
    isDrawing = true;
    const rect = canvas.getBoundingClientRect();
    lastX = e.clientX - rect.left;
    lastY = e.clientY - rect.top;
}

function draw(e) {
    if (!isDrawing || !currentPlayer.isDrawing) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    if (isEraser) {
        erase(lastX, lastY, x, y);
        
        // Send erase data to server
        socket.emit('erase', {
            from: { x: lastX, y: lastY },
            to: { x, y },
            size: currentBrushSize * 2
        });
    } else {
        drawLine(lastX, lastY, x, y, currentColor, currentBrushSize);
        
        // Save to drawing history for undo
        drawingHistory.push({
            type: 'line',
            from: { x: lastX, y: lastY },
            to: { x, y },
            color: currentColor,
            brushSize: currentBrushSize
        });
        
        // Send drawing data to server
        socket.emit('drawLine', {
            from: { x: lastX, y: lastY },
            to: { x, y },
            color: currentColor,
            brushSize: currentBrushSize
        });
    }
    
    lastX = x;
    lastY = y;
}

function stopDrawing() {
    isDrawing = false;
}

// Handle touch events for mobile
function handleTouch(e) {
    if (!currentPlayer.isDrawing) return;
    e.preventDefault();
    
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    lastX = touch.clientX - rect.left;
    lastY = touch.clientY - rect.top;
    
    isDrawing = true;
}

function handleTouchMove(e) {
    if (!isDrawing || !currentPlayer.isDrawing) return;
    e.preventDefault();
    
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    
    if (isEraser) {
        erase(lastX, lastY, x, y);
        
        // Send erase data to server
        socket.emit('erase', {
            from: { x: lastX, y: lastY },
            to: { x, y },
            size: currentBrushSize * 2
        });
    } else {
        drawLine(lastX, lastY, x, y, currentColor, currentBrushSize);
        
        // Save to drawing history for undo
        drawingHistory.push({
            type: 'line',
            from: { x: lastX, y: lastY },
            to: { x, y },
            color: currentColor,
            brushSize: currentBrushSize
        });
        
        // Send drawing data to server
        socket.emit('drawLine', {
            from: { x: lastX, y: lastY },
            to: { x, y },
            color: currentColor,
            brushSize: currentBrushSize
        });
    }
    
    lastX = x;
    lastY = y;
}

// Drawing functions
function drawLine(fromX, fromY, toX, toY, color, size) {
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.strokeStyle = color;
    ctx.lineWidth = size;
    ctx.lineCap = 'round';
    ctx.stroke();
}

// Eraser function
function erase(fromX, fromY, toX, toY) {
    // Calculate the number of points based on distance between from and to
    const distance = Math.sqrt(Math.pow(toX - fromX, 2) + Math.pow(toY - fromY, 2));
    const points = Math.max(Math.ceil(distance / 5), 2); // Ensure at least 2 points
    
    // Erase along the path using multiple points to ensure complete erasing
    for (let i = 0; i < points; i++) {
        const ratio = i / (points - 1);
        const x = fromX + (toX - fromX) * ratio;
        const y = fromY + (toY - fromY) * ratio;
        
        // Erase at each point
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, currentBrushSize * 2, 0, Math.PI * 2, true);
        ctx.clip();
        ctx.clearRect(x - currentBrushSize * 2, y - currentBrushSize * 2, currentBrushSize * 4, currentBrushSize * 4);
        ctx.restore();
    }
}

// Handle draw line event from other players
function handleDrawLine(data) {
    drawLine(
        data.from.x,
        data.from.y,
        data.to.x,
        data.to.y,
        data.color,
        data.brushSize
    );
}

// Handle erase event from other players
function handleErase(data) {
    erase(data.from.x, data.from.y, data.to.x, data.to.y);
}

// Handle redraw event (after undo)
function handleRedraw(drawings) {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Update local drawing history
    drawingHistory = [...drawings];
    
    // Redraw each line
    drawings.forEach(data => {
        if (data.type === 'line') {
            drawLine(
                data.from.x,
                data.from.y,
                data.to.x,
                data.to.y,
                data.color,
                data.brushSize
            );
        }
    });
}

// Set active color
function setActiveColor(btn) {
    // Turn off eraser when selecting a color
    if (isEraser) {
        toggleEraser();
    }
    
    // Remove active class from all color buttons
    colorBtns.forEach(button => button.classList.remove('active'));
    
    // Add active class to clicked button
    btn.classList.add('active');
    
    // Set current color
    currentColor = btn.dataset.color;
}

// Set active brush size
function setActiveBrush(btn) {
    // Remove active class from all brush buttons
    brushBtns.forEach(button => button.classList.remove('active'));
    
    // Add active class to clicked button
    btn.classList.add('active');
    
    // Set current brush size
    currentBrushSize = parseInt(btn.dataset.size);
}

// Toggle eraser tool
function toggleEraser() {
    isEraser = !isEraser;
    
    if (isEraser) {
        eraserBtn.classList.add('active');
        // Change cursor to indicate eraser
        canvas.style.cursor = 'url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAAAXNSR0IArs4c6QAAAERlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAFKADAAQAAAABAAAAFAAAAACy3fD9AAAATElEQVQ4EWNgGAWjITAaAiM9BBgYGBj+48Fe4gyzISjsXwDxs0GIYTQERkNgFIdAKA6B//D4GpqN/oMwetx/AGH0uB/toTR6fCoJAQBHWhmSRlpLXwAAAABJRU5ErkJggg==) 10 10, auto';
    } else {
        eraserBtn.classList.remove('active');
        // Reset cursor
        canvas.style.cursor = 'crosshair';
    }
}

// Undo last drawing action
function undoLastAction() {
    if (!currentPlayer.isDrawing) return;
    
    // Only emit undo event if there's something to undo
    if (drawingHistory.length > 0) {
        // Remove the last action from local history
        drawingHistory.pop();
        socket.emit('undo');
    }
}

// Clear the canvas
function clearCanvas() {
    if (!currentPlayer.isDrawing) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawingHistory = [];
    
    // Send clear canvas event to server
    socket.emit('clearCanvas');
}

// Handle clear canvas event from drawer
function handleClearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawingHistory = [];
}

// Send chat message
function sendChatMessage() {
    // Don't send if chat is disabled
    if (chatInput.disabled) return;
    
    const message = chatInput.value.trim();
    if (message === '') return;
    
    socket.emit('chatMessage', message);
    chatInput.value = '';
}

// Add chat message to chat box
function addChatMessage(data) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message';
    
    if (data.system) {
        // System message
        messageDiv.classList.add('system-message');
        messageDiv.textContent = data.message;
    } else if (data.correct) {
        // Correct guess
        messageDiv.classList.add('correct-guess');
        messageDiv.textContent = `${data.sender} guessed the word!`;
    } else {
        // Player message
        messageDiv.classList.add('player-message');
        const senderSpan = document.createElement('strong');
        senderSpan.textContent = data.sender + ': ';
        
        messageDiv.appendChild(senderSpan);
        messageDiv.appendChild(document.createTextNode(data.message));
    }
    
    chatMessages.appendChild(messageDiv);
    
    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Handle chat message from server
function handleChatMessage(data) {
    addChatMessage({
        sender: data.sender,
        message: data.message
    });
}

// Handle correct guess event
function handleCorrectGuess(data) {
    addChatMessage({
        correct: true,
        sender: data.playerName
    });
    
    // Update score in players list
    updatePlayerScore(data.playerId, data.scoreGained);
    
    // If I guessed correctly, disable my chat
    if (data.playerId === socket.id) {
        updateChatAccess();
    }
}

// Update a player's score in the list
function updatePlayerScore(playerId, scoreGained) {
    // Find player in currentRoom.players and update score
    const player = currentRoom.players.find(p => p.id === playerId);
    if (player) {
        player.score = (player.score || 0) + scoreGained;
        player.guessedCorrectly = true;
    }
    
    // Update the display
    const playerItems = inGamePlayersList.querySelectorAll('li');
    
    playerItems.forEach(item => {
        const nameSpan = item.querySelector('span:first-child');
        const scoreSpan = item.querySelector('.score');
        
        if (nameSpan.textContent.includes(player.name)) {
            scoreSpan.textContent = player.score;
            
            // Briefly highlight the score
            scoreSpan.style.color = '#2ecc71';
            setTimeout(() => {
                scoreSpan.style.color = '';
            }, 1000);
        }
    });
}

// Start the game timer
function startTimer(seconds) {
    let timeLeft = seconds;
    timeLeftElement.textContent = timeLeft;
    
    // Clear existing timer
    if (timer) {
        clearInterval(timer);
    }
    
    // Start new timer
    timer = setInterval(() => {
        timeLeft--;
        timeLeftElement.textContent = timeLeft;
        
        // Add urgency when time is running out
        if (timeLeft <= 10) {
            timeLeftElement.style.color = 'red';
        } else {
            timeLeftElement.style.color = 'white';
        }
        
        if (timeLeft <= 0) {
            clearInterval(timer);
        }
    }, 1000);
}

// Clear chat messages
function clearChatMessages() {
    chatMessages.innerHTML = '';
}

// Handle round ended event
function handleRoundEnded(data) {
    // Stop the timer
    if (timer) {
        clearInterval(timer);
    }
    
    // Update the revealed word
    revealedWord.textContent = data.word;
    
    // Update scores list
    updateScoresList(data.scores);
    
    // Start the countdown timer for the next round
    startRoundEndCountdown();
    
    // Clear chat messages
    clearChatMessages();
    
    // Show round end screen
    showScreen(roundEndScreen);
    
    // Add a transition countdown message
    addChatMessage({
        system: true,
        message: 'Next round starting in 5 seconds...'
    });
}

// Start the round end countdown
function startRoundEndCountdown() {
    const countdownElement = document.createElement('div');
    countdownElement.id = 'roundEndCountdown';
    countdownElement.className = 'round-end-countdown';
    countdownElement.textContent = '5';
    
    // Add the countdown element to the round end screen
    document.querySelector('#round-end .container').appendChild(countdownElement);
    
    let countdownValue = 5;
    
    // Update countdown every second
    const countdownInterval = setInterval(() => {
        countdownValue--;
        countdownElement.textContent = countdownValue;
        
        if (countdownValue <= 0) {
            clearInterval(countdownInterval);
            // Remove countdown element
            countdownElement.remove();
        }
    }, 1000);
}

// Update the scores list
function updateScoresList(scores) {
    // Sort by score
    scores.sort((a, b) => b.score - a.score);
    
    // Empty the list
    scoresList.innerHTML = '';
    
    // Add players to list
    scores.forEach((player, index) => {
        const li = document.createElement('li');
        
        const rankSpan = document.createElement('span');
        rankSpan.textContent = `#${index + 1}`;
        
        const nameSpan = document.createElement('span');
        // Add crown to top player
        if (index === 0) {
            nameSpan.textContent = `👑 ${player.name}`;
        } else {
            nameSpan.textContent = player.name;
        }
        
        const scoreSpan = document.createElement('span');
        scoreSpan.className = 'score';
        scoreSpan.textContent = player.score;
        
        li.appendChild(rankSpan);
        li.appendChild(nameSpan);
        li.appendChild(scoreSpan);
        
        scoresList.appendChild(li);
    });
}

// Handle new round event
function handleNewRound(data) {
    currentRoundElement.textContent = data.round;
    
    // Reset drawing state
    currentPlayer.isDrawing = socket.id === data.drawerId;
    currentRoom.drawer = data.drawerId;
    
    // Add system message
    addChatMessage({
        system: true,
        message: `Round ${data.round} of ${data.totalRounds} - ${data.drawer} is drawing`
    });
    
    // If current player is the drawer, show word selection
    if (currentPlayer.isDrawing) {
        // Wait for word options to be sent
    } else {
        // Non-drawers go to game screen and wait
        showScreen(gameScreen);
        
        // Reset canvas
        if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        
        // Update chat accessibility
        updateChatAccess();
        
        // Add waiting message
        addChatMessage({
            system: true,
            message: `Waiting for ${data.drawer} to choose a word...`
        });
    }
    
    // Update player list to reflect new drawer
    updatePlayersList(currentRoom.players);
}

// Handle game ended event
function handleGameEnded(data) {
    // Display winner
    winnerName.textContent = `👑 ${data.winner.name}`;
    winnerScore.textContent = data.winner.score + ' points';
    
    // Update final scores list
    const sortedPlayers = data.players.sort((a, b) => b.score - a.score);
    
    // Empty the list
    finalScoresList.innerHTML = '';
    
    // Add players to list
    sortedPlayers.forEach((player, index) => {
        const li = document.createElement('li');
        
        const rankSpan = document.createElement('span');
        rankSpan.textContent = `#${index + 1}`;
        
        const nameSpan = document.createElement('span');
        // Add crown to winner
        if (index === 0) {
            nameSpan.textContent = `👑 ${player.name}`;
        } else {
            nameSpan.textContent = player.name;
        }
        
        const scoreSpan = document.createElement('span');
        scoreSpan.className = 'score';
        scoreSpan.textContent = player.score;
        
        li.appendChild(rankSpan);
        li.appendChild(nameSpan);
        li.appendChild(scoreSpan);
        
        finalScoresList.appendChild(li);
    });
    
    // Show game end screen
    showScreen(gameEndScreen);
    
    // Clear chat messages
    clearChatMessages();
}

// Reset everything and go back to main menu
function resetAndGoToMainMenu() {
    // Disconnect and reconnect to server
    socket.disconnect();
    socket.connect();
    
    // Reset state
    resetState();
    
    // Clear inputs
    playerNameInput.value = currentPlayer.name;
    roomCodeInput.value = '';
    
    // Go back to main menu
    showScreen(mainMenu);
}

// Initialize on page load
window.addEventListener('load', init); 
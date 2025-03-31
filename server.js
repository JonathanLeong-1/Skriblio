const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);

// Configure Socket.IO with CORS for production
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Add a basic route for testing
app.get('/health', (req, res) => {
  res.status(200).send('Server is running!');
});

// Game state
const rooms = {};
const DEFAULT_WORDS = [
  'apple', 'banana', 'cat', 'dog', 'elephant', 'fish', 'guitar', 'house', 'igloo', 'jacket',
  'kangaroo', 'lion', 'monkey', 'notebook', 'orange', 'pizza', 'queen', 'robot', 'snake', 'tiger',
  'umbrella', 'violin', 'whale', 'xylophone', 'yacht', 'zebra', 'airplane', 'beach', 'computer',
  'dragon', 'earth', 'flower', 'giraffe', 'helicopter', 'island', 'jupiter', 'koala', 'lamp',
  'mountain', 'nightfall', 'ocean', 'penguin', 'rainbow', 'spaceship', 'train', 'unicorn',
  'volcano', 'waterfall', 'xmas', 'yogurt', 'zombie'
];

// Generate a random 4-digit room code
function generateRoomCode() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// Socket.io connection handler
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // Join room
  socket.on('joinRoom', ({ roomId, playerName }) => {
    // Create room if it doesn't exist
    if (!rooms[roomId]) {
      console.log(`Room ${roomId} does not exist`);
      socket.emit('roomNotFound');
      return;
    }

    // Add player to room
    rooms[roomId].players[socket.id] = {
      id: socket.id,
      name: playerName,
      score: 0,
      guessedCorrectly: false
    };

    socket.join(roomId);
    socket.roomId = roomId;

    // Notify all clients in room about new player
    io.to(roomId).emit('updatePlayers', Object.values(rooms[roomId].players));
    socket.emit('gameState', rooms[roomId]);
    
    console.log(`${playerName} joined room ${roomId}`);
  });

  // Create room
  socket.on('createRoom', ({ playerName, settings }) => {
    // Generate a unique 4-digit room code
    let roomId;
    do {
      roomId = generateRoomCode();
    } while (rooms[roomId]); // Ensure code doesn't already exist
    
    // Initialize room state
    rooms[roomId] = {
      id: roomId,
      players: {
        [socket.id]: {
          id: socket.id,
          name: playerName,
          score: 0,
          guessedCorrectly: false,
          isHost: true
        }
      },
      settings: {
        rounds: settings?.rounds || 3,
        drawTime: settings?.drawTime || 80,
        wordList: settings?.wordList || DEFAULT_WORDS
      },
      state: 'waiting',
      currentRound: 0,
      currentDrawer: null,
      currentWord: null,
      wordOptions: [],
      revealedLetters: [],
      drawings: [] // Store drawing data for undo functionality
    };

    socket.join(roomId);
    socket.roomId = roomId;
    
    // Send room details to creator
    socket.emit('roomCreated', { roomId, gameState: rooms[roomId] });
    console.log(`${playerName} created room ${roomId}`);
  });

  // Start game
  socket.on('startGame', () => {
    const roomId = socket.roomId;
    if (!roomId || !rooms[roomId]) return;

    const room = rooms[roomId];
    
    // Check if player is host
    if (room.players[socket.id]?.isHost !== true) return;
    
    // Check if enough players
    if (Object.keys(room.players).length < 2) {
      socket.emit('notification', { message: 'Need at least 2 players to start' });
      return;
    }

    // Start game
    room.state = 'playing';
    room.currentRound = 1;
    
    // Select first drawer
    const playerIds = Object.keys(room.players);
    room.currentDrawer = playerIds[0];
    
    // Generate word options
    room.wordOptions = getRandomWords(room.settings.wordList, 3);
    
    // Send game state to all players
    io.to(roomId).emit('gameStarted', room);
    
    // Send word options only to drawer
    io.to(room.currentDrawer).emit('chooseWord', room.wordOptions);
    
    console.log(`Game started in room ${roomId}`);
  });

  // Word selection
  socket.on('selectWord', (selectedWord) => {
    const roomId = socket.roomId;
    if (!roomId || !rooms[roomId]) return;

    const room = rooms[roomId];
    
    // Check if player is the current drawer
    if (room.currentDrawer !== socket.id) return;
    
    room.currentWord = selectedWord;
    room.revealedLetters = Array(selectedWord.length).fill(false);
    room.startTime = Date.now();
    room.drawings = []; // Reset drawings array
    
    // Reset player guesses
    Object.keys(room.players).forEach(playerId => {
      room.players[playerId].guessedCorrectly = false;
    });
    
    // Send masked word to all players except drawer
    io.to(roomId).emit('roundStarted', {
      drawer: room.players[room.currentDrawer].name,
      wordLength: selectedWord.length
    });
    
    // Send selected word to drawer only
    socket.emit('wordSelected', selectedWord);
    
    // Start timer
    startRoundTimer(roomId);
    
    console.log(`Round started in room ${roomId}, word: ${selectedWord}`);
  });

  // Drawing updates
  socket.on('drawLine', (drawData) => {
    const roomId = socket.roomId;
    if (!roomId || !rooms[roomId]) return;
    
    const room = rooms[roomId];
    
    // Only store drawer's lines for undo functionality
    if (socket.id === room.currentDrawer) {
      room.drawings.push(drawData);
    }
    
    // Forward drawing data to all clients except sender
    socket.to(roomId).emit('drawLine', drawData);
  });

  // Handle eraser
  socket.on('erase', (eraseData) => {
    const roomId = socket.roomId;
    if (!roomId || !rooms[roomId]) return;
    
    // Forward eraser data to all clients except sender
    socket.to(roomId).emit('erase', eraseData);
  });

  // Handle undo
  socket.on('undo', () => {
    const roomId = socket.roomId;
    if (!roomId || !rooms[roomId]) return;
    
    const room = rooms[roomId];
    
    // Only the drawer can undo
    if (socket.id !== room.currentDrawer) return;
    
    // Remove the last drawing action
    if (room.drawings.length > 0) {
      room.drawings.pop();
      // Tell all clients to redraw
      io.to(roomId).emit('redraw', room.drawings);
    }
  });

  // Clear canvas
  socket.on('clearCanvas', () => {
    const roomId = socket.roomId;
    if (!roomId || !rooms[roomId]) return;
    
    const room = rooms[roomId];
    
    // Only the drawer can clear
    if (socket.id === room.currentDrawer) {
      room.drawings = []; // Clear drawings array
    }
    
    socket.to(roomId).emit('clearCanvas');
  });

  // Chat message / word guess
  socket.on('chatMessage', (message) => {
    const roomId = socket.roomId;
    if (!roomId || !rooms[roomId] || !message) return;
    
    const room = rooms[roomId];
    const player = room.players[socket.id];
    
    // Check if player is the drawer (shouldn't be able to chat)
    if (socket.id === room.currentDrawer) return;
    
    // Check if player has already guessed correctly
    if (player.guessedCorrectly) return;
    
    // Check if game is in playing state
    if (room.state === 'playing') {
      // Check if message matches current word
      if (message.toLowerCase().trim() === room.currentWord.toLowerCase()) {
        // Player guessed correctly
        player.guessedCorrectly = true;
        
        // Calculate score based on time left
        const timeElapsed = (Date.now() - room.startTime) / 1000;
        const timeLeft = room.settings.drawTime - timeElapsed;
        const scoreGained = Math.ceil(timeLeft * 2) + 50;
        player.score += scoreGained;
        
        // Award points to drawer as well
        if (room.players[room.currentDrawer]) {
          room.players[room.currentDrawer].score += 25;
        }
        
        // Send correct guess notification to everyone
        io.to(roomId).emit('correctGuess', {
          playerId: socket.id,
          playerName: player.name,
          scoreGained
        });
        
        // Check if all players have guessed
        const nonDrawingPlayers = Object.values(room.players).filter(p => p.id !== room.currentDrawer);
        const allGuessed = nonDrawingPlayers.every(p => p.guessedCorrectly);
        
        if (allGuessed) {
          // End round early if everyone guessed
          clearTimeout(room.timer);
          endRound(roomId);
        }
        
        return;
      }
    }
    
    // Regular chat message
    io.to(roomId).emit('chatMessage', {
      senderId: socket.id,
      sender: player.name,
      message: message
    });
  });

  // Disconnect handler
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    
    const roomId = socket.roomId;
    if (!roomId || !rooms[roomId]) return;
    
    const room = rooms[roomId];
    
    // Remove player from room
    const isHost = room.players[socket.id]?.isHost;
    delete room.players[socket.id];
    
    // Check if room is empty
    if (Object.keys(room.players).length === 0) {
      // Delete empty room
      delete rooms[roomId];
      console.log(`Room ${roomId} deleted (empty)`);
      return;
    }
    
    // Update player list
    io.to(roomId).emit('updatePlayers', Object.values(room.players));
    
    // If host left, assign new host
    if (isHost) {
      const newHostId = Object.keys(room.players)[0];
      room.players[newHostId].isHost = true;
      io.to(roomId).emit('newHost', newHostId);
    }
    
    // If current drawer left during a round, end the round
    if (room.state === 'playing' && room.currentDrawer === socket.id) {
      clearTimeout(room.timer);
      io.to(roomId).emit('notification', { message: 'Drawer disconnected, ending round' });
      endRound(roomId);
    }
  });
});

// Helper functions
function getRandomWords(wordList, count) {
  const shuffled = [...wordList].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

function startRoundTimer(roomId) {
  const room = rooms[roomId];
  
  // Reveal a letter every 20% of time
  const letterInterval = Math.floor(room.settings.drawTime * 1000 / 5);
  
  let hintsRevealed = 0;
  
  function revealLetter() {
    if (hintsRevealed < 3 && room.currentWord) {
      // Find unrevealed letters
      const unrevealed = room.revealedLetters
        .map((revealed, i) => ({ revealed, index: i }))
        .filter(item => !item.revealed);
      
      if (unrevealed.length > 0) {
        // Reveal a random unrevealed letter
        const randomIndex = Math.floor(Math.random() * unrevealed.length);
        const letterIndex = unrevealed[randomIndex].index;
        room.revealedLetters[letterIndex] = true;
        
        // Send updated hint to all players except drawer
        const hint = room.currentWord.split('').map((letter, i) => 
          room.revealedLetters[i] ? letter : '_'
        ).join(' ');
        
        io.to(roomId).emit('wordHint', hint);
        hintsRevealed++;
        
        // Schedule next hint
        setTimeout(revealLetter, letterInterval);
      }
    }
  }
  
  // Start revealing letters
  setTimeout(revealLetter, letterInterval);
  
  // Set round timer
  room.timer = setTimeout(() => {
    endRound(roomId);
  }, room.settings.drawTime * 1000);
}

function endRound(roomId) {
  const room = rooms[roomId];
  if (!room) return;
  
  // Reveal the word to everyone
  io.to(roomId).emit('roundEnded', {
    word: room.currentWord,
    scores: Object.values(room.players).map(p => ({ id: p.id, name: p.name, score: p.score }))
  });
  
  // Check if game should end
  if (room.currentRound >= room.settings.rounds) {
    // End game after 5 seconds
    setTimeout(() => {
      endGame(roomId);
    }, 5000);
  } else {
    // Schedule next round after 5 seconds
    setTimeout(() => {
      startNextRound(roomId);
    }, 5000);
  }
}

function startNextRound(roomId) {
  const room = rooms[roomId];
  if (!room) return;
  
  room.currentRound++;
  
  // Choose next drawer
  const playerIds = Object.keys(room.players);
  const currentDrawerIndex = playerIds.indexOf(room.currentDrawer);
  const nextDrawerIndex = (currentDrawerIndex + 1) % playerIds.length;
  room.currentDrawer = playerIds[nextDrawerIndex];
  
  // Generate new word options
  room.wordOptions = getRandomWords(room.settings.wordList, 3);
  
  // Notify all players
  io.to(roomId).emit('newRound', {
    round: room.currentRound,
    totalRounds: room.settings.rounds,
    drawer: room.players[room.currentDrawer].name
  });
  
  // Send word options to drawer
  io.to(room.currentDrawer).emit('chooseWord', room.wordOptions);
}

function endGame(roomId) {
  const room = rooms[roomId];
  if (!room) return;
  
  // Calculate winner
  const players = Object.values(room.players);
  players.sort((a, b) => b.score - a.score);
  const winner = players[0];
  
  // Reset game state
  room.state = 'ended';
  
  // Send game results to all players
  io.to(roomId).emit('gameEnded', {
    winner: winner,
    players: players
  });
}

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Visit http://localhost:${PORT} in local environment`);
}); 
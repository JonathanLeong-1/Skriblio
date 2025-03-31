const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const wordLists = require('./wordLists');

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

// Default word list
const defaultWords = wordLists.general;

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
  socket.on('createRoom', (data) => {
    try {
      console.log(`Attempting to create room with data:`, data);
      const { playerName, settings } = data;
      
      // Generate unique room code
      let roomId;
      do {
        roomId = generateRoomCode();
      } while (rooms[roomId]);
      
      console.log(`Generated room code: ${roomId}`);
      
      // Store player info
      const player = {
        id: socket.id,
        name: playerName,
        score: 0,
        isHost: true,
        guessedCorrectly: false
      };
      
      // Get the correct word list based on category
      let wordList = settings.wordList;
      const category = settings.wordCategory || 'general';
      
      if (!wordList && category !== 'custom') {
        if (wordLists[category]) {
          wordList = wordLists[category];
          console.log(`Using ${category} word list with ${wordList.length} words`);
        } else {
          wordList = defaultWords;
          console.log(`Category ${category} not found, using default word list`);
        }
      }
      
      // Create room
      rooms[roomId] = {
        id: roomId,
        players: { [socket.id]: player },
        currentRound: 0,
        settings: {
          rounds: settings?.rounds || 6,
          drawTime: settings?.drawTime || 60,
          wordList: wordList,
          wordCategory: category
        },
        state: 'waiting',
        currentDrawer: null,
        currentWord: null,
        wordOptions: [],
        revealedLetters: [],
        drawings: [],
        roundsData: [] // Store data for each round
      };

      socket.join(roomId);
      socket.roomId = roomId;
      
      // Send room details to creator
      socket.emit('roomCreated', { roomId, gameState: rooms[roomId] });
      console.log(`${playerName} created room ${roomId} successfully with category ${category}`);
    } catch (error) {
      console.error(`Error creating room:`, error);
      socket.emit('notification', { message: 'Error creating room. Please try again.' });
    }
  });

  // Start game
  socket.on('startGame', () => {
    const roomId = socket.roomId;
    if (!roomId || !rooms[roomId]) {
      console.log(`Room ${roomId} not found for startGame`);
      return;
    }

    const room = rooms[roomId];
    console.log(`Attempting to start game in room ${roomId}`);
    console.log(`Using word category: ${room.settings.wordCategory}, word list length: ${room.settings.wordList.length}`);
    
    // Check if player is host
    if (room.players[socket.id]?.isHost !== true) {
      console.log(`Player ${socket.id} is not host and cannot start game`);
      return;
    }
    
    // Check if enough players
    if (Object.keys(room.players).length < 2) {
      console.log(`Not enough players to start game in room ${roomId}`);
      socket.emit('notification', { message: 'Need at least 2 players to start' });
      return;
    }

    // Clear previous rounds data if restarting
    room.roundsData = [];
    
    // Start game
    room.state = 'playing';
    room.currentRound = 1;
    
    // Reset scores for all players
    for (let playerId in room.players) {
      room.players[playerId].score = 0;
      room.players[playerId].guessedCorrectly = false;
    }
    
    // Select first drawer
    const playerIds = Object.keys(room.players);
    room.currentDrawer = playerIds[0];
    
    // Generate word options
    room.wordOptions = getRandomWords(room.settings.wordList, 3);
    console.log(`Generated word options: ${room.wordOptions.join(', ')}`);
    
    // Send game state to all players
    io.to(roomId).emit('gameStarted', room);
    
    // Send word options only to drawer
    io.to(room.currentDrawer).emit('chooseWord', room.wordOptions);
    
    console.log(`Game started in room ${roomId}, drawer: ${room.players[room.currentDrawer].name}`);
  });

  // Word selection by drawer
  socket.on('selectWord', (word) => {
    const roomId = socket.roomId;
    if (!roomId || !rooms[roomId]) return;
    
    const room = rooms[roomId];
    
    // Only accept word selection from current drawer
    if (socket.id !== room.currentDrawer) return;
    
    // Set the current word
    room.currentWord = word;
    
    // Create initial hint with all letters hidden
    const hint = word.replace(/[a-zA-Z]/g, '_ ');
    room.revealedLetters = Array(word.length).fill(false);
    
    // Record start time
    room.startTime = Date.now();
    
    // Initialize current round data
    room.currentRoundData = {
      round: room.currentRound,
      word: word,
      drawer: {
        id: room.currentDrawer,
        name: room.players[room.currentDrawer].name
      },
      drawings: [],
      guessers: []
    };
    
    // Notify the drawer with the full word
    io.to(socket.id).emit('wordSelected', {
      word: word,
      hint: hint,
      drawTime: room.settings.drawTime,
      round: room.currentRound,
      drawer: room.players[room.currentDrawer].name
    });
    
    // Send hint to everyone else (except drawer)
    socket.to(roomId).emit('wordSelected', {
      word: '',
      hint: hint,
      drawTime: room.settings.drawTime,
      round: room.currentRound,
      drawer: room.players[room.currentDrawer].name
    });
    
    // Reset guessed status
    for (let playerId in room.players) {
      room.players[playerId].guessedCorrectly = false;
    }
    
    // Start round timer
    startRoundTimer(roomId);
  });

  // Handle draw line
  socket.on('drawLine', (lineData) => {
    const roomId = socket.roomId;
    if (!roomId || !rooms[roomId]) return;
    
    const room = rooms[roomId];
    
    // Only the drawer can draw
    if (socket.id === room.currentDrawer) {
      // Store drawing data for undo functionality
      const drawingAction = {
        type: 'line',
        from: lineData.from,
        to: lineData.to,
        color: lineData.color,
        brushSize: lineData.brushSize
      };
      
      room.drawings.push(drawingAction);
      
      // Also store in round data for recap
      if (room.currentRoundData) {
        room.currentRoundData.drawings.push(drawingAction);
      }
      
      // Forward to other clients
      socket.to(roomId).emit('drawLine', lineData);
    }
  });

  // Handle eraser
  socket.on('erase', (eraseData) => {
    const roomId = socket.roomId;
    if (!roomId || !rooms[roomId]) return;
    
    const room = rooms[roomId];
    
    // Store eraser action for recap
    if (socket.id === room.currentDrawer && room.currentRoundData) {
      room.currentRoundData.drawings.push({
        type: 'erase',
        from: eraseData.from,
        to: eraseData.to,
        size: eraseData.size
      });
    }
    
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
      
      // Also update in round data
      if (room.currentRoundData && room.currentRoundData.drawings.length > 0) {
        room.currentRoundData.drawings.pop();
      }
      
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
      
      // Add clear action to round data
      if (room.currentRoundData) {
        room.currentRoundData.drawings = [];
        room.currentRoundData.drawings.push({ type: 'clear' });
      }
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
        
        // Record correct guess for recap
        if (room.currentRoundData) {
          room.currentRoundData.guessers.push({
            id: socket.id,
            name: player.name,
            correct: true,
            time: Math.floor(timeElapsed)
          });
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

  // Change word category
  socket.on('changeWordCategory', (category) => {
    const roomId = socket.roomId;
    if (!roomId || !rooms[roomId]) return;
    
    const room = rooms[roomId];
    
    // Only host can change category
    if (!room.players[socket.id] || !room.players[socket.id].isHost) return;
    
    // Only allow changing in waiting state
    if (room.state !== 'waiting') return;
    
    // Update the category and word list
    if (wordLists[category] || category === 'custom') {
      room.settings.wordCategory = category;
      
      if (category !== 'custom') {
        room.settings.wordList = wordLists[category];
      }
      
      // Notify all players
      io.to(roomId).emit('categoryChanged', {
        category: category,
        settings: room.settings
      });
    }
  });
  
  // Play again with new settings
  socket.on('playAgain', (newSettings) => {
    const roomId = socket.roomId;
    if (!roomId || !rooms[roomId]) return;
    
    const room = rooms[roomId];
    
    // Only host can restart the game
    if (!room.players[socket.id] || !room.players[socket.id].isHost) return;
    
    // Only allow restart if game has ended
    if (room.state !== 'ended') return;
    
    // Update settings if provided
    if (newSettings) {
      // Get the correct word list based on category
      let wordList = newSettings.wordList;
      const category = newSettings.wordCategory || 'general';
      
      if (!wordList && category !== 'custom') {
        if (wordLists[category]) {
          wordList = wordLists[category];
        } else {
          wordList = defaultWords;
        }
      }
      
      room.settings = {
        rounds: newSettings.rounds || room.settings.rounds,
        drawTime: newSettings.drawTime || room.settings.drawTime,
        wordList: wordList,
        wordCategory: category
      };
    }
    
    // Reset game state but keep players
    room.state = 'waiting';
    room.currentRound = 0;
    room.currentDrawer = null;
    room.currentWord = null;
    
    // Reset scores
    for (let playerId in room.players) {
      room.players[playerId].score = 0;
      room.players[playerId].guessedCorrectly = false;
    }
    
    // Notify all players
    io.to(roomId).emit('gameState', room);
  });
  
  // Get game recap data
  socket.on('getRecapData', () => {
    const roomId = socket.roomId;
    if (!roomId || !rooms[roomId]) return;
    
    const room = rooms[roomId];
    
    // Only send recap if game has ended
    if (room.state !== 'ended') return;
    
    // Send all rounds data
    socket.emit('recapData', {
      rounds: room.roundsData,
      settings: room.settings
    });
  });
});

// Helper functions
function getRandomWords(wordList, count) {
  const shuffled = [...wordList].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

function startRoundTimer(roomId) {
  const room = rooms[roomId];
  
  // Calculate the maximum number of letters that can be revealed (less than 50%)
  const maxLettersToReveal = Math.floor(room.currentWord.length * 0.4);
  
  // Reveal a letter every 25% of time instead of 20%
  const letterInterval = Math.floor(room.settings.drawTime * 1000 / 4);
  
  let hintsRevealed = 0;
  
  function revealLetter() {
    // Only reveal if we haven't hit the maximum
    if (hintsRevealed < maxLettersToReveal && room.currentWord) {
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
        
        // Schedule next hint if we haven't hit the maximum
        if (hintsRevealed < maxLettersToReveal) {
          setTimeout(revealLetter, letterInterval);
        }
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
  
  // Record players who didn't guess correctly
  if (room.currentRoundData) {
    const allPlayerIds = Object.keys(room.players);
    const correctGuessers = room.currentRoundData.guessers.map(g => g.id);
    const missedPlayers = allPlayerIds.filter(id => 
      id !== room.currentDrawer && !correctGuessers.includes(id)
    );
    
    // Add missed players to guessers list
    missedPlayers.forEach(id => {
      room.currentRoundData.guessers.push({
        id: id,
        name: room.players[id].name,
        correct: false,
        time: -1 // Didn't guess
      });
    });
    
    // Save round data
    room.roundsData.push(room.currentRoundData);
    room.currentRoundData = null;
  }
  
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
  
  // Reset all players' guessedCorrectly status for the new round
  for (let playerId in room.players) {
    room.players[playerId].guessedCorrectly = false;
  }
  
  // Reset drawings
  room.drawings = [];
  
  // Log the word list info for debugging
  console.log(`Starting round ${room.currentRound} in room ${roomId}`);
  console.log(`Using category: ${room.settings.wordCategory}, list length: ${room.settings.wordList.length}`);
  
  // Generate new word options
  room.wordOptions = getRandomWords(room.settings.wordList, 3);
  console.log(`Generated word options: ${room.wordOptions.join(', ')}`);
  
  // Notify all players
  io.to(roomId).emit('newRound', {
    round: room.currentRound,
    totalRounds: room.settings.rounds,
    drawer: room.players[room.currentDrawer].name,
    drawerId: room.currentDrawer
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
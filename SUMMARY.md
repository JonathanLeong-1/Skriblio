# Skriblio - Application Summary

## Overview

Skriblio is a real-time multiplayer drawing and guessing game similar to Skribbl.io. The application allows users to create private game rooms, customize game settings, and play with friends. The core gameplay involves one player drawing a word while others try to guess it through a chat system.

## Application Structure

### Backend (Node.js/Express/Socket.IO)

- **server.js**: Main server file that sets up Express, HTTP server, and Socket.IO
  - Handles room creation and management
  - Manages game state (players, scores, rounds, words)
  - Processes real-time drawing data and chat messages
  - Controls game flow (round starts/ends, word selection, timers)

### Frontend

- **index.html**: Main HTML file containing all screens and UI elements
  - Includes all game screens (main menu, room creation, waiting room, game screen, etc.)
  - Contains the canvas element for drawing
  - Provides chat interface and player lists

- **css/styles.css**: Styling for the entire application
  - Responsive design that works on both desktop and mobile
  - Clean and minimal UI with a blue color theme
  - Different styles for each game state and UI component

- **js/main.js**: Client-side JavaScript that handles:
  - Socket.IO communication with server
  - Drawing functionality using HTML5 Canvas
  - UI transitions between different game states
  - Chat and guessing mechanics
  - Score updates and notifications

## Key Features Implementation

### Room System
- Rooms are identified by a 6-character UUID
- Room state is stored in server memory
- Players can create or join rooms via codes

### Drawing System
- Uses HTML5 Canvas for drawing
- Real-time drawing data transmitted via Socket.IO
- Multiple brush sizes and colors
- Mobile-responsive with touch support

### Word Selection & Hints
- Drawer chooses one of three random words
- Word is displayed as underscores to guessers
- Letters are gradually revealed as hints during the round

### Chat & Guessing
- Real-time chat using Socket.IO
- Automatic word matching for correct guesses
- Players who guess correctly are prevented from further chat
- System messages for game events

### Scoring System
- Points awarded based on guessing speed
- Drawer earns points when others guess correctly
- Scores updated in real-time
- Final rankings displayed at the end of the game

## Technical Highlights

1. **Real-time Communication**: Uses Socket.IO for bidirectional, event-based communication between clients and server.

2. **Stateful Game Management**: Server maintains game state for multiple concurrent rooms.

3. **Canvas Drawing**: Implements efficient drawing with event handling for both mouse and touch inputs.

4. **Responsive Design**: UI adapts to different screen sizes with appropriate layouts.

5. **Event-Driven Architecture**: Both client and server use event listeners to respond to game events.

6. **Game Flow Control**: Implements timeouts and intervals for managing game progression.

## Deployment Considerations

- The application can be run locally for LAN play
- Can be deployed to cloud platforms for online play
- Scales well for small to medium player groups
- Uses minimal resources as it's primarily stateful rather than database-driven 
# Skriblio - A Drawing & Guessing Game

A real-time multiplayer drawing and guessing game inspired by Skribbl.io, built with Node.js, Express, and Socket.IO.

## Features

- Create private rooms or join existing ones with a 6-digit code
- Customizable game settings (rounds, draw time, custom word lists)
- Real-time drawing canvas with color and brush size options
- Chat system for guessing words
- Dynamic scoring system based on guessing speed
- Gradually revealing word hints
- Round-by-round scoring and final leaderboard

## Requirements

- Node.js 14.x or higher
- npm (comes with Node.js)

## Installation

### Installing Node.js and npm

First, make sure you have Node.js and npm installed:

#### macOS
1. Using Homebrew (recommended):
   ```bash
   brew install node
   ```
   
2. Or download the installer from [Node.js official website](https://nodejs.org/)

#### Windows
1. Download the installer from [Node.js official website](https://nodejs.org/)
2. Run the installer and follow the installation wizard

#### Linux
```bash
sudo apt update
sudo apt install nodejs npm
```

### Setting up the game

1. Clone or download this repository
2. Navigate to the project directory in your terminal
3. Install dependencies:

```bash
npm install
```

## Running the Game

1. Start the server:

```bash
npm start
```

2. Open your browser and navigate to:

```
http://localhost:3000
```

3. Enter your name and either create a new room or join an existing one with a room code

4. Share the room code with friends so they can join your game

5. Once all players have joined, the host can start the game

## How to Play

### For the Drawer:

1. When it's your turn to draw, you'll be presented with three words to choose from
2. After selecting a word, use the drawing tools to illustrate it
3. You earn points when other players correctly guess your drawing

### For the Guessers:

1. Watch the drawing unfold and try to guess the word by typing in the chat
2. The faster you guess correctly, the more points you earn
3. Letters in the word will be gradually revealed as hints

## Gameplay Rules

- Each round has one drawer and everyone else guesses
- The drawer selects from three word options
- Guessers type their guesses in the chat box
- Points are awarded based on how quickly correct guesses are made
- Players who have already guessed correctly can't chat until the next round
- Each round has a time limit (default: 80 seconds)
- After all rounds are completed, the player with the highest score wins

## Playing with Friends

For local network play:
1. Make sure all players are on the same network
2. The host should start the server on their computer
3. Other players can connect using the host's local IP address + port (e.g., `http://192.168.1.100:3000`)

For online play (requires additional setup):
1. Deploy to a cloud platform like Heroku, Vercel, or AWS
2. Share the public URL with friends

## Technologies Used

- **Frontend**: HTML, CSS, JavaScript
- **Backend**: Node.js, Express
- **Real-time Communication**: Socket.IO
- **Drawing**: HTML5 Canvas API

## Troubleshooting

- **Can't connect to the game**: Make sure the server is running and you're using the correct URL
- **Drawing doesn't appear**: Check if your browser supports HTML5 Canvas
- **Players can't join room**: Verify the room code is correct and the server is running
- **Performance issues**: Close other browser tabs or applications that might be using resources 
# Getting Started with Game Launcher

This guide will help you get up and running with the Game Launcher library quickly. You'll learn how to install, configure, and use the library to manage game processes.

## 📋 Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Basic Usage](#basic-usage)
- [Event Handling](#event-handling)
- [Common Patterns](#common-patterns)
- [Troubleshooting](#troubleshooting)
- [Next Steps](#next-steps)

## 📦 Installation

### Prerequisites

- **Node.js** 16.0.0 or higher
- **npm**, **yarn**, or **bun** package manager
- **TypeScript** 4.5.0 or higher (for TypeScript projects)

### Install the Package

```bash
# Using npm
npm install game-launcher

# Using yarn
yarn add game-launcher

# Using bun
bun add game-launcher
```

### TypeScript Support

The library includes built-in TypeScript definitions. No additional `@types` packages are needed.

```typescript
// TypeScript - full type support
import { GameLauncher, GameLauncherOptions } from 'game-launcher';

// JavaScript - works too!
const { GameLauncher } = require('game-launcher');
```

## 🚀 Quick Start

Here's a minimal example to get you started:

```typescript
import { GameLauncher } from 'game-launcher';

// Create a launcher instance
const launcher = new GameLauncher();

// Launch a game
async function launchMyGame() {
  try {
    const gameId = await launcher.launchGame({
      gameId: 'my-awesome-game',
      executable: '/path/to/game.exe',
      args: ['--fullscreen', '--high-quality']
    });
    
    console.log(`Game launched with ID: ${gameId}`);
  } catch (error) {
    console.error('Failed to launch game:', error.message);
  }
}

launchMyGame();
```

### Platform-Specific Examples

#### Windows

```typescript
const gameId = await launcher.launchGame({
  gameId: 'steam-game',
  executable: 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\MyGame\\game.exe',
  args: ['-windowed']
});
```

#### macOS

```typescript
const gameId = await launcher.launchGame({
  gameId: 'mac-game',
  executable: '/Applications/MyGame.app/Contents/MacOS/MyGame',
  args: ['--resolution=1920x1080']
});
```

#### Linux

```typescript
const gameId = await launcher.launchGame({
  gameId: 'linux-game',
  executable: '/usr/local/games/mygame/mygame',
  args: ['--opengl']
});
```

## 🎮 Basic Usage

### Creating a Launcher Instance

```typescript
import { GameLauncher } from 'game-launcher';

// Default configuration
const launcher = new GameLauncher();

// Custom configuration
const launcher = new GameLauncher({
  monitoringInterval: 1000, // Check process status every second
  maxRetries: 3,           // Retry failed operations 3 times
  timeout: 30000           // 30 second timeout for operations
});
```

### Launching Games

```typescript
// Basic launch
const gameId = await launcher.launchGame({
  gameId: 'my-game',
  executable: '/path/to/game.exe'
});

// Launch with arguments
const gameId = await launcher.launchGame({
  gameId: 'my-game',
  executable: '/path/to/game.exe',
  args: ['--fullscreen', '--difficulty=hard']
});

// Launch with custom environment
const gameId = await launcher.launchGame({
  gameId: 'my-game',
  executable: '/path/to/game.exe',
  environment: {
    GAME_MODE: 'development',
    DEBUG_LEVEL: '2'
  }
});

// Launch with working directory
const gameId = await launcher.launchGame({
  gameId: 'my-game',
  executable: '/path/to/game.exe',
  workingDirectory: '/path/to/game/data'
});
```

### Managing Running Games

```typescript
// Check if a game is running
const isRunning = await launcher.isGameRunning('my-game');
console.log(`Game is ${isRunning ? 'running' : 'not running'}`);

// Get all running games
const runningGames = await launcher.getRunningGames();
console.log('Running games:', runningGames);

// Get detailed game information
const gameInfo = await launcher.getGameInfo('my-game');
if (gameInfo) {
  console.log('Game PID:', gameInfo.pid);
  console.log('Game status:', gameInfo.status);
  console.log('Game executable:', gameInfo.executable);
}

// Close a game
try {
  await launcher.closeGame('my-game');
  console.log('Game closed successfully');
} catch (error) {
  console.error('Failed to close game:', error.message);
}
```

## 📡 Event Handling

The Game Launcher uses an event-driven architecture to notify you about game state changes.

### Basic Event Listeners

```typescript
import { GameLauncher } from 'game-launcher';

const launcher = new GameLauncher();

// Game launched successfully
launcher.on('launched', (event) => {
  console.log(`🚀 Game ${event.gameId} launched!`);
  console.log(`PID: ${event.pid}`);
  console.log(`Executable: ${event.executable}`);
});

// Game closed
launcher.on('closed', (event) => {
  console.log(`🔴 Game ${event.gameId} closed`);
  console.log(`Exit code: ${event.exitCode}`);
  console.log(`Duration: ${event.duration}ms`);
});

// Game error
launcher.on('error', (event) => {
  console.error(`❌ Game ${event.gameId} error:`, event.error.message);
});

// Game output (stdout/stderr)
launcher.on('output', (event) => {
  console.log(`📝 ${event.gameId} [${event.type}]:`, event.data);
});

// Game status changes
launcher.on('statusChange', (event) => {
  console.log(`📊 ${event.gameId} status: ${event.oldStatus} → ${event.newStatus}`);
});
```

### Advanced Event Handling

```typescript
// Handle specific game events
launcher.on('launched', (event) => {
  if (event.gameId === 'important-game') {
    console.log('Important game started - enabling monitoring');
    // Start additional monitoring for this specific game
  }
});

// Handle detached processes (GUI applications)
launcher.on('statusChange', (event) => {
  if (event.newStatus === 'detached') {
    console.log(`${event.gameId} has detached - this is normal for GUI apps`);
  }
});

// Error recovery
launcher.on('error', async (event) => {
  console.error(`Game ${event.gameId} encountered an error:`, event.error.message);
  
  // Attempt to restart the game
  if (event.error.message.includes('crashed')) {
    console.log('Attempting to restart crashed game...');
    try {
      await launcher.launchGame({
        gameId: event.gameId + '-restart',
        executable: event.executable
      });
    } catch (restartError) {
      console.error('Failed to restart game:', restartError.message);
    }
  }
});

// Remove event listeners
const errorHandler = (event) => {
  console.error('Game error:', event.error.message);
};

launcher.on('error', errorHandler);

// Later, remove the specific handler
launcher.off('error', errorHandler);

// Or remove all handlers for an event
launcher.removeAllListeners('error');
```

## 🔄 Common Patterns

### Pattern 1: Game Session Manager

```typescript
class GameSessionManager {
  private launcher = new GameLauncher();
  private sessions = new Map<string, { startTime: Date; gameId: string }>();
  
  constructor() {
    this.setupEventHandlers();
  }
  
  private setupEventHandlers() {
    this.launcher.on('launched', (event) => {
      this.sessions.set(event.gameId, {
        startTime: new Date(),
        gameId: event.gameId
      });
      console.log(`Session started for ${event.gameId}`);
    });
    
    this.launcher.on('closed', (event) => {
      const session = this.sessions.get(event.gameId);
      if (session) {
        const duration = Date.now() - session.startTime.getTime();
        console.log(`Session ended for ${event.gameId}. Duration: ${this.formatDuration(duration)}`);
        this.sessions.delete(event.gameId);
      }
    });
  }
  
  async startGame(gameId: string, executable: string, args?: string[]) {
    return await this.launcher.launchGame({ gameId, executable, args });
  }
  
  async stopGame(gameId: string) {
    return await this.launcher.closeGame(gameId);
  }
  
  getActiveSessions() {
    return Array.from(this.sessions.values());
  }
  
  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }
}

// Usage
const sessionManager = new GameSessionManager();
await sessionManager.startGame('my-game', '/path/to/game.exe');
```

### Pattern 2: Game Library Manager

```typescript
interface GameConfig {
  gameId: string;
  name: string;
  executable: string;
  args?: string[];
  workingDirectory?: string;
  category?: string;
}

class GameLibraryManager {
  private launcher = new GameLauncher();
  private games = new Map<string, GameConfig>();
  
  addGame(config: GameConfig) {
    this.games.set(config.gameId, config);
    console.log(`Added game: ${config.name}`);
  }
  
  async launchGame(gameId: string): Promise<string> {
    const config = this.games.get(gameId);
    if (!config) {
      throw new Error(`Game ${gameId} not found in library`);
    }
    
    console.log(`Launching ${config.name}...`);
    return await this.launcher.launchGame({
      gameId: config.gameId,
      executable: config.executable,
      args: config.args,
      workingDirectory: config.workingDirectory
    });
  }
  
  async closeGame(gameId: string) {
    const config = this.games.get(gameId);
    if (!config) {
      throw new Error(`Game ${gameId} not found in library`);
    }
    
    console.log(`Closing ${config.name}...`);
    return await this.launcher.closeGame(gameId);
  }
  
  getGamesByCategory(category: string): GameConfig[] {
    return Array.from(this.games.values())
      .filter(game => game.category === category);
  }
  
  async getRunningGames(): Promise<GameConfig[]> {
    const runningGameIds = await this.launcher.getRunningGames();
    return runningGameIds
      .map(gameId => this.games.get(gameId))
      .filter(game => game !== undefined) as GameConfig[];
  }
}

// Usage
const library = new GameLibraryManager();

library.addGame({
  gameId: 'minecraft',
  name: 'Minecraft',
  executable: '/path/to/minecraft.exe',
  args: ['--fullscreen'],
  category: 'sandbox'
});

library.addGame({
  gameId: 'chess',
  name: 'Chess Game',
  executable: '/path/to/chess.exe',
  category: 'strategy'
});

// Launch a game
await library.launchGame('minecraft');

// Get running games
const running = await library.getRunningGames();
console.log('Currently running:', running.map(g => g.name));
```

### Pattern 3: Auto-Restart on Crash

```typescript
class RobustGameLauncher {
  private launcher = new GameLauncher();
  private restartAttempts = new Map<string, number>();
  private maxRestartAttempts = 3;
  
  constructor() {
    this.setupCrashRecovery();
  }
  
  private setupCrashRecovery() {
    this.launcher.on('error', async (event) => {
      const attempts = this.restartAttempts.get(event.gameId) || 0;
      
      if (attempts < this.maxRestartAttempts) {
        console.log(`Game ${event.gameId} crashed. Restart attempt ${attempts + 1}/${this.maxRestartAttempts}`);
        
        this.restartAttempts.set(event.gameId, attempts + 1);
        
        // Wait a bit before restarting
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        try {
          await this.launcher.launchGame({
            gameId: event.gameId,
            executable: event.executable
          });
          console.log(`Successfully restarted ${event.gameId}`);
        } catch (restartError) {
          console.error(`Failed to restart ${event.gameId}:`, restartError.message);
        }
      } else {
        console.error(`Game ${event.gameId} has crashed too many times. Giving up.`);
        this.restartAttempts.delete(event.gameId);
      }
    });
    
    this.launcher.on('launched', (event) => {
      // Reset restart attempts on successful launch
      this.restartAttempts.delete(event.gameId);
    });
  }
  
  async launchGame(gameId: string, executable: string, args?: string[]) {
    return await this.launcher.launchGame({ gameId, executable, args });
  }
}

// Usage
const robustLauncher = new RobustGameLauncher();
await robustLauncher.launchGame('unstable-game', '/path/to/game.exe');
```

## 🔧 Troubleshooting

### Common Issues and Solutions

#### Issue: "Game not found" or "Executable not found"

```typescript
// ❌ Problem: Incorrect path
const gameId = await launcher.launchGame({
  gameId: 'my-game',
  executable: 'game.exe' // Relative path might not work
});

// ✅ Solution: Use absolute path
import path from 'path';

const gameId = await launcher.launchGame({
  gameId: 'my-game',
  executable: path.resolve('./game.exe') // Convert to absolute path
});

// ✅ Better: Validate executable first
import { validateExecutable } from 'game-launcher';

try {
  await validateExecutable('./game.exe');
  const gameId = await launcher.launchGame({
    gameId: 'my-game',
    executable: './game.exe'
  });
} catch (error) {
  console.error('Executable validation failed:', error.message);
}
```

#### Issue: Game launches but immediately closes

```typescript
// This might be a GUI application that detaches
launcher.on('statusChange', (event) => {
  if (event.newStatus === 'detached') {
    console.log(`${event.gameId} has detached - this is normal for GUI applications`);
  }
});

// Check if the game is actually running
setTimeout(async () => {
  const isRunning = await launcher.isGameRunning('my-game');
  console.log('Game still running:', isRunning);
}, 5000);
```

#### Issue: Permission denied errors

```bash
# On Unix systems, ensure the executable has execute permissions
chmod +x /path/to/game

# On Windows, run as administrator if needed
```

#### Issue: Environment variables not working

```typescript
// ✅ Correct way to set environment variables
const gameId = await launcher.launchGame({
  gameId: 'my-game',
  executable: '/path/to/game.exe',
  environment: {
    // Inherit existing environment and add new variables
    ...process.env,
    GAME_MODE: 'debug',
    CUSTOM_VAR: 'value'
  }
});
```

### Debug Mode

```typescript
// Enable verbose logging for debugging
const launcher = new GameLauncher({
  // Add debug options if available in your configuration
});

// Listen to all events for debugging
launcher.on('launched', (event) => console.log('DEBUG: Game launched', event));
launcher.on('closed', (event) => console.log('DEBUG: Game closed', event));
launcher.on('error', (event) => console.log('DEBUG: Game error', event));
launcher.on('output', (event) => console.log('DEBUG: Game output', event));
launcher.on('statusChange', (event) => console.log('DEBUG: Status change', event));
```

### Performance Tips

```typescript
// Adjust monitoring interval based on your needs
const launcher = new GameLauncher({
  monitoringInterval: 2000 // Check every 2 seconds instead of default 1 second
});

// Clean up when done
process.on('exit', () => {
  launcher.destroy();
});

// Remove event listeners when no longer needed
const handler = (event) => { /* ... */ };
launcher.on('launched', handler);

// Later...
launcher.off('launched', handler);
```

## 🎯 Next Steps

Now that you've learned the basics, explore these advanced topics:

1. **[Configuration Guide](configuration.md)** - Learn about advanced configuration options
2. **[API Reference](../api/README.md)** - Detailed API documentation
3. **[Event System](../api/events.md)** - Deep dive into the event system
4. **[Best Practices](best-practices.md)** - Learn recommended patterns and practices
5. **[Examples](../examples/)** - See real-world usage examples

### Example Projects

Check out these example projects to see the Game Launcher in action:

- **Simple Game Manager** - Basic game launching and monitoring
- **Steam-like Launcher** - Full-featured game library manager
- **Game Server Manager** - Managing dedicated game servers
- **Playtime Tracker** - Track and analyze gaming sessions

### Community and Support

- **GitHub Issues** - Report bugs and request features
- **Discussions** - Ask questions and share ideas
- **Examples Repository** - Community-contributed examples

---

**Happy Gaming! 🎮**
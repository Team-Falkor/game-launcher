# Simple Game Launcher

This example demonstrates the most basic usage of the Game Launcher library - launching a single game and handling its lifecycle.

## Overview

The Simple Game Launcher example shows how to:
- Initialize the GameLauncher
- Launch a game with basic options
- Handle game events (launched, closed, error)
- Clean up resources properly

## Prerequisites

- Node.js 16.0.0 or higher
- Game Launcher library installed
- A game executable to test with

## Installation

```bash
# Install the Game Launcher library
npm install game-launcher

# For TypeScript (recommended)
npm install -D typescript @types/node
```

## Code

### TypeScript Version

```typescript
import { GameLauncher } from 'game-launcher';
import path from 'path';

/**
 * Simple Game Launcher Example
 * Demonstrates basic game launching and event handling
 */
async function simpleLauncher() {
  // Initialize the GameLauncher with basic options
  const launcher = new GameLauncher({
    // Optional: Set a custom timeout for game operations
    timeout: 30000, // 30 seconds
    
    // Optional: Enable detailed logging
    verbose: true
  });

  try {
    console.log('🎮 Starting Simple Game Launcher...');

    // Set up event listeners before launching
    launcher.on('launched', (event) => {
      console.log(`✅ Game launched successfully!`);
      console.log(`   Game ID: ${event.gameId}`);
      console.log(`   Process ID: ${event.pid}`);
      console.log(`   Executable: ${event.executable}`);
    });

    launcher.on('closed', (event) => {
      console.log(`🔴 Game closed`);
      console.log(`   Game ID: ${event.gameId}`);
      console.log(`   Exit Code: ${event.exitCode}`);
      console.log(`   Runtime: ${event.runtime}ms`);
    });

    launcher.on('error', (event) => {
      console.error(`❌ Game error occurred:`);
      console.error(`   Game ID: ${event.gameId}`);
      console.error(`   Error: ${event.error.message}`);
    });

    // Launch a game - replace with your game's executable
    const gameOptions = {
      gameId: 'my-test-game',
      executable: getTestExecutable(), // Platform-specific test executable
      args: [], // Command line arguments (if needed)
      
      // Optional: Set working directory
      // cwd: '/path/to/game/directory',
      
      // Optional: Set environment variables
      // env: { GAME_MODE: 'debug' },
      
      // Optional: Detach the process (recommended for games)
      detached: true
    };

    console.log(`🚀 Launching game: ${gameOptions.executable}`);
    const gameId = await launcher.launchGame(gameOptions);
    
    console.log(`📋 Game launched with ID: ${gameId}`);
    
    // Optional: Check if game is running
    const isRunning = launcher.isGameRunning(gameId);
    console.log(`🔍 Game running status: ${isRunning}`);
    
    // Optional: Get game information
    const gameInfo = launcher.getGameInfo(gameId);
    if (gameInfo) {
      console.log(`📊 Game Info:`);
      console.log(`   PID: ${gameInfo.pid}`);
      console.log(`   Status: ${gameInfo.status}`);
      console.log(`   Start Time: ${gameInfo.startTime}`);
    }

    // Wait for the game to close naturally
    // In a real application, you might want to do other work here
    console.log('⏳ Waiting for game to close...');
    
    // Optional: Set up a timeout to close the game after a certain time
    // setTimeout(() => {
    //   if (launcher.isGameRunning(gameId)) {
    //     console.log('⏰ Timeout reached, closing game...');
    //     launcher.closeGame(gameId);
    //   }
    // }, 60000); // Close after 1 minute

  } catch (error) {
    console.error('💥 Failed to launch game:', error);
  } finally {
    // Clean up resources
    console.log('🧹 Cleaning up...');
    launcher.destroy();
  }
}

/**
 * Get a platform-specific test executable
 * Replace this with your actual game executable
 */
function getTestExecutable(): string {
  const platform = process.platform;
  
  switch (platform) {
    case 'win32':
      // Windows - use Notepad as a simple test
      return 'notepad.exe';
    
    case 'darwin':
      // macOS - use TextEdit
      return '/System/Applications/TextEdit.app/Contents/MacOS/TextEdit';
    
    case 'linux':
    default:
      // Linux - use a simple sleep command
      return '/bin/sleep';
  }
}

// Run the example
if (require.main === module) {
  simpleLauncher()
    .then(() => {
      console.log('✨ Example completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Example failed:', error);
      process.exit(1);
    });
}

export { simpleLauncher };
```

### JavaScript Version

```javascript
const { GameLauncher } = require('game-launcher');
const path = require('path');

/**
 * Simple Game Launcher Example (JavaScript)
 */
async function simpleLauncher() {
  const launcher = new GameLauncher({
    timeout: 30000,
    verbose: true
  });

  try {
    console.log('🎮 Starting Simple Game Launcher...');

    // Event listeners
    launcher.on('launched', (event) => {
      console.log(`✅ Game launched: ${event.gameId} (PID: ${event.pid})`);
    });

    launcher.on('closed', (event) => {
      console.log(`🔴 Game closed: ${event.gameId} (Exit: ${event.exitCode})`);
    });

    launcher.on('error', (event) => {
      console.error(`❌ Game error: ${event.gameId} - ${event.error.message}`);
    });

    // Launch game
    const gameId = await launcher.launchGame({
      gameId: 'my-test-game',
      executable: getTestExecutable(),
      detached: true
    });

    console.log(`📋 Game launched with ID: ${gameId}`);
    console.log('⏳ Waiting for game to close...');

  } catch (error) {
    console.error('💥 Failed to launch game:', error);
  } finally {
    launcher.destroy();
  }
}

function getTestExecutable() {
  switch (process.platform) {
    case 'win32':
      return 'notepad.exe';
    case 'darwin':
      return '/System/Applications/TextEdit.app/Contents/MacOS/TextEdit';
    default:
      return '/bin/sleep';
  }
}

// Run if called directly
if (require.main === module) {
  simpleLauncher()
    .then(() => console.log('✨ Example completed!'))
    .catch((error) => console.error('💥 Example failed:', error));
}

module.exports = { simpleLauncher };
```

## Usage

### Running the Example

```bash
# TypeScript
npx ts-node simple-launcher.ts

# JavaScript
node simple-launcher.js

# With bun
bun run simple-launcher.ts
```

### Expected Output

```
🎮 Starting Simple Game Launcher...
🚀 Launching game: notepad.exe
📋 Game launched with ID: my-test-game
🔍 Game running status: true
📊 Game Info:
   PID: 12345
   Status: running
   Start Time: 2024-01-15T10:30:00.000Z
✅ Game launched successfully!
   Game ID: my-test-game
   Process ID: 12345
   Executable: notepad.exe
⏳ Waiting for game to close...
🔴 Game closed
   Game ID: my-test-game
   Exit Code: 0
   Runtime: 5432ms
🧹 Cleaning up...
✨ Example completed successfully!
```

## Customization

### Using Your Own Game

Replace the `getTestExecutable()` function with your game's path:

```typescript
const gameOptions = {
  gameId: 'my-awesome-game',
  executable: '/path/to/your/game.exe',
  args: ['--fullscreen', '--level=1'],
  cwd: '/path/to/game/directory',
  env: {
    GAME_MODE: 'production',
    GRAPHICS_QUALITY: 'high'
  },
  detached: true
};
```

### Adding Game Arguments

```typescript
// For a game that accepts command line arguments
const gameOptions = {
  gameId: 'strategy-game',
  executable: 'game.exe',
  args: [
    '--resolution=1920x1080',
    '--fullscreen',
    '--difficulty=hard',
    '--save-slot=1'
  ]
};
```

### Setting Working Directory

```typescript
// If your game needs to run from a specific directory
const gameOptions = {
  gameId: 'indie-game',
  executable: './game.exe',
  cwd: '/path/to/game/installation',
  detached: true
};
```

### Environment Variables

```typescript
// Pass environment variables to the game
const gameOptions = {
  gameId: 'configurable-game',
  executable: 'game.exe',
  env: {
    ...process.env, // Inherit current environment
    GAME_CONFIG: 'production.json',
    DEBUG_MODE: 'false',
    LANGUAGE: 'en-US'
  }
};
```

## Error Handling

### Common Errors and Solutions

```typescript
try {
  const gameId = await launcher.launchGame(gameOptions);
} catch (error) {
  if (error.code === 'ENOENT') {
    console.error('❌ Game executable not found!');
    console.error('   Check the executable path and ensure the file exists.');
  } else if (error.code === 'EACCES') {
    console.error('❌ Permission denied!');
    console.error('   Ensure the executable has proper permissions.');
  } else if (error.message.includes('timeout')) {
    console.error('❌ Game launch timeout!');
    console.error('   The game took too long to start.');
  } else {
    console.error('❌ Unknown error:', error.message);
  }
}
```

### Robust Error Handling

```typescript
async function robustLauncher() {
  const launcher = new GameLauncher({ timeout: 30000 });
  
  try {
    // Validate executable exists before launching
    const fs = require('fs').promises;
    try {
      await fs.access(gameOptions.executable);
    } catch {
      throw new Error(`Executable not found: ${gameOptions.executable}`);
    }
    
    const gameId = await launcher.launchGame(gameOptions);
    
    // Set up error recovery
    launcher.on('error', async (event) => {
      console.error(`Game error: ${event.error.message}`);
      
      // Attempt to restart the game
      if (event.error.message.includes('crashed')) {
        console.log('Attempting to restart game...');
        try {
          await launcher.launchGame(gameOptions);
        } catch (restartError) {
          console.error('Failed to restart game:', restartError);
        }
      }
    });
    
  } catch (error) {
    console.error('Launch failed:', error.message);
  } finally {
    launcher.destroy();
  }
}
```

## Troubleshooting

### Game Won't Launch

1. **Check executable path**: Ensure the path is correct and the file exists
2. **Verify permissions**: Make sure the executable has run permissions
3. **Test manually**: Try running the game from command line first
4. **Check dependencies**: Ensure all game dependencies are installed

### Game Launches but Events Don't Fire

1. **Add event listeners before launching**: Events must be registered first
2. **Check detached option**: Some games require `detached: true`
3. **Increase timeout**: Some games take longer to start

### Process Doesn't Close Properly

1. **Use launcher.destroy()**: Always clean up resources
2. **Handle process.exit**: Ensure cleanup on application exit
3. **Check for zombie processes**: Monitor system processes

```typescript
// Proper cleanup on exit
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT, cleaning up...');
  launcher.destroy();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, cleaning up...');
  launcher.destroy();
  process.exit(0);
});
```

## Next Steps

After mastering the simple launcher, explore:

1. **[Event Handling](event-handling.md)** - Advanced event management
2. **[Multiple Games](multiple-games.md)** - Managing several games
3. **[Configuration Guide](../guides/configuration.md)** - Advanced configuration
4. **[Best Practices](../guides/best-practices.md)** - Production-ready patterns

## Related Examples

- **[Event Handling](event-handling.md)** - Detailed event system usage
- **[Steam Integration](steam-integration.md)** - Launching Steam games
- **[Playtime Tracker](playtime-tracker.md)** - Track gaming sessions

---

**Ready to launch your first game? 🚀**
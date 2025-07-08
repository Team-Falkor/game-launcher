# API Reference

This section provides comprehensive documentation for all APIs, interfaces, and types available in the Game Launcher library.

## 📋 Table of Contents

- [GameLauncher Class](#gamelauncher-class)
- [Events System](#events-system)
- [Type Definitions](#type-definitions)
- [Utility Functions](#utility-functions)
- [Error Handling](#error-handling)

## 🎮 GameLauncher Class

The main class for managing game processes. See [GameLauncher.md](./GameLauncher.md) for detailed documentation.

```typescript
import GameLauncher from '@team-falkor/game-launcher';

const launcher = new GameLauncher(options);
```

### Quick Reference

| Method | Description | Returns |
|--------|-------------|----------|
| `launchGame(options)` | Launch a new game process | `Promise<string>` |
| `closeGame(gameId, force?)` | Close a running game | `Promise<boolean>` |
| `isGameRunning(gameId)` | Check if game is running | `boolean` |
| `getRunningGames()` | Get list of running games | `string[]` |
| `getGameInfo(gameId)` | Get detailed game information | `GameProcessInfo \| null` |
| `on(event, listener)` | Add event listener | `this` |
| `off(event, listener)` | Remove event listener | `this` |
| `removeAllListeners(event?)` | Remove all listeners | `this` |
| `destroy()` | Clean up resources | `void` |

## 📡 Events System

Comprehensive event system for monitoring game lifecycle. See [events.md](./events.md) for detailed documentation.

### Available Events

| Event | Description | Data Type |
|-------|-------------|----------|
| `launched` | Game successfully launched | `GameLaunchedEvent` |
| `closed` | Game process closed | `GameClosedEvent` |
| `error` | Error occurred | `GameErrorEvent` |
| `output` | Process output received | `GameOutputEvent` |
| `statusChange` | Game status changed | `GameStatusChangeEvent` |

### Event Usage

```typescript
launcher.on('launched', (data) => {
  console.log(`Game ${data.gameId} launched with PID ${data.pid}`);
});

launcher.on('closed', (data) => {
  console.log(`Game ${data.gameId} closed with exit code ${data.exitCode}`);
});

launcher.on('error', (data) => {
  console.error(`Error in ${data.gameId}: ${data.error.message}`);
});
```

## 📝 Type Definitions

Complete TypeScript type definitions. See [types.md](./types.md) for detailed documentation.

### Core Interfaces

- `GameLauncherOptions` - Configuration options for the launcher
- `LaunchGameOptions` - Options for launching a game
- `GameProcessInfo` - Information about a running game process
- `ProcessManagerOptions` - Process manager configuration
- `ProcessStartOptions` - Process startup options

### Event Interfaces

- `GameProcessEvents` - Event handler signatures
- `GameLaunchedEvent` - Game launch event data
- `GameClosedEvent` - Game close event data
- `GameErrorEvent` - Error event data
- `GameOutputEvent` - Output event data
- `GameStatusChangeEvent` - Status change event data

### Enums and Types

- `GameStatus` - Process status enumeration
- `Platform` - Supported platform types

## 🛠️ Utility Functions

Helper functions and utilities. See [utilities.md](./utilities.md) for detailed documentation.

### Validation

```typescript
import { validateGameId, validateExecutable } from '@team-falkor/game-launcher';

// Validate game ID format
validateGameId('my-game-123'); // throws if invalid

// Validate executable exists and is executable
await validateExecutable('/path/to/game.exe'); // throws if invalid
```

### Platform Detection

```typescript
import { getPlatform, getKillSignal } from '@team-falkor/game-launcher';

const platform = getPlatform(); // 'win32' | 'darwin' | 'linux' | 'other'
const signal = getKillSignal(false); // 'SIGTERM' or 'SIGKILL'
```

## ⚠️ Error Handling

The library uses standard JavaScript Error objects with descriptive messages. Common error scenarios:

### Launch Errors

```typescript
try {
  await launcher.launchGame({
    gameId: 'my-game',
    executable: '/invalid/path'
  });
} catch (error) {
  if (error.message.includes('not found')) {
    console.error('Executable not found');
  } else if (error.message.includes('already running')) {
    console.error('Game is already running');
  } else if (error.message.includes('Maximum concurrent')) {
    console.error('Too many games running');
  }
}
```

### Validation Errors

```typescript
try {
  validateGameId('invalid-id-with-spaces!');
} catch (error) {
  console.error('Invalid game ID format:', error.message);
}
```

### Process Errors

Process errors are emitted through the `error` event:

```typescript
launcher.on('error', (data) => {
  console.error(`Error in ${data.gameId} during ${data.phase}:`, data.error.message);
  
  switch (data.phase) {
    case 'launch':
      // Handle launch errors
      break;
    case 'runtime':
      // Handle runtime errors
      break;
    case 'cleanup':
      // Handle cleanup errors
      break;
  }
});
```

## 🔗 Quick Links

- [GameLauncher Class Documentation](./GameLauncher.md)
- [Events Documentation](./events.md)
- [Types Documentation](./types.md)
- [Utilities Documentation](./utilities.md)
- [Getting Started Guide](../guides/getting-started.md)
- [Configuration Guide](../guides/configuration.md)

## 📚 Examples

For practical examples and usage patterns, see:

- [Basic Usage Examples](../examples/basic-usage.md)
- [Advanced Usage Examples](../examples/advanced-usage.md)
- [Platform-Specific Examples](../examples/platform-specific.md)

---

**Need help?** Check the [Troubleshooting Guide](../guides/troubleshooting.md) or [create an issue](https://github.com/your-org/game-launcher/issues).
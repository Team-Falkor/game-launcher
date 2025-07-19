# GameLauncher Class

The `GameLauncher` class is the main interface for managing game processes. It provides methods for launching, monitoring, and controlling game applications with comprehensive event handling.

## 📋 Table of Contents

- [Constructor](#constructor)
- [Methods](#methods)
- [Events](#events)
- [Properties](#properties)
- [Examples](#examples)
- [Error Handling](#error-handling)

## 🏗️ Constructor

### `new GameLauncher(options?)`

Creates a new GameLauncher instance with optional configuration.

```typescript
const launcher = new GameLauncher({
  maxConcurrentGames: 5,
  enableProcessMonitoring: true,
  monitoringInterval: 1000,
  defaultWorkingDirectory: '/path/to/games',
  defaultEnvironment: {
    GAME_MODE: 'production'
  }
});
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `options` | `GameLauncherOptions` | Optional configuration object |

#### GameLauncherOptions

```typescript
interface GameLauncherOptions {
  /** Maximum number of concurrent games (default: 10) */
  maxConcurrentGames?: number;
  
  /** Default working directory for games */
  defaultWorkingDirectory?: string;
  
  /** Default environment variables */
  defaultEnvironment?: Record<string, string>;
  
  /** Enable process monitoring (default: true) */
  enableProcessMonitoring?: boolean;
  
  /** Monitoring interval in milliseconds (default: 1000) */
  monitoringInterval?: number;
}
```

## 🔧 Methods

### `launchGame(options)`

Launches a new game process with the specified options.

```typescript
const gameId = await launcher.launchGame({
  gameId: 'my-game-1',
  executable: '/path/to/game.exe',
  args: ['--fullscreen', '--level=1'],
  workingDirectory: '/path/to/game',
  environment: { DEBUG: 'true' },
  captureOutput: true,
  timeout: 30000,
  metadata: { name: 'My Game', version: '1.0.0' }
});
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `options` | `LaunchGameOptions` | Yes | Game launch configuration |

#### LaunchGameOptions

```typescript
interface LaunchGameOptions {
  /** Unique identifier for the game */
  gameId: string;
  
  /** Path to the game executable */
  executable: string;
  
  /** Command line arguments */
  args?: string[];
  
  /** Working directory */
  workingDirectory?: string;
  
  /** Environment variables */
  environment?: Record<string, string>;
  
  /** Capture stdout/stderr */
  captureOutput?: boolean;
  
  /** Launch timeout in milliseconds */
  timeout?: number;
  
  /** Additional metadata */
  metadata?: Record<string, any>;
}
```

#### Executable Parameter

The `executable` parameter should be a local file path:

```typescript
// Absolute path (recommended)
executable: '/home/user/games/mygame.exe'
```

#### Returns

- `Promise<string>` - The game ID of the launched process

#### Throws

- `Error` - If game ID is invalid
- `Error` - If game is already running
- `Error` - If maximum concurrent games limit is reached
- `Error` - If executable is not found or not executable
- `Error` - If launch timeout is exceeded

### `closeGame(gameId, force?)`

Closes a running game process.

```typescript
// Graceful close
const closed = await launcher.closeGame('my-game-1');

// Force close
const forceClosed = await launcher.closeGame('my-game-1', true);
```

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `gameId` | `string` | Yes | - | Unique identifier of the game |
| `force` | `boolean` | No | `false` | Whether to force kill the process |

#### Returns

- `Promise<boolean>` - `true` if the game was successfully closed, `false` otherwise

### `isGameRunning(gameId)`

Checks if a game is currently running.

```typescript
if (launcher.isGameRunning('my-game-1')) {
  console.log('Game is running!');
}
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `gameId` | `string` | Yes | Unique identifier of the game |

#### Returns

- `boolean` - `true` if the game is running, `false` otherwise

### `getRunningGames()`

Returns a list of all currently running games.

```typescript
const runningGames = launcher.getRunningGames();
console.log(`${runningGames.length} games are running:`, runningGames);
```

#### Returns

- `string[]` - Array of game IDs for all running games

### `getGameInfo(gameId)`

Retrieves detailed information about a specific game.

```typescript
const info = launcher.getGameInfo('my-game-1');
if (info) {
  console.log(`Game: ${info.gameId}`);
  console.log(`PID: ${info.pid}`);
  console.log(`Status: ${info.status}`);
  console.log(`Start Time: ${info.startTime}`);
}
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `gameId` | `string` | Yes | Unique identifier of the game |

#### Returns

- `GameProcessInfo | null` - Game information object or `null` if not found

#### GameProcessInfo

```typescript
interface GameProcessInfo {
  gameId: string;
  pid: number;
  executable: string;
  args: string[];
  workingDirectory: string;
  environment: Record<string, string>;
  status: GameStatus;
  startTime: Date;
  endTime?: Date;
  exitCode?: number | null;
  signal?: string | null;
  metadata: Record<string, any>;
}
```

### `on(event, listener)`

Adds an event listener for the specified event.

```typescript
launcher.on('launched', (data) => {
  console.log(`Game launched: ${data.gameId}`);
});

launcher.on('closed', (data) => {
  console.log(`Game closed: ${data.gameId}`);
});
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `event` | `keyof GameProcessEvents` | Yes | Event name |
| `listener` | `GameProcessEvents[K]` | Yes | Event handler function |

#### Returns

- `this` - Returns the GameLauncher instance for method chaining

### `off(event, listener)`

Removes a specific event listener.

```typescript
const handler = (data) => console.log('Game launched:', data.gameId);
launcher.on('launched', handler);

// Later, remove the listener
launcher.off('launched', handler);
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `event` | `keyof GameProcessEvents` | Yes | Event name |
| `listener` | `GameProcessEvents[K]` | Yes | Event handler function to remove |

#### Returns

- `this` - Returns the GameLauncher instance for method chaining

### `removeAllListeners(event?)`

Removes all event listeners for a specific event or all events.

```typescript
// Remove all 'launched' event listeners
launcher.removeAllListeners('launched');

// Remove all event listeners
launcher.removeAllListeners();
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `event` | `keyof GameProcessEvents` | No | Specific event name (optional) |

#### Returns

- `this` - Returns the GameLauncher instance for method chaining

### `destroy()`

Cleans up resources and stops all monitoring. Call this when you're done using the launcher.

```typescript
// Clean up when done
launcher.destroy();
```

#### Returns

- `void`

## 📡 Events

The GameLauncher emits various events during the game lifecycle. See [events.md](./events.md) for detailed event documentation.

### Event Types

- `launched` - Game successfully launched
- `closed` - Game process closed
- `error` - Error occurred
- `output` - Process output received
- `statusChange` - Game status changed

## 🏷️ Properties

The GameLauncher class doesn't expose public properties directly. All interaction should be done through the provided methods.

## 📚 Examples

### Basic Game Launch

```typescript
import GameLauncher from '@team-falkor/game-launcher';

const launcher = new GameLauncher();

// Set up event listeners
launcher.on('launched', (data) => {
  console.log(`✅ ${data.gameId} launched (PID: ${data.pid})`);
});

launcher.on('closed', (data) => {
  console.log(`❌ ${data.gameId} closed (Exit: ${data.exitCode})`);
});

// Launch a game
try {
  await launcher.launchGame({
    gameId: 'steam-game',
    executable: 'C:\\Program Files\\Steam\\steam.exe',
    args: ['-applaunch', '12345']
  });
} catch (error) {
  console.error('Failed to launch game:', error.message);
}
```

### Multiple Games Management

```typescript
const launcher = new GameLauncher({
  maxConcurrentGames: 3
});

// Launch multiple games
const games = [
  { id: 'game1', exe: '/path/to/game1.exe' },
  { id: 'game2', exe: '/path/to/game2.exe' },
  { id: 'game3', exe: '/path/to/game3.exe' }
];

for (const game of games) {
  try {
    await launcher.launchGame({
      gameId: game.id,
      executable: game.exe
    });
  } catch (error) {
    console.error(`Failed to launch ${game.id}:`, error.message);
  }
}

// Monitor running games
setInterval(() => {
  const running = launcher.getRunningGames();
  console.log(`Running games: ${running.length}`);
}, 5000);
```

### Game Session Tracking

```typescript
const sessionTracker = new Map();

launcher.on('launched', (data) => {
  sessionTracker.set(data.gameId, {
    startTime: data.startTime,
    pid: data.pid
  });
});

launcher.on('closed', (data) => {
  const session = sessionTracker.get(data.gameId);
  if (session) {
    const duration = data.endTime.getTime() - session.startTime.getTime();
    console.log(`Game ${data.gameId} played for ${duration}ms`);
    sessionTracker.delete(data.gameId);
  }
});
```

### Error Handling

```typescript
launcher.on('error', (data) => {
  console.error(`Error in ${data.gameId} during ${data.phase}:`);
  console.error(data.error.message);
  
  // Handle different error phases
  switch (data.phase) {
    case 'launch':
      // Game failed to start
      break;
    case 'runtime':
      // Game crashed during execution
      break;
    case 'cleanup':
      // Error during cleanup
      break;
  }
});
```

## ⚠️ Error Handling

### Common Errors

1. **Invalid Game ID**
   ```typescript
   // Throws: "Game ID must be a non-empty string"
   await launcher.launchGame({ gameId: '', executable: '/path/to/game' });
   ```

2. **Game Already Running**
   ```typescript
   // Throws: "Game with ID 'my-game' is already running"
   await launcher.launchGame({ gameId: 'my-game', executable: '/path/to/game' });
   await launcher.launchGame({ gameId: 'my-game', executable: '/path/to/game' }); // Error
   ```

3. **Concurrent Games Limit**
   ```typescript
   const launcher = new GameLauncher({ maxConcurrentGames: 1 });
   await launcher.launchGame({ gameId: 'game1', executable: '/path/to/game1' });
   // Throws: "Maximum concurrent games limit reached (1)"
   await launcher.launchGame({ gameId: 'game2', executable: '/path/to/game2' });
   ```

4. **Executable Not Found**
   ```typescript
   // Throws: "Executable not found or not executable: /invalid/path"
   await launcher.launchGame({ gameId: 'game', executable: '/invalid/path' });
   ```

### Best Practices

1. **Always handle launch errors**
   ```typescript
   try {
     await launcher.launchGame(options);
   } catch (error) {
     console.error('Launch failed:', error.message);
   }
   ```

2. **Listen for error events**
   ```typescript
   launcher.on('error', (data) => {
     // Handle runtime errors
   });
   ```

3. **Clean up resources**
   ```typescript
   process.on('exit', () => {
     launcher.destroy();
   });
   ```

---

**Next:** [Events Documentation](./events.md) | [Types Documentation](./types.md)

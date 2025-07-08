# Events Documentation

The Game Launcher provides a comprehensive event system to monitor game process lifecycle and handle various scenarios. All events are strongly typed and provide detailed information about the game state changes.

## 📋 Table of Contents

- [Event System Overview](#event-system-overview)
- [Event Types](#event-types)
- [Event Data Structures](#event-data-structures)
- [Usage Examples](#usage-examples)
- [Best Practices](#best-practices)

## 🎯 Event System Overview

The event system is built on Node.js EventEmitter and provides real-time notifications about game process changes. Events are emitted automatically by the GameLauncher and can be listened to using the standard event listener pattern.

### Event Flow

```
launchGame() → launched → [statusChange] → [output] → [error] → closed
```

## 📡 Event Types

### GameProcessEvents Interface

```typescript
interface GameProcessEvents {
  launched: (data: GameLaunchedEvent) => void;
  closed: (data: GameClosedEvent) => void;
  error: (data: GameErrorEvent) => void;
  output: (data: GameOutputEvent) => void;
  statusChange: (data: GameStatusChangeEvent) => void;
}
```

## 📊 Event Data Structures

### `launched` Event

Emitted when a game process is successfully launched.

```typescript
interface GameLaunchedEvent {
  /** Unique identifier of the game */
  gameId: string;
  
  /** Process ID of the launched game */
  pid: number;
  
  /** Timestamp when the game was launched */
  startTime: Date;
  
  /** Full command used to launch the game */
  command: string;
  
  /** Command line arguments passed to the game */
  args: string[];
}
```

#### Example Data

```typescript
{
  gameId: "my-game-1",
  pid: 12345,
  startTime: new Date("2024-01-15T10:30:00.000Z"),
  command: "/path/to/game.exe",
  args: ["--fullscreen", "--level=1"]
}
```

### `closed` Event

Emitted when a game process terminates (either normally or abnormally).

```typescript
interface GameClosedEvent {
  /** Unique identifier of the game */
  gameId: string;
  
  /** Process ID of the closed game */
  pid: number;
  
  /** Exit code of the process (null if killed by signal) */
  exitCode: number | null;
  
  /** Signal that terminated the process (null if exited normally) */
  signal: string | null;
  
  /** Timestamp when the game was launched */
  startTime: Date;
  
  /** Timestamp when the game was closed */
  endTime: Date;
  
  /** Total duration the game was running (in milliseconds) */
  duration: number;
}
```

#### Example Data

```typescript
// Normal exit
{
  gameId: "my-game-1",
  pid: 12345,
  exitCode: 0,
  signal: null,
  startTime: new Date("2024-01-15T10:30:00.000Z"),
  endTime: new Date("2024-01-15T11:15:30.000Z"),
  duration: 2730000 // 45.5 minutes
}

// Killed by signal
{
  gameId: "my-game-1",
  pid: 12345,
  exitCode: null,
  signal: "SIGTERM",
  startTime: new Date("2024-01-15T10:30:00.000Z"),
  endTime: new Date("2024-01-15T10:35:00.000Z"),
  duration: 300000 // 5 minutes
}
```

### `error` Event

Emitted when an error occurs during any phase of the game lifecycle.

```typescript
interface GameErrorEvent {
  /** Unique identifier of the game */
  gameId: string;
  
  /** Process ID (may be undefined if error occurred before launch) */
  pid?: number | undefined;
  
  /** The error that occurred */
  error: Error;
  
  /** Phase during which the error occurred */
  phase: "launch" | "runtime" | "cleanup";
}
```

#### Error Phases

- **`launch`** - Error occurred while starting the game process
- **`runtime`** - Error occurred while the game was running
- **`cleanup`** - Error occurred during process cleanup

#### Example Data

```typescript
// Launch error
{
  gameId: "my-game-1",
  pid: undefined,
  error: new Error("Executable not found: /invalid/path/game.exe"),
  phase: "launch"
}

// Runtime error
{
  gameId: "my-game-1",
  pid: 12345,
  error: new Error("Process crashed unexpectedly"),
  phase: "runtime"
}
```

### `output` Event

Emitted when the game process produces output (stdout or stderr). Only available when `captureOutput` is enabled.

```typescript
interface GameOutputEvent {
  /** Unique identifier of the game */
  gameId: string;
  
  /** Process ID of the game */
  pid: number;
  
  /** Type of output stream */
  type: "stdout" | "stderr";
  
  /** The output data */
  data: string;
  
  /** Timestamp when the output was received */
  timestamp: Date;
}
```

#### Example Data

```typescript
{
  gameId: "my-game-1",
  pid: 12345,
  type: "stdout",
  data: "Game initialized successfully\n",
  timestamp: new Date("2024-01-15T10:30:05.123Z")
}
```

### `statusChange` Event

Emitted when a game's status changes during its lifecycle.

```typescript
interface GameStatusChangeEvent {
  /** Unique identifier of the game */
  gameId: string;
  
  /** Process ID of the game */
  pid: number;
  
  /** Previous status */
  previousStatus: GameStatus;
  
  /** New current status */
  currentStatus: GameStatus;
  
  /** Timestamp of the status change */
  timestamp: Date;
}
```

#### Game Status Types

```typescript
type GameStatus =
  | "launching"  // Process is being started
  | "running"    // Process is running normally
  | "detached"   // Process has detached (GUI applications)
  | "closing"    // Process is being terminated
  | "closed"     // Process has terminated
  | "error";     // Process encountered an error
```

#### Example Data

```typescript
{
  gameId: "my-game-1",
  pid: 12345,
  previousStatus: "launching",
  currentStatus: "running",
  timestamp: new Date("2024-01-15T10:30:02.456Z")
}
```

## 💡 Usage Examples

### Basic Event Handling

```typescript
import GameLauncher from 'game-launcher';

const launcher = new GameLauncher();

// Listen for game launches
launcher.on('launched', (data) => {
  console.log(`🚀 Game ${data.gameId} launched!`);
  console.log(`   PID: ${data.pid}`);
  console.log(`   Command: ${data.command} ${data.args.join(' ')}`);
  console.log(`   Started at: ${data.startTime.toISOString()}`);
});

// Listen for game closures
launcher.on('closed', (data) => {
  console.log(`🏁 Game ${data.gameId} closed`);
  
  if (data.exitCode === 0) {
    console.log('   ✅ Exited normally');
  } else if (data.exitCode !== null) {
    console.log(`   ❌ Exited with code: ${data.exitCode}`);
  } else {
    console.log(`   💀 Killed by signal: ${data.signal}`);
  }
  
  const minutes = Math.floor(data.duration / 60000);
  const seconds = Math.floor((data.duration % 60000) / 1000);
  console.log(`   ⏱️  Session duration: ${minutes}m ${seconds}s`);
});

// Listen for errors
launcher.on('error', (data) => {
  console.error(`💥 Error in ${data.gameId} during ${data.phase}:`);
  console.error(`   ${data.error.message}`);
});
```

### Advanced Event Handling

```typescript
// Game session tracking
const sessions = new Map();

launcher.on('launched', (data) => {
  sessions.set(data.gameId, {
    startTime: data.startTime,
    pid: data.pid,
    command: data.command,
    args: data.args
  });
});

launcher.on('closed', (data) => {
  const session = sessions.get(data.gameId);
  if (session) {
    // Log session to database or file
    logGameSession({
      gameId: data.gameId,
      duration: data.duration,
      exitCode: data.exitCode,
      startTime: session.startTime,
      endTime: data.endTime
    });
    
    sessions.delete(data.gameId);
  }
});

// Status monitoring
launcher.on('statusChange', (data) => {
  console.log(`📊 ${data.gameId}: ${data.previousStatus} → ${data.currentStatus}`);
  
  // Handle specific status transitions
  if (data.currentStatus === 'detached') {
    console.log('   🔗 Game has detached (GUI application)');
  } else if (data.currentStatus === 'error') {
    console.log('   ⚠️  Game encountered an error');
  }
});

// Output monitoring (when captureOutput is enabled)
launcher.on('output', (data) => {
  const prefix = data.type === 'stderr' ? '❌' : '📝';
  console.log(`${prefix} [${data.gameId}] ${data.data.trim()}`);
  
  // Log to file or send to monitoring system
  if (data.type === 'stderr') {
    logError(data.gameId, data.data, data.timestamp);
  }
});
```

### Event-Driven Game Management

```typescript
class GameManager {
  private launcher: GameLauncher;
  private gameStats = new Map();
  
  constructor() {
    this.launcher = new GameLauncher();
    this.setupEventHandlers();
  }
  
  private setupEventHandlers() {
    this.launcher.on('launched', this.onGameLaunched.bind(this));
    this.launcher.on('closed', this.onGameClosed.bind(this));
    this.launcher.on('error', this.onGameError.bind(this));
    this.launcher.on('statusChange', this.onStatusChange.bind(this));
  }
  
  private onGameLaunched(data: GameLaunchedEvent) {
    this.gameStats.set(data.gameId, {
      launches: (this.gameStats.get(data.gameId)?.launches || 0) + 1,
      totalPlaytime: this.gameStats.get(data.gameId)?.totalPlaytime || 0,
      lastPlayed: data.startTime,
      currentSession: data.startTime
    });
    
    this.notifyGameLaunched(data);
  }
  
  private onGameClosed(data: GameClosedEvent) {
    const stats = this.gameStats.get(data.gameId);
    if (stats) {
      stats.totalPlaytime += data.duration;
      stats.currentSession = null;
    }
    
    this.notifyGameClosed(data);
  }
  
  private onGameError(data: GameErrorEvent) {
    // Handle different error phases
    switch (data.phase) {
      case 'launch':
        this.handleLaunchError(data);
        break;
      case 'runtime':
        this.handleRuntimeError(data);
        break;
      case 'cleanup':
        this.handleCleanupError(data);
        break;
    }
  }
  
  private onStatusChange(data: GameStatusChangeEvent) {
    // Update UI or notify other systems
    this.updateGameStatus(data.gameId, data.currentStatus);
  }
  
  // Implementation methods...
  private notifyGameLaunched(data: GameLaunchedEvent) { /* ... */ }
  private notifyGameClosed(data: GameClosedEvent) { /* ... */ }
  private handleLaunchError(data: GameErrorEvent) { /* ... */ }
  private handleRuntimeError(data: GameErrorEvent) { /* ... */ }
  private handleCleanupError(data: GameErrorEvent) { /* ... */ }
  private updateGameStatus(gameId: string, status: GameStatus) { /* ... */ }
}
```

### Conditional Event Handling

```typescript
// Only handle specific games
launcher.on('launched', (data) => {
  if (data.gameId.startsWith('steam-')) {
    console.log('Steam game launched:', data.gameId);
  }
});

// Handle based on exit codes
launcher.on('closed', (data) => {
  if (data.exitCode === 0) {
    console.log('Game exited successfully');
  } else if (data.exitCode === 1) {
    console.log('Game exited with error');
  } else if (data.signal) {
    console.log('Game was terminated');
  }
});

// Filter output by type
launcher.on('output', (data) => {
  if (data.type === 'stderr' && data.data.includes('ERROR')) {
    console.error('Critical error detected:', data.data);
    // Maybe close the game or alert administrators
  }
});
```

## 🎯 Best Practices

### 1. Always Handle Errors

```typescript
// Always listen for error events
launcher.on('error', (data) => {
  console.error(`Error in ${data.gameId}:`, data.error.message);
  
  // Take appropriate action based on phase
  if (data.phase === 'launch') {
    // Maybe retry launch or notify user
  }
});
```

### 2. Clean Up Event Listeners

```typescript
// Store references to handlers for cleanup
const launchedHandler = (data) => { /* ... */ };
const closedHandler = (data) => { /* ... */ };

launcher.on('launched', launchedHandler);
launcher.on('closed', closedHandler);

// Clean up when done
process.on('exit', () => {
  launcher.off('launched', launchedHandler);
  launcher.off('closed', closedHandler);
  // Or remove all listeners
  launcher.removeAllListeners();
});
```

### 3. Handle Async Operations in Event Handlers

```typescript
launcher.on('launched', async (data) => {
  try {
    // Async operations should be wrapped in try-catch
    await logToDatabase(data);
    await notifyWebhook(data);
  } catch (error) {
    console.error('Failed to handle launch event:', error);
  }
});
```

### 4. Use Event Data Efficiently

```typescript
// Destructure event data for cleaner code
launcher.on('closed', ({ gameId, duration, exitCode }) => {
  const minutes = Math.floor(duration / 60000);
  console.log(`${gameId} played for ${minutes} minutes (exit: ${exitCode})`);
});
```

### 5. Implement Event Aggregation

```typescript
class EventAggregator {
  private events: Array<{ type: string; data: any; timestamp: Date }> = [];
  
  constructor(launcher: GameLauncher) {
    // Capture all events
    ['launched', 'closed', 'error', 'output', 'statusChange'].forEach(event => {
      launcher.on(event as any, (data) => {
        this.events.push({
          type: event,
          data,
          timestamp: new Date()
        });
      });
    });
  }
  
  getEventHistory(gameId?: string) {
    return gameId 
      ? this.events.filter(e => e.data.gameId === gameId)
      : this.events;
  }
  
  clearHistory() {
    this.events = [];
  }
}
```

---

**Next:** [Types Documentation](./types.md) | [Utilities Documentation](./utilities.md)
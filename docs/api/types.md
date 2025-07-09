# Types Documentation

This document provides comprehensive documentation for all TypeScript types, interfaces, and enums used in the Game Launcher library.

## 📋 Table of Contents

- [Core Interfaces](#core-interfaces)
- [Event Interfaces](#event-interfaces)
- [Enums and Union Types](#enums-and-union-types)
- [Utility Types](#utility-types)
- [Type Usage Examples](#type-usage-examples)

## 🏗️ Core Interfaces

### GameLauncherOptions

Configuration options for the GameLauncher constructor.

```typescript
interface GameLauncherOptions {
  /** Maximum number of concurrent games (default: 10) */
  maxConcurrentGames?: number | undefined;
  
  /** Default working directory for games */
  defaultWorkingDirectory?: string | undefined;
  
  /** Default environment variables */
  defaultEnvironment?: Record<string, string> | undefined;
  
  /** Enable process monitoring (default: true) */
  enableProcessMonitoring?: boolean | undefined;
  
  /** Monitoring interval in milliseconds (default: 1000) */
  monitoringInterval?: number | undefined;
}
```

#### Usage Example

```typescript
const options: GameLauncherOptions = {
  maxConcurrentGames: 5,
  defaultWorkingDirectory: '/games',
  defaultEnvironment: {
    GAME_MODE: 'production',
    LOG_LEVEL: 'info'
  },
  enableProcessMonitoring: true,
  monitoringInterval: 2000
};

const launcher = new GameLauncher(options);
```

### LaunchGameOptions

Options for launching a game process.

```typescript
interface LaunchGameOptions {
  /** Unique identifier for the game */
  gameId: string;
  
  /** Path to the game executable */
  executable: string;
  
  /** Command line arguments */
  args?: string[] | undefined;
  
  /** Working directory */
  workingDirectory?: string | undefined;
  
  /** Environment variables */
  environment?: Record<string, string> | undefined;
  
  /** Capture stdout/stderr */
  captureOutput?: boolean | undefined;
  
  /** Launch timeout in milliseconds */
  timeout?: number | undefined;
  
  /** Run the game with administrator privileges */
  runAsAdmin?: boolean | undefined;
  
  /** Additional metadata */
  metadata?: Record<string, any> | undefined;
}
```

#### Usage Example

```typescript
const launchOptions: LaunchGameOptions = {
  gameId: 'my-awesome-game',
  executable: '/path/to/game.exe',
  args: ['--fullscreen', '--difficulty=hard'],
  workingDirectory: '/path/to/game',
  environment: {
    DISPLAY: ':0',
    GAME_CONFIG: 'production.json'
  },
  captureOutput: true,
  timeout: 30000,
  runAsAdmin: true, // Launch with administrator privileges
  metadata: {
    name: 'My Awesome Game',
    version: '2.1.0',
    genre: 'RPG'
  }
};

await launcher.launchGame(launchOptions);
```

### GameProcessInfo

Detailed information about a game process.

```typescript
interface GameProcessInfo {
  /** Unique identifier for the game */
  gameId: string;
  
  /** Process ID */
  pid: number;
  
  /** Path to the executable */
  executable: string;
  
  /** Command line arguments */
  args: string[];
  
  /** Working directory */
  workingDirectory: string;
  
  /** Environment variables */
  environment: Record<string, string>;
  
  /** Current process status */
  status: GameStatus;
  
  /** Process start time */
  startTime: Date;
  
  /** Process end time (if terminated) */
  endTime?: Date;
  
  /** Exit code (if process has exited) */
  exitCode?: number | null;
  
  /** Termination signal (if killed by signal) */
  signal?: string | null;
  
  /** Additional metadata */
  metadata: Record<string, any>;
}
```

#### Usage Example

```typescript
const gameInfo: GameProcessInfo | null = launcher.getGameInfo('my-game');

if (gameInfo) {
  console.log(`Game: ${gameInfo.gameId}`);
  console.log(`Status: ${gameInfo.status}`);
  console.log(`PID: ${gameInfo.pid}`);
  console.log(`Running since: ${gameInfo.startTime.toISOString()}`);
  
  if (gameInfo.endTime) {
    const duration = gameInfo.endTime.getTime() - gameInfo.startTime.getTime();
    console.log(`Duration: ${duration}ms`);
  }
}
```

### ProcessManagerOptions

Configuration options for the internal ProcessManager.

```typescript
interface ProcessManagerOptions {
  /** Monitoring interval in milliseconds */
  monitoringInterval?: number | undefined;
  
  /** Enable resource monitoring */
  enableResourceMonitoring?: boolean | undefined;
}
```

### ProcessStartOptions

Options for starting a process (used internally).

```typescript
interface ProcessStartOptions {
  /** Working directory */
  workingDirectory?: string | undefined;
  
  /** Environment variables */
  environment?: Record<string, string> | undefined;
  
  /** Capture stdout/stderr */
  captureOutput?: boolean | undefined;
  
  /** Launch timeout in milliseconds */
  timeout?: number | undefined;
  
  /** Additional metadata */
  metadata?: Record<string, any> | undefined;
}
```

### GameLauncherInterface

Interface defining the public API of GameLauncher.

```typescript
interface GameLauncherInterface {
  launchGame(options: LaunchGameOptions): Promise<string>;
  closeGame(gameId: string, force?: boolean): Promise<boolean>;
  isGameRunning(gameId: string): boolean;
  getRunningGames(): string[];
  getGameInfo(gameId: string): GameProcessInfo | null;
  on<K extends keyof GameProcessEvents>(
    event: K,
    listener: GameProcessEvents[K]
  ): this;
  off<K extends keyof GameProcessEvents>(
    event: K,
    listener: GameProcessEvents[K]
  ): this;
  removeAllListeners(event?: keyof GameProcessEvents): this;
}
```

### ProcessManagerInterface

Interface for the internal ProcessManager (used internally).

```typescript
interface ProcessManagerInterface {
  startProcess(
    gameId: string,
    executable: string,
    args: string[],
    options: ProcessStartOptions
  ): Promise<ChildProcess>;
  killProcess(gameId: string, force?: boolean): Promise<boolean>;
  getProcess(gameId: string): ChildProcess | null;
  getProcessInfo(gameId: string): GameProcessInfo | null;
  getAllProcesses(): Map<string, GameProcessInfo>;
  isProcessRunning(gameId: string): boolean;
}
```

## 📡 Event Interfaces

### GameProcessEvents

Event handler signatures for all game process events.

```typescript
interface GameProcessEvents {
  launched: (data: GameLaunchedEvent) => void;
  closed: (data: GameClosedEvent) => void;
  error: (data: GameErrorEvent) => void;
  output: (data: GameOutputEvent) => void;
  statusChange: (data: GameStatusChangeEvent) => void;
}
```

### GameLaunchedEvent

Data structure for the 'launched' event.

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

### GameClosedEvent

Data structure for the 'closed' event.

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

### GameErrorEvent

Data structure for the 'error' event.

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

### GameOutputEvent

Data structure for the 'output' event.

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

### GameStatusChangeEvent

Data structure for the 'statusChange' event.

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

## 🏷️ Enums and Union Types

### GameStatus

Union type representing the possible states of a game process.

```typescript
type GameStatus =
  | "launching"  // Process is being started
  | "running"    // Process is running normally
  | "detached"   // Process has detached (GUI applications)
  | "closing"    // Process is being terminated
  | "closed"     // Process has terminated
  | "error";     // Process encountered an error
```

#### Status Transitions

```
launching → running → closing → closed
launching → detached → closing → closed
launching → error
running → error
detached → error
```

#### Usage Example

```typescript
function handleStatusChange(status: GameStatus) {
  switch (status) {
    case 'launching':
      console.log('Game is starting...');
      break;
    case 'running':
      console.log('Game is running normally');
      break;
    case 'detached':
      console.log('Game has detached (GUI mode)');
      break;
    case 'closing':
      console.log('Game is shutting down...');
      break;
    case 'closed':
      console.log('Game has closed');
      break;
    case 'error':
      console.log('Game encountered an error');
      break;
  }
}
```

### Platform

Union type representing supported platforms.

```typescript
type Platform = "win32" | "darwin" | "linux" | "other";
```

#### Usage Example

```typescript
import { getPlatform } from '@team-falkor/game-launcher';

const platform: Platform = getPlatform();

switch (platform) {
  case 'win32':
    console.log('Running on Windows');
    break;
  case 'darwin':
    console.log('Running on macOS');
    break;
  case 'linux':
    console.log('Running on Linux');
    break;
  case 'other':
    console.log('Running on other Unix-like system');
    break;
}
```

## 🛠️ Utility Types

### Event Handler Types

Type aliases for event handler functions.

```typescript
// Individual event handler types
type LaunchedHandler = (data: GameLaunchedEvent) => void;
type ClosedHandler = (data: GameClosedEvent) => void;
type ErrorHandler = (data: GameErrorEvent) => void;
type OutputHandler = (data: GameOutputEvent) => void;
type StatusChangeHandler = (data: GameStatusChangeEvent) => void;
```

#### Usage Example

```typescript
const launchedHandler: LaunchedHandler = (data) => {
  console.log(`Game ${data.gameId} launched at ${data.startTime}`);
};

const errorHandler: ErrorHandler = (data) => {
  console.error(`Error in ${data.gameId}: ${data.error.message}`);
};

launcher.on('launched', launchedHandler);
launcher.on('error', errorHandler);
```

### Generic Event Handler

Generic type for any event handler.

```typescript
type EventHandler<T extends keyof GameProcessEvents> = GameProcessEvents[T];
```

#### Usage Example

```typescript
function addEventHandler<T extends keyof GameProcessEvents>(
  launcher: GameLauncher,
  event: T,
  handler: EventHandler<T>
) {
  launcher.on(event, handler);
}

// Type-safe event handler registration
addEventHandler(launcher, 'launched', (data) => {
  // data is automatically typed as GameLaunchedEvent
  console.log(data.gameId);
});
```

### Partial Configuration Types

Partial types for optional configurations.

```typescript
type PartialGameLauncherOptions = Partial<GameLauncherOptions>;
type PartialLaunchGameOptions = Partial<Omit<LaunchGameOptions, 'gameId' | 'executable'>> & 
  Pick<LaunchGameOptions, 'gameId' | 'executable'>;
```

## 📚 Type Usage Examples

### Type Guards

```typescript
// Type guard for checking if a game is in an active state
function isGameActive(status: GameStatus): boolean {
  return status === 'launching' || status === 'running' || status === 'detached';
}

// Type guard for checking if a game has ended
function isGameEnded(status: GameStatus): boolean {
  return status === 'closed' || status === 'error';
}

// Usage
const gameInfo = launcher.getGameInfo('my-game');
if (gameInfo && isGameActive(gameInfo.status)) {
  console.log('Game is currently active');
}
```

### Generic Functions

```typescript
// Generic function for handling different event types
function createEventLogger<T extends keyof GameProcessEvents>(
  eventType: T
): EventHandler<T> {
  return ((data: any) => {
    console.log(`[${eventType.toUpperCase()}]`, JSON.stringify(data, null, 2));
  }) as EventHandler<T>;
}

// Usage
launcher.on('launched', createEventLogger('launched'));
launcher.on('closed', createEventLogger('closed'));
launcher.on('error', createEventLogger('error'));
```

### Type-Safe Configuration

```typescript
// Configuration builder with type safety
class GameLauncherConfigBuilder {
  private config: Partial<GameLauncherOptions> = {};
  
  maxConcurrentGames(count: number): this {
    this.config.maxConcurrentGames = count;
    return this;
  }
  
  defaultWorkingDirectory(path: string): this {
    this.config.defaultWorkingDirectory = path;
    return this;
  }
  
  defaultEnvironment(env: Record<string, string>): this {
    this.config.defaultEnvironment = env;
    return this;
  }
  
  enableProcessMonitoring(enabled: boolean): this {
    this.config.enableProcessMonitoring = enabled;
    return this;
  }
  
  monitoringInterval(interval: number): this {
    this.config.monitoringInterval = interval;
    return this;
  }
  
  build(): GameLauncherOptions {
    return this.config;
  }
}

// Usage
const config = new GameLauncherConfigBuilder()
  .maxConcurrentGames(5)
  .enableProcessMonitoring(true)
  .monitoringInterval(2000)
  .build();

const launcher = new GameLauncher(config);
```

### Advanced Type Manipulation

```typescript
// Extract event data types
type EventDataTypes = {
  [K in keyof GameProcessEvents]: Parameters<GameProcessEvents[K]>[0];
};

// Result:
// {
//   launched: GameLaunchedEvent;
//   closed: GameClosedEvent;
//   error: GameErrorEvent;
//   output: GameOutputEvent;
//   statusChange: GameStatusChangeEvent;
// }

// Create a union of all event data types
type AnyEventData = EventDataTypes[keyof EventDataTypes];

// Generic event processor
function processEvent(eventType: keyof GameProcessEvents, data: AnyEventData) {
  // Process any event data in a type-safe way
  console.log(`Processing ${eventType} event:`, data);
}
```

### Conditional Types

```typescript
// Conditional type for event data based on event type
type EventDataFor<T extends keyof GameProcessEvents> = 
  T extends 'launched' ? GameLaunchedEvent :
  T extends 'closed' ? GameClosedEvent :
  T extends 'error' ? GameErrorEvent :
  T extends 'output' ? GameOutputEvent :
  T extends 'statusChange' ? GameStatusChangeEvent :
  never;

// Usage in a generic function
function handleSpecificEvent<T extends keyof GameProcessEvents>(
  eventType: T,
  data: EventDataFor<T>
) {
  // data is correctly typed based on eventType
  if (eventType === 'launched') {
    // data is GameLaunchedEvent
    console.log(`Game ${data.gameId} launched with PID ${data.pid}`);
  }
}
```

---

**Next:** [Utilities Documentation](./utilities.md) | [Getting Started Guide](../guides/getting-started.md)
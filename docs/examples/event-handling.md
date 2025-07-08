# Event Handling

This example demonstrates comprehensive event handling patterns with the Game Launcher library, showing how to effectively manage all game lifecycle events.

## Overview

The Event Handling example covers:
- All available event types and their data
- Event listener patterns and best practices
- Error handling and recovery strategies
- Event-driven application architecture
- Custom event processing and filtering

## Prerequisites

- Node.js 16.0.0 or higher
- Game Launcher library installed
- Understanding of JavaScript/TypeScript events

## Available Events

The Game Launcher emits the following events:

| Event | Description | Data |
|-------|-------------|------|
| `launched` | Game successfully started | `{ gameId, pid, executable, startTime }` |
| `closed` | Game process ended | `{ gameId, exitCode, runtime, endTime }` |
| `error` | Error occurred during game operation | `{ gameId, error, context }` |
| `output` | Game produced stdout/stderr output | `{ gameId, data, stream }` |
| `statusChange` | Game status changed | `{ gameId, oldStatus, newStatus, timestamp }` |

## Code

### Complete Event Handling Example

```typescript
import { GameLauncher, GameStatus } from '@team-falkor/game-launcher';
import { EventEmitter } from 'events';

/**
 * Advanced Event Handling Example
 * Demonstrates comprehensive event management patterns
 */
class GameEventManager extends EventEmitter {
  private launcher: GameLauncher;
  private gameStats: Map<string, GameSessionStats> = new Map();
  private eventLog: GameEvent[] = [];
  private maxLogSize = 1000;

  constructor() {
    super();
    this.launcher = new GameLauncher({
      timeout: 30000,
      verbose: true
    });
    
    this.setupEventHandlers();
  }

  /**
   * Set up all event handlers with comprehensive logging and processing
   */
  private setupEventHandlers(): void {
    // Game Launch Event
    this.launcher.on('launched', (event) => {
      this.logEvent('launched', event);
      this.handleGameLaunched(event);
    });

    // Game Close Event
    this.launcher.on('closed', (event) => {
      this.logEvent('closed', event);
      this.handleGameClosed(event);
    });

    // Error Event
    this.launcher.on('error', (event) => {
      this.logEvent('error', event);
      this.handleGameError(event);
    });

    // Output Event (stdout/stderr)
    this.launcher.on('output', (event) => {
      this.logEvent('output', event);
      this.handleGameOutput(event);
    });

    // Status Change Event
    this.launcher.on('statusChange', (event) => {
      this.logEvent('statusChange', event);
      this.handleStatusChange(event);
    });
  }

  /**
   * Handle game launched event
   */
  private handleGameLaunched(event: any): void {
    console.log(`🚀 Game Launched: ${event.gameId}`);
    console.log(`   Process ID: ${event.pid}`);
    console.log(`   Executable: ${event.executable}`);
    console.log(`   Start Time: ${new Date(event.startTime).toLocaleString()}`);

    // Initialize game statistics
    this.gameStats.set(event.gameId, {
      gameId: event.gameId,
      pid: event.pid,
      executable: event.executable,
      startTime: event.startTime,
      outputLines: 0,
      errorCount: 0,
      statusChanges: 0
    });

    // Emit custom event for application logic
    this.emit('gameStarted', {
      gameId: event.gameId,
      timestamp: event.startTime
    });

    // Optional: Set up game-specific monitoring
    this.startGameMonitoring(event.gameId);
  }

  /**
   * Handle game closed event
   */
  private handleGameClosed(event: any): void {
    console.log(`🔴 Game Closed: ${event.gameId}`);
    console.log(`   Exit Code: ${event.exitCode}`);
    console.log(`   Runtime: ${this.formatDuration(event.runtime)}`);
    console.log(`   End Time: ${new Date(event.endTime).toLocaleString()}`);

    // Update game statistics
    const stats = this.gameStats.get(event.gameId);
    if (stats) {
      stats.endTime = event.endTime;
      stats.runtime = event.runtime;
      stats.exitCode = event.exitCode;
      
      // Log final statistics
      this.logGameStatistics(stats);
    }

    // Determine if exit was clean or unexpected
    const exitStatus = this.analyzeExitCode(event.exitCode);
    console.log(`   Exit Status: ${exitStatus}`);

    // Emit custom event
    this.emit('gameEnded', {
      gameId: event.gameId,
      exitCode: event.exitCode,
      runtime: event.runtime,
      exitStatus
    });

    // Clean up monitoring
    this.stopGameMonitoring(event.gameId);
  }

  /**
   * Handle game error event
   */
  private handleGameError(event: any): void {
    console.error(`❌ Game Error: ${event.gameId}`);
    console.error(`   Error: ${event.error.message}`);
    console.error(`   Context: ${event.context || 'Unknown'}`);
    
    // Update error count
    const stats = this.gameStats.get(event.gameId);
    if (stats) {
      stats.errorCount++;
    }

    // Categorize error type
    const errorType = this.categorizeError(event.error);
    console.error(`   Error Type: ${errorType}`);

    // Emit custom error event with additional context
    this.emit('gameError', {
      gameId: event.gameId,
      error: event.error,
      errorType,
      context: event.context,
      timestamp: new Date().toISOString()
    });

    // Attempt error recovery if appropriate
    this.attemptErrorRecovery(event.gameId, errorType, event.error);
  }

  /**
   * Handle game output event
   */
  private handleGameOutput(event: any): void {
    const timestamp = new Date().toISOString();
    const stream = event.stream || 'stdout';
    
    // Log output with formatting
    console.log(`📝 [${timestamp}] ${event.gameId} (${stream}): ${event.data.trim()}`);

    // Update output statistics
    const stats = this.gameStats.get(event.gameId);
    if (stats) {
      stats.outputLines++;
    }

    // Process output for specific patterns
    this.processGameOutput(event.gameId, event.data, stream);

    // Emit custom output event
    this.emit('gameOutput', {
      gameId: event.gameId,
      data: event.data,
      stream,
      timestamp
    });
  }

  /**
   * Handle status change event
   */
  private handleStatusChange(event: any): void {
    console.log(`🔄 Status Change: ${event.gameId}`);
    console.log(`   ${event.oldStatus} → ${event.newStatus}`);
    console.log(`   Timestamp: ${new Date(event.timestamp).toLocaleString()}`);

    // Update status change count
    const stats = this.gameStats.get(event.gameId);
    if (stats) {
      stats.statusChanges++;
      stats.currentStatus = event.newStatus;
    }

    // Handle specific status transitions
    this.handleStatusTransition(event.gameId, event.oldStatus, event.newStatus);

    // Emit custom status event
    this.emit('statusChanged', {
      gameId: event.gameId,
      oldStatus: event.oldStatus,
      newStatus: event.newStatus,
      timestamp: event.timestamp
    });
  }

  /**
   * Launch a game with comprehensive event monitoring
   */
  async launchGameWithMonitoring(options: any): Promise<string> {
    try {
      console.log(`🎮 Launching game: ${options.gameId}`);
      
      // Pre-launch validation
      await this.validateGameOptions(options);
      
      // Launch the game
      const gameId = await this.launcher.launchGame(options);
      
      console.log(`✅ Game launch initiated: ${gameId}`);
      return gameId;
      
    } catch (error) {
      console.error(`💥 Failed to launch game: ${error.message}`);
      
      // Emit launch failure event
      this.emit('launchFailed', {
        gameId: options.gameId,
        error,
        timestamp: new Date().toISOString()
      });
      
      throw error;
    }
  }

  /**
   * Process game output for specific patterns
   */
  private processGameOutput(gameId: string, data: string, stream: string): void {
    const line = data.trim().toLowerCase();
    
    // Detect common game events from output
    if (line.includes('level completed') || line.includes('stage clear')) {
      this.emit('levelCompleted', { gameId, timestamp: new Date().toISOString() });
    }
    
    if (line.includes('game over') || line.includes('you died')) {
      this.emit('gameOver', { gameId, timestamp: new Date().toISOString() });
    }
    
    if (line.includes('high score') || line.includes('new record')) {
      this.emit('highScore', { gameId, timestamp: new Date().toISOString() });
    }
    
    if (line.includes('error') || line.includes('exception') || stream === 'stderr') {
      this.emit('gameLogError', {
        gameId,
        message: data.trim(),
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Handle specific status transitions
   */
  private handleStatusTransition(gameId: string, oldStatus: GameStatus, newStatus: GameStatus): void {
    switch (newStatus) {
      case 'running':
        if (oldStatus === 'starting') {
          console.log(`✅ ${gameId} successfully started`);
          this.emit('gameFullyStarted', { gameId });
        }
        break;
        
      case 'stopping':
        console.log(`⏹️ ${gameId} is shutting down`);
        this.emit('gameShuttingDown', { gameId });
        break;
        
      case 'crashed':
        console.error(`💥 ${gameId} has crashed!`);
        this.emit('gameCrashed', { gameId });
        break;
        
      case 'not_responding':
        console.warn(`⚠️ ${gameId} is not responding`);
        this.emit('gameNotResponding', { gameId });
        break;
    }
  }

  /**
   * Attempt error recovery based on error type
   */
  private async attemptErrorRecovery(gameId: string, errorType: string, error: Error): Promise<void> {
    console.log(`🔧 Attempting error recovery for ${gameId} (${errorType})`);
    
    switch (errorType) {
      case 'launch_failure':
        // Wait and retry launch
        console.log('   Retrying launch in 5 seconds...');
        setTimeout(async () => {
          try {
            const gameInfo = this.launcher.getGameInfo(gameId);
            if (gameInfo) {
              await this.launcher.launchGame({
                gameId: `${gameId}-retry`,
                executable: gameInfo.executable
              });
            }
          } catch (retryError) {
            console.error('   Retry failed:', retryError.message);
          }
        }, 5000);
        break;
        
      case 'process_crash':
        // Log crash details and notify
        console.log('   Logging crash details...');
        this.emit('crashReport', {
          gameId,
          error,
          timestamp: new Date().toISOString(),
          stats: this.gameStats.get(gameId)
        });
        break;
        
      case 'permission_denied':
        console.log('   Permission issue detected - check file permissions');
        break;
    }
  }

  /**
   * Start monitoring a specific game
   */
  private startGameMonitoring(gameId: string): void {
    const interval = setInterval(() => {
      if (this.launcher.isGameRunning(gameId)) {
        const gameInfo = this.launcher.getGameInfo(gameId);
        if (gameInfo) {
          // Emit periodic status update
          this.emit('gameHeartbeat', {
            gameId,
            status: gameInfo.status,
            runtime: Date.now() - gameInfo.startTime,
            timestamp: new Date().toISOString()
          });
        }
      } else {
        clearInterval(interval);
      }
    }, 10000); // Check every 10 seconds
  }

  /**
   * Stop monitoring a specific game
   */
  private stopGameMonitoring(gameId: string): void {
    // Monitoring is automatically stopped when game closes
    console.log(`🔍 Stopped monitoring ${gameId}`);
  }

  /**
   * Validate game options before launch
   */
  private async validateGameOptions(options: any): Promise<void> {
    if (!options.gameId) {
      throw new Error('Game ID is required');
    }
    
    if (!options.executable) {
      throw new Error('Executable path is required');
    }
    
    // Check if executable exists
    const fs = require('fs').promises;
    try {
      await fs.access(options.executable);
    } catch {
      throw new Error(`Executable not found: ${options.executable}`);
    }
  }

  /**
   * Categorize error types for better handling
   */
  private categorizeError(error: Error): string {
    const message = error.message.toLowerCase();
    
    if (message.includes('enoent') || message.includes('not found')) {
      return 'file_not_found';
    }
    
    if (message.includes('eacces') || message.includes('permission')) {
      return 'permission_denied';
    }
    
    if (message.includes('timeout')) {
      return 'timeout';
    }
    
    if (message.includes('crash') || message.includes('segfault')) {
      return 'process_crash';
    }
    
    if (message.includes('launch') || message.includes('start')) {
      return 'launch_failure';
    }
    
    return 'unknown';
  }

  /**
   * Analyze exit code to determine exit status
   */
  private analyzeExitCode(exitCode: number): string {
    if (exitCode === 0) return 'clean_exit';
    if (exitCode === 1) return 'general_error';
    if (exitCode === 2) return 'misuse_of_shell_builtins';
    if (exitCode >= 128) return 'fatal_error_signal';
    return `error_code_${exitCode}`;
  }

  /**
   * Log game statistics
   */
  private logGameStatistics(stats: GameSessionStats): void {
    console.log(`📊 Game Statistics for ${stats.gameId}:`);
    console.log(`   Runtime: ${this.formatDuration(stats.runtime || 0)}`);
    console.log(`   Output Lines: ${stats.outputLines}`);
    console.log(`   Errors: ${stats.errorCount}`);
    console.log(`   Status Changes: ${stats.statusChanges}`);
    console.log(`   Final Status: ${stats.currentStatus || 'unknown'}`);
  }

  /**
   * Log events to internal event log
   */
  private logEvent(eventType: string, eventData: any): void {
    const event: GameEvent = {
      type: eventType,
      data: eventData,
      timestamp: new Date().toISOString()
    };
    
    this.eventLog.push(event);
    
    // Maintain log size limit
    if (this.eventLog.length > this.maxLogSize) {
      this.eventLog.shift();
    }
  }

  /**
   * Format duration in milliseconds to human-readable format
   */
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

  /**
   * Get event log for analysis
   */
  getEventLog(): GameEvent[] {
    return [...this.eventLog];
  }

  /**
   * Get game statistics
   */
  getGameStats(gameId?: string): GameSessionStats | Map<string, GameSessionStats> {
    if (gameId) {
      return this.gameStats.get(gameId);
    }
    return new Map(this.gameStats);
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    console.log('🧹 Cleaning up GameEventManager...');
    this.launcher.destroy();
    this.gameStats.clear();
    this.eventLog.length = 0;
    this.removeAllListeners();
  }
}

// Type definitions
interface GameSessionStats {
  gameId: string;
  pid: number;
  executable: string;
  startTime: number;
  endTime?: number;
  runtime?: number;
  exitCode?: number;
  outputLines: number;
  errorCount: number;
  statusChanges: number;
  currentStatus?: GameStatus;
}

interface GameEvent {
  type: string;
  data: any;
  timestamp: string;
}

/**
 * Example usage of the GameEventManager
 */
async function eventHandlingExample() {
  const gameManager = new GameEventManager();
  
  try {
    // Set up custom event listeners
    gameManager.on('gameStarted', (event) => {
      console.log(`🎯 Custom Event: Game ${event.gameId} started at ${event.timestamp}`);
    });
    
    gameManager.on('gameEnded', (event) => {
      console.log(`🎯 Custom Event: Game ${event.gameId} ended with status ${event.exitStatus}`);
    });
    
    gameManager.on('levelCompleted', (event) => {
      console.log(`🏆 Level completed in ${event.gameId}!`);
    });
    
    gameManager.on('gameCrashed', (event) => {
      console.log(`💥 Game ${event.gameId} crashed - investigating...`);
    });

    // Launch a game with comprehensive monitoring
    const gameId = await gameManager.launchGameWithMonitoring({
      gameId: 'test-game-events',
      executable: getTestExecutable(),
      detached: true
    });

    console.log('⏳ Monitoring game events...');
    
    // Wait for game to complete
    await new Promise(resolve => {
      gameManager.on('gameEnded', () => {
        setTimeout(resolve, 1000); // Wait a bit for final events
      });
    });
    
    // Display final statistics
    const stats = gameManager.getGameStats(gameId);
    if (stats) {
      console.log('\n📈 Final Game Statistics:');
      console.log(JSON.stringify(stats, null, 2));
    }
    
  } catch (error) {
    console.error('💥 Event handling example failed:', error);
  } finally {
    gameManager.destroy();
  }
}

function getTestExecutable(): string {
  switch (process.platform) {
    case 'win32':
      return 'notepad.exe';
    case 'darwin':
      return '/System/Applications/TextEdit.app/Contents/MacOS/TextEdit';
    default:
      return '/bin/sleep';
  }
}

// Run the example
if (require.main === module) {
  eventHandlingExample()
    .then(() => {
      console.log('✨ Event handling example completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Example failed:', error);
      process.exit(1);
    });
}

export { GameEventManager, eventHandlingExample };
```

## Usage

### Running the Example

```bash
# TypeScript
npx ts-node event-handling.ts

# JavaScript (compile first)
npx tsc event-handling.ts
node event-handling.js
```

### Expected Output

```
🎮 Launching game: test-game-events
✅ Game launch initiated: test-game-events
⏳ Monitoring game events...
🚀 Game Launched: test-game-events
   Process ID: 12345
   Executable: notepad.exe
   Start Time: 1/15/2024, 10:30:00 AM
🎯 Custom Event: Game test-game-events started at 2024-01-15T15:30:00.000Z
🔄 Status Change: test-game-events
   starting → running
   Timestamp: 1/15/2024, 10:30:01 AM
✅ test-game-events successfully started
🔍 Started monitoring test-game-events
📝 [2024-01-15T15:30:05.000Z] test-game-events (stdout): Game initialized
🔴 Game Closed: test-game-events
   Exit Code: 0
   Runtime: 15s
   End Time: 1/15/2024, 10:30:15 AM
   Exit Status: clean_exit
📊 Game Statistics for test-game-events:
   Runtime: 15s
   Output Lines: 3
   Errors: 0
   Status Changes: 2
   Final Status: stopped
🎯 Custom Event: Game test-game-events ended with status clean_exit
🔍 Stopped monitoring test-game-events

📈 Final Game Statistics:
{
  "gameId": "test-game-events",
  "pid": 12345,
  "executable": "notepad.exe",
  "startTime": 1705330200000,
  "endTime": 1705330215000,
  "runtime": 15000,
  "exitCode": 0,
  "outputLines": 3,
  "errorCount": 0,
  "statusChanges": 2,
  "currentStatus": "stopped"
}
🧹 Cleaning up GameEventManager...
✨ Event handling example completed!
```

## Event Patterns

### Basic Event Listener

```typescript
launcher.on('launched', (event) => {
  console.log(`Game ${event.gameId} started with PID ${event.pid}`);
});
```

### One-time Event Listener

```typescript
launcher.once('closed', (event) => {
  console.log(`First game closed: ${event.gameId}`);
});
```

### Conditional Event Handling

```typescript
launcher.on('error', (event) => {
  if (event.gameId === 'critical-game') {
    // Handle critical game errors differently
    handleCriticalError(event);
  } else {
    // Standard error handling
    handleStandardError(event);
  }
});
```

### Event Filtering

```typescript
launcher.on('output', (event) => {
  // Only process error output
  if (event.stream === 'stderr') {
    processErrorOutput(event.data);
  }
  
  // Filter by game ID
  if (event.gameId.startsWith('debug-')) {
    logDebugOutput(event);
  }
});
```

## Advanced Patterns

### Event Aggregation

```typescript
class EventAggregator {
  private events: Map<string, any[]> = new Map();
  
  collectEvents(gameId: string, event: any): void {
    if (!this.events.has(gameId)) {
      this.events.set(gameId, []);
    }
    this.events.get(gameId)!.push(event);
  }
  
  getEventSummary(gameId: string): any {
    const events = this.events.get(gameId) || [];
    return {
      totalEvents: events.length,
      eventTypes: [...new Set(events.map(e => e.type))],
      firstEvent: events[0],
      lastEvent: events[events.length - 1]
    };
  }
}
```

### Event Debouncing

```typescript
class DebouncedEventHandler {
  private timeouts: Map<string, NodeJS.Timeout> = new Map();
  
  handleDebouncedOutput(event: any, delay: number = 1000): void {
    const key = `${event.gameId}-output`;
    
    // Clear existing timeout
    if (this.timeouts.has(key)) {
      clearTimeout(this.timeouts.get(key)!);
    }
    
    // Set new timeout
    this.timeouts.set(key, setTimeout(() => {
      this.processOutput(event);
      this.timeouts.delete(key);
    }, delay));
  }
}
```

### Event Chaining

```typescript
launcher.on('launched', async (event) => {
  try {
    // Wait for game to be fully ready
    await waitForGameReady(event.gameId);
    
    // Then perform post-launch actions
    await performPostLaunchActions(event.gameId);
    
  } catch (error) {
    console.error('Post-launch actions failed:', error);
  }
});
```

## Error Recovery Strategies

### Automatic Restart

```typescript
launcher.on('error', async (event) => {
  if (event.error.message.includes('crashed')) {
    console.log(`Attempting to restart ${event.gameId}...`);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5s
      await launcher.launchGame({
        gameId: `${event.gameId}-restart`,
        executable: event.executable
      });
    } catch (restartError) {
      console.error('Restart failed:', restartError);
    }
  }
});
```

### Circuit Breaker Pattern

```typescript
class CircuitBreaker {
  private failures = 0;
  private lastFailure = 0;
  private threshold = 3;
  private timeout = 60000; // 1 minute
  
  async executeWithBreaker(gameId: string, action: () => Promise<any>): Promise<any> {
    if (this.isOpen()) {
      throw new Error('Circuit breaker is open');
    }
    
    try {
      const result = await action();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private isOpen(): boolean {
    return this.failures >= this.threshold && 
           (Date.now() - this.lastFailure) < this.timeout;
  }
  
  private onSuccess(): void {
    this.failures = 0;
  }
  
  private onFailure(): void {
    this.failures++;
    this.lastFailure = Date.now();
  }
}
```

## Best Practices

### 1. Always Clean Up Event Listeners

```typescript
// Remove specific listener
launcher.off('launched', myLaunchHandler);

// Remove all listeners for an event
launcher.removeAllListeners('error');

// Clean up everything
launcher.destroy();
```

### 2. Handle Async Operations in Events

```typescript
launcher.on('launched', async (event) => {
  try {
    await performAsyncSetup(event.gameId);
  } catch (error) {
    console.error('Async setup failed:', error);
  }
});
```

### 3. Use Event Namespacing

```typescript
// Create separate event emitters for different concerns
const gameEvents = new EventEmitter();
const systemEvents = new EventEmitter();
const userEvents = new EventEmitter();

launcher.on('launched', (event) => {
  gameEvents.emit('started', event);
  systemEvents.emit('process-created', event);
});
```

### 4. Implement Event Validation

```typescript
function validateEvent(event: any, expectedFields: string[]): boolean {
  return expectedFields.every(field => event.hasOwnProperty(field));
}

launcher.on('launched', (event) => {
  if (!validateEvent(event, ['gameId', 'pid', 'executable'])) {
    console.error('Invalid launch event received');
    return;
  }
  
  // Process valid event
  handleValidLaunchEvent(event);
});
```

## Troubleshooting

### Events Not Firing

1. **Check event listener registration**: Ensure listeners are added before launching
2. **Verify event names**: Use correct event names (`launched`, not `launch`)
3. **Check for errors**: Look for uncaught exceptions that might stop event processing

### Memory Leaks

1. **Remove event listeners**: Always clean up when done
2. **Limit event log size**: Implement log rotation
3. **Clear timeouts**: Clean up any pending timeouts

### Missing Events

1. **Check game lifecycle**: Some games exit too quickly to emit all events
2. **Increase timeouts**: Allow more time for events to fire
3. **Enable verbose logging**: Use `verbose: true` in GameLauncher options

## Next Steps

After mastering event handling, explore:

1. **[Multiple Games](multiple-games.md)** - Managing multiple game instances
2. **[Playtime Tracker](playtime-tracker.md)** - Building on events for tracking
3. **[Best Practices](../guides/best-practices.md)** - Production patterns

---

**Master the events, master the games! 🎯**

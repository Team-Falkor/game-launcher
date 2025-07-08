# Best Practices Guide

This guide covers recommended patterns, practices, and techniques for using the Game Launcher library effectively in production applications.

## 📋 Table of Contents

- [Code Organization](#code-organization)
- [Error Handling](#error-handling)
- [Performance Optimization](#performance-optimization)
- [Security Considerations](#security-considerations)
- [Testing Strategies](#testing-strategies)
- [Monitoring and Logging](#monitoring-and-logging)
- [Resource Management](#resource-management)
- [Cross-Platform Development](#cross-platform-development)
- [Production Deployment](#production-deployment)
- [Common Anti-Patterns](#common-anti-patterns)

## 🏗️ Code Organization

### 1. Use Dependency Injection

```typescript
// ✅ Good: Dependency injection for testability
interface IGameLauncher {
  launchGame(options: LaunchGameOptions): Promise<string>;
  closeGame(gameId: string): Promise<void>;
  isGameRunning(gameId: string): Promise<boolean>;
}

class GameService {
  constructor(private launcher: IGameLauncher) {}
  
  async startGameSession(gameId: string, executable: string): Promise<GameSession> {
    const id = await this.launcher.launchGame({ gameId, executable });
    return new GameSession(id, this.launcher);
  }
}

// Usage
const launcher = new GameLauncher();
const gameService = new GameService(launcher);

// ❌ Bad: Direct instantiation
class GameService {
  private launcher = new GameLauncher(); // Hard to test
  
  async startGameSession(gameId: string, executable: string): Promise<GameSession> {
    // Implementation
  }
}
```

### 2. Create Abstraction Layers

```typescript
// ✅ Good: Abstract game management
abstract class BaseGameManager {
  protected launcher: GameLauncher;
  
  constructor(launcher: GameLauncher) {
    this.launcher = launcher;
    this.setupEventHandlers();
  }
  
  protected abstract setupEventHandlers(): void;
  protected abstract validateGameConfig(config: any): void;
  
  async launchGame(config: any): Promise<string> {
    this.validateGameConfig(config);
    return await this.launcher.launchGame(this.transformConfig(config));
  }
  
  protected abstract transformConfig(config: any): LaunchGameOptions;
}

class SteamGameManager extends BaseGameManager {
  protected setupEventHandlers(): void {
    this.launcher.on('launched', (event) => {
      console.log(`Steam game ${event.gameId} launched`);
    });
  }
  
  protected validateGameConfig(config: SteamGameConfig): void {
    if (!config.appId) {
      throw new Error('Steam app ID is required');
    }
  }
  
  protected transformConfig(config: SteamGameConfig): LaunchGameOptions {
    return {
      gameId: `steam-${config.appId}`,
      executable: this.getSteamExecutable(),
      args: ['-applaunch', config.appId]
    };
  }
  
  private getSteamExecutable(): string {
    // Platform-specific Steam executable detection
  }
}
```

### 3. Use Configuration Objects

```typescript
// ✅ Good: Centralized configuration
interface GameLauncherConfig {
  monitoring: {
    interval: number;
    timeout: number;
  };
  process: {
    killTimeout: number;
    maxRetries: number;
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    file?: string;
  };
}

class ConfigurableGameLauncher {
  private launcher: GameLauncher;
  private config: GameLauncherConfig;
  
  constructor(config: GameLauncherConfig) {
    this.config = config;
    this.launcher = new GameLauncher({
      monitoringInterval: config.monitoring.interval,
      timeout: config.monitoring.timeout,
      maxRetries: config.process.maxRetries,
      processManager: {
        killTimeout: config.process.killTimeout
      }
    });
  }
}

// ❌ Bad: Scattered configuration
const launcher = new GameLauncher({
  monitoringInterval: 1000,  // Magic number
  timeout: 30000,           // Magic number
  maxRetries: 3             // Magic number
});
```

## 🚨 Error Handling

### 1. Use Specific Error Types

```typescript
// ✅ Good: Custom error types
class GameLaunchError extends Error {
  constructor(
    message: string,
    public gameId: string,
    public executable: string,
    public cause?: Error
  ) {
    super(message);
    this.name = 'GameLaunchError';
  }
}

class GameNotFoundError extends Error {
  constructor(public gameId: string) {
    super(`Game not found: ${gameId}`);
    this.name = 'GameNotFoundError';
  }
}

class ExecutableNotFoundError extends Error {
  constructor(public executable: string) {
    super(`Executable not found: ${executable}`);
    this.name = 'ExecutableNotFoundError';
  }
}

// Usage
try {
  await launcher.launchGame({ gameId, executable });
} catch (error) {
  if (error instanceof GameLaunchError) {
    console.error(`Failed to launch ${error.gameId}:`, error.message);
  } else if (error instanceof ExecutableNotFoundError) {
    console.error(`Executable missing: ${error.executable}`);
  } else {
    console.error('Unexpected error:', error);
  }
}

// ❌ Bad: Generic error handling
try {
  await launcher.launchGame({ gameId, executable });
} catch (error) {
  console.error('Something went wrong:', error.message);
}
```

### 2. Implement Retry Logic

```typescript
// ✅ Good: Robust retry mechanism
class RobustGameLauncher {
  private launcher: GameLauncher;
  
  constructor(launcher: GameLauncher) {
    this.launcher = launcher;
  }
  
  async launchGameWithRetry(
    options: LaunchGameOptions,
    maxRetries: number = 3,
    retryDelay: number = 1000
  ): Promise<string> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.launcher.launchGame(options);
      } catch (error) {
        lastError = error;
        
        if (this.isRetryableError(error)) {
          console.warn(`Launch attempt ${attempt} failed, retrying in ${retryDelay}ms...`);
          await this.delay(retryDelay);
          retryDelay *= 2; // Exponential backoff
        } else {
          throw error; // Don't retry non-retryable errors
        }
      }
    }
    
    throw new GameLaunchError(
      `Failed to launch game after ${maxRetries} attempts`,
      options.gameId,
      options.executable,
      lastError
    );
  }
  
  private isRetryableError(error: Error): boolean {
    // Define which errors are worth retrying
    const retryableMessages = [
      'EBUSY',
      'EAGAIN',
      'EMFILE',
      'temporarily unavailable'
    ];
    
    return retryableMessages.some(msg => 
      error.message.toLowerCase().includes(msg.toLowerCase())
    );
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### 3. Graceful Degradation

```typescript
// ✅ Good: Graceful degradation
class FaultTolerantGameLauncher {
  private primaryLauncher: GameLauncher;
  private fallbackLauncher?: GameLauncher;
  
  constructor(primary: GameLauncher, fallback?: GameLauncher) {
    this.primaryLauncher = primary;
    this.fallbackLauncher = fallback;
  }
  
  async launchGame(options: LaunchGameOptions): Promise<string> {
    try {
      return await this.primaryLauncher.launchGame(options);
    } catch (primaryError) {
      console.warn('Primary launcher failed:', primaryError.message);
      
      if (this.fallbackLauncher) {
        try {
          console.log('Attempting fallback launcher...');
          return await this.fallbackLauncher.launchGame(options);
        } catch (fallbackError) {
          console.error('Fallback launcher also failed:', fallbackError.message);
          throw new Error(`Both primary and fallback launchers failed. Primary: ${primaryError.message}, Fallback: ${fallbackError.message}`);
        }
      }
      
      throw primaryError;
    }
  }
}
```

## ⚡ Performance Optimization

### 1. Optimize Monitoring Intervals

```typescript
// ✅ Good: Adaptive monitoring
class AdaptiveGameLauncher {
  private launcher: GameLauncher;
  private runningGames = new Set<string>();
  
  constructor() {
    this.launcher = new GameLauncher({
      monitoringInterval: this.calculateOptimalInterval()
    });
    
    this.setupEventHandlers();
  }
  
  private calculateOptimalInterval(): number {
    const gameCount = this.runningGames.size;
    
    if (gameCount === 0) {
      return 5000; // Slow monitoring when no games
    } else if (gameCount <= 3) {
      return 1000; // Normal monitoring
    } else {
      return 2000; // Slower monitoring with many games
    }
  }
  
  private setupEventHandlers(): void {
    this.launcher.on('launched', (event) => {
      this.runningGames.add(event.gameId);
      this.adjustMonitoringInterval();
    });
    
    this.launcher.on('closed', (event) => {
      this.runningGames.delete(event.gameId);
      this.adjustMonitoringInterval();
    });
  }
  
  private adjustMonitoringInterval(): void {
    // Note: This would require extending the GameLauncher API
    // to support dynamic interval changes
    const newInterval = this.calculateOptimalInterval();
    console.log(`Adjusting monitoring interval to ${newInterval}ms`);
  }
}

// ❌ Bad: Fixed monitoring regardless of load
const launcher = new GameLauncher({
  monitoringInterval: 500 // Always fast, even with many games
});
```

### 2. Batch Operations

```typescript
// ✅ Good: Batch game operations
class BatchGameLauncher {
  private launcher: GameLauncher;
  private pendingLaunches: LaunchGameOptions[] = [];
  private batchTimeout?: NodeJS.Timeout;
  
  constructor(launcher: GameLauncher, private batchDelay: number = 100) {
    this.launcher = launcher;
  }
  
  async launchGame(options: LaunchGameOptions): Promise<string> {
    return new Promise((resolve, reject) => {
      this.pendingLaunches.push({
        ...options,
        _resolve: resolve,
        _reject: reject
      } as any);
      
      this.scheduleBatch();
    });
  }
  
  private scheduleBatch(): void {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
    }
    
    this.batchTimeout = setTimeout(() => {
      this.processBatch();
    }, this.batchDelay);
  }
  
  private async processBatch(): void {
    const batch = this.pendingLaunches.splice(0);
    
    // Process launches in parallel with concurrency limit
    const concurrencyLimit = 3;
    const chunks = this.chunkArray(batch, concurrencyLimit);
    
    for (const chunk of chunks) {
      await Promise.allSettled(
        chunk.map(async (options) => {
          try {
            const result = await this.launcher.launchGame(options);
            (options as any)._resolve(result);
          } catch (error) {
            (options as any)._reject(error);
          }
        })
      );
    }
  }
  
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}
```

### 3. Memory Management

```typescript
// ✅ Good: Proper cleanup and memory management
class ManagedGameLauncher {
  private launcher: GameLauncher;
  private eventHandlers = new Map<string, Function>();
  private gameHistory = new Map<string, GameHistoryEntry>();
  private maxHistorySize = 1000;
  
  constructor(launcher: GameLauncher) {
    this.launcher = launcher;
    this.setupEventHandlers();
    this.setupCleanupTimer();
  }
  
  private setupEventHandlers(): void {
    const launchedHandler = (event: any) => {
      this.addToHistory(event.gameId, 'launched', event);
    };
    
    const closedHandler = (event: any) => {
      this.addToHistory(event.gameId, 'closed', event);
    };
    
    this.launcher.on('launched', launchedHandler);
    this.launcher.on('closed', closedHandler);
    
    // Store handlers for cleanup
    this.eventHandlers.set('launched', launchedHandler);
    this.eventHandlers.set('closed', closedHandler);
  }
  
  private addToHistory(gameId: string, event: string, data: any): void {
    // Limit history size to prevent memory leaks
    if (this.gameHistory.size >= this.maxHistorySize) {
      const oldestKey = this.gameHistory.keys().next().value;
      this.gameHistory.delete(oldestKey);
    }
    
    this.gameHistory.set(`${gameId}-${Date.now()}`, {
      gameId,
      event,
      timestamp: new Date(),
      data
    });
  }
  
  private setupCleanupTimer(): void {
    // Clean up old history entries every hour
    setInterval(() => {
      this.cleanupHistory();
    }, 60 * 60 * 1000);
  }
  
  private cleanupHistory(): void {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
    
    for (const [key, entry] of this.gameHistory.entries()) {
      if (entry.timestamp < cutoff) {
        this.gameHistory.delete(key);
      }
    }
  }
  
  destroy(): void {
    // Clean up event handlers
    for (const [event, handler] of this.eventHandlers.entries()) {
      this.launcher.off(event, handler);
    }
    
    // Clear collections
    this.eventHandlers.clear();
    this.gameHistory.clear();
    
    // Destroy underlying launcher
    this.launcher.destroy();
  }
}

interface GameHistoryEntry {
  gameId: string;
  event: string;
  timestamp: Date;
  data: any;
}
```

## 🔒 Security Considerations

### 1. Input Validation

```typescript
// ✅ Good: Comprehensive input validation
import { validateGameId, validateExecutable } from 'game-launcher';
import path from 'path';

class SecureGameLauncher {
  private launcher: GameLauncher;
  private allowedPaths: string[];
  
  constructor(launcher: GameLauncher, allowedPaths: string[] = []) {
    this.launcher = launcher;
    this.allowedPaths = allowedPaths.map(p => path.resolve(p));
  }
  
  async launchGame(options: LaunchGameOptions): Promise<string> {
    // Validate game ID
    this.validateGameId(options.gameId);
    
    // Validate and sanitize executable path
    const sanitizedExecutable = await this.validateAndSanitizeExecutable(options.executable);
    
    // Validate arguments
    const sanitizedArgs = this.validateArguments(options.args || []);
    
    // Validate environment variables
    const sanitizedEnvironment = this.validateEnvironment(options.environment || {});
    
    return await this.launcher.launchGame({
      ...options,
      executable: sanitizedExecutable,
      args: sanitizedArgs,
      environment: sanitizedEnvironment
    });
  }
  
  private validateGameId(gameId: string): void {
    validateGameId(gameId);
    
    // Additional security checks
    if (gameId.includes('..') || gameId.includes('/') || gameId.includes('\\')) {
      throw new Error('Game ID contains invalid path characters');
    }
  }
  
  private async validateAndSanitizeExecutable(executable: string): Promise<string> {
    // Resolve to absolute path
    const resolvedPath = path.resolve(executable);
    
    // Check if path is in allowed directories
    if (this.allowedPaths.length > 0) {
      const isAllowed = this.allowedPaths.some(allowedPath => 
        resolvedPath.startsWith(allowedPath)
      );
      
      if (!isAllowed) {
        throw new Error(`Executable path not in allowed directories: ${resolvedPath}`);
      }
    }
    
    // Validate executable exists and is executable
    await validateExecutable(resolvedPath);
    
    return resolvedPath;
  }
  
  private validateArguments(args: string[]): string[] {
    const dangerousPatterns = [
      /[;&|`$(){}\[\]]/,  // Shell metacharacters
      /^-/,               // Flags that might be dangerous
      /\.\.[\\/]/,        // Path traversal
    ];
    
    return args.map(arg => {
      // Check for dangerous patterns
      for (const pattern of dangerousPatterns) {
        if (pattern.test(arg)) {
          throw new Error(`Dangerous argument detected: ${arg}`);
        }
      }
      
      // Sanitize the argument
      return arg.trim();
    });
  }
  
  private validateEnvironment(env: Record<string, string>): Record<string, string> {
    const allowedEnvVars = [
      'DISPLAY', 'HOME', 'USER', 'PATH',
      'GAME_MODE', 'DEBUG_LEVEL',
      // Add other safe environment variables
    ];
    
    const sanitized: Record<string, string> = {};
    
    for (const [key, value] of Object.entries(env)) {
      // Only allow specific environment variables
      if (allowedEnvVars.includes(key) || key.startsWith('GAME_')) {
        // Sanitize value
        if (typeof value === 'string' && value.length < 1000) {
          sanitized[key] = value;
        }
      }
    }
    
    return sanitized;
  }
}

// ❌ Bad: No input validation
const gameId = await launcher.launchGame({
  gameId: userInput.gameId,        // Could be malicious
  executable: userInput.executable, // Could be dangerous path
  args: userInput.args             // Could contain shell injection
});
```

### 2. Principle of Least Privilege

```typescript
// ✅ Good: Run with minimal privileges
class PrivilegedGameLauncher {
  private launcher: GameLauncher;
  
  constructor() {
    this.launcher = new GameLauncher();
  }
  
  async launchGame(options: LaunchGameOptions): Promise<string> {
    // Drop privileges if running as root (Unix systems)
    const processOptions: ProcessStartOptions = {
      ...options.processOptions
    };
    
    if (process.getuid && process.getuid() === 0) {
      // Running as root, drop to regular user
      processOptions.uid = 1000; // Regular user ID
      processOptions.gid = 1000; // Regular group ID
    }
    
    return await this.launcher.launchGame({
      ...options,
      processOptions
    });
  }
}
```

## 🧪 Testing Strategies

### 1. Mock External Dependencies

```typescript
// ✅ Good: Testable design with mocks
interface IProcessManager {
  startProcess(options: ProcessStartOptions): Promise<GameProcessInfo>;
  killProcess(pid: number): Promise<void>;
  isProcessRunning(pid: number): Promise<boolean>;
}

class TestableGameLauncher {
  constructor(private processManager: IProcessManager) {}
  
  async launchGame(options: LaunchGameOptions): Promise<string> {
    const processInfo = await this.processManager.startProcess({
      executable: options.executable,
      args: options.args
    });
    
    return processInfo.pid.toString();
  }
}

// Test
class MockProcessManager implements IProcessManager {
  async startProcess(options: ProcessStartOptions): Promise<GameProcessInfo> {
    return {
      pid: 12345,
      executable: options.executable,
      args: options.args || [],
      status: 'running'
    };
  }
  
  async killProcess(pid: number): Promise<void> {
    // Mock implementation
  }
  
  async isProcessRunning(pid: number): Promise<boolean> {
    return true;
  }
}

// Usage in tests
const mockProcessManager = new MockProcessManager();
const launcher = new TestableGameLauncher(mockProcessManager);

test('should launch game successfully', async () => {
  const gameId = await launcher.launchGame({
    gameId: 'test-game',
    executable: '/path/to/test.exe'
  });
  
  expect(gameId).toBe('12345');
});
```

### 2. Integration Tests

```typescript
// ✅ Good: Comprehensive integration tests
describe('GameLauncher Integration Tests', () => {
  let launcher: GameLauncher;
  let testExecutable: string;
  
  beforeEach(() => {
    launcher = new GameLauncher({
      monitoringInterval: 100 // Fast monitoring for tests
    });
    
    // Use a simple test executable
    testExecutable = process.platform === 'win32' 
      ? 'notepad.exe'
      : '/bin/sleep';
  });
  
  afterEach(async () => {
    // Clean up any running games
    const runningGames = await launcher.getRunningGames();
    for (const gameId of runningGames) {
      try {
        await launcher.closeGame(gameId);
      } catch (error) {
        console.warn(`Failed to close game ${gameId}:`, error.message);
      }
    }
    
    launcher.destroy();
  });
  
  test('should launch and monitor game', async () => {
    const gameId = 'test-game';
    const args = process.platform === 'win32' ? [] : ['5']; // Sleep for 5 seconds
    
    // Launch game
    const launchedGameId = await launcher.launchGame({
      gameId,
      executable: testExecutable,
      args
    });
    
    expect(launchedGameId).toBe(gameId);
    
    // Check if game is running
    const isRunning = await launcher.isGameRunning(gameId);
    expect(isRunning).toBe(true);
    
    // Get game info
    const gameInfo = await launcher.getGameInfo(gameId);
    expect(gameInfo).toBeDefined();
    expect(gameInfo!.executable).toBe(testExecutable);
    
    // Close game
    await launcher.closeGame(gameId);
    
    // Wait a bit for the process to close
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Check if game is closed
    const isStillRunning = await launcher.isGameRunning(gameId);
    expect(isStillRunning).toBe(false);
  }, 10000); // 10 second timeout
  
  test('should handle multiple games', async () => {
    const games = [
      { gameId: 'game1', executable: testExecutable },
      { gameId: 'game2', executable: testExecutable },
      { gameId: 'game3', executable: testExecutable }
    ];
    
    // Launch all games
    const launchPromises = games.map(game => 
      launcher.launchGame({
        ...game,
        args: process.platform === 'win32' ? [] : ['10']
      })
    );
    
    await Promise.all(launchPromises);
    
    // Check all games are running
    const runningGames = await launcher.getRunningGames();
    expect(runningGames).toHaveLength(3);
    expect(runningGames).toEqual(expect.arrayContaining(['game1', 'game2', 'game3']));
    
    // Close all games
    const closePromises = games.map(game => launcher.closeGame(game.gameId));
    await Promise.all(closePromises);
  }, 15000);
});
```

## 📊 Monitoring and Logging

### 1. Structured Logging

```typescript
// ✅ Good: Structured logging with context
interface Logger {
  debug(message: string, context?: any): void;
  info(message: string, context?: any): void;
  warn(message: string, context?: any): void;
  error(message: string, context?: any): void;
}

class GameLauncherWithLogging {
  private launcher: GameLauncher;
  
  constructor(private logger: Logger) {
    this.launcher = new GameLauncher();
    this.setupEventLogging();
  }
  
  private setupEventLogging(): void {
    this.launcher.on('launched', (event) => {
      this.logger.info('Game launched', {
        gameId: event.gameId,
        pid: event.pid,
        executable: event.executable,
        timestamp: new Date().toISOString()
      });
    });
    
    this.launcher.on('closed', (event) => {
      this.logger.info('Game closed', {
        gameId: event.gameId,
        exitCode: event.exitCode,
        duration: event.duration,
        timestamp: new Date().toISOString()
      });
    });
    
    this.launcher.on('error', (event) => {
      this.logger.error('Game error', {
        gameId: event.gameId,
        error: event.error.message,
        stack: event.error.stack,
        timestamp: new Date().toISOString()
      });
    });
  }
  
  async launchGame(options: LaunchGameOptions): Promise<string> {
    this.logger.debug('Launching game', {
      gameId: options.gameId,
      executable: options.executable,
      args: options.args
    });
    
    try {
      const result = await this.launcher.launchGame(options);
      this.logger.debug('Game launch successful', {
        gameId: options.gameId,
        result
      });
      return result;
    } catch (error) {
      this.logger.error('Game launch failed', {
        gameId: options.gameId,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }
}
```

### 2. Metrics Collection

```typescript
// ✅ Good: Metrics collection for monitoring
interface Metrics {
  increment(metric: string, tags?: Record<string, string>): void;
  gauge(metric: string, value: number, tags?: Record<string, string>): void;
  timing(metric: string, duration: number, tags?: Record<string, string>): void;
}

class MetricsCollectingGameLauncher {
  private launcher: GameLauncher;
  private launchTimes = new Map<string, number>();
  
  constructor(private metrics: Metrics) {
    this.launcher = new GameLauncher();
    this.setupMetricsCollection();
  }
  
  private setupMetricsCollection(): void {
    this.launcher.on('launched', (event) => {
      this.metrics.increment('game.launched', {
        gameId: event.gameId
      });
      
      this.launchTimes.set(event.gameId, Date.now());
    });
    
    this.launcher.on('closed', (event) => {
      this.metrics.increment('game.closed', {
        gameId: event.gameId,
        exitCode: event.exitCode.toString()
      });
      
      const launchTime = this.launchTimes.get(event.gameId);
      if (launchTime) {
        const sessionDuration = Date.now() - launchTime;
        this.metrics.timing('game.session_duration', sessionDuration, {
          gameId: event.gameId
        });
        this.launchTimes.delete(event.gameId);
      }
    });
    
    this.launcher.on('error', (event) => {
      this.metrics.increment('game.error', {
        gameId: event.gameId,
        errorType: event.error.constructor.name
      });
    });
    
    // Periodic metrics
    setInterval(async () => {
      const runningGames = await this.launcher.getRunningGames();
      this.metrics.gauge('game.running_count', runningGames.length);
    }, 30000); // Every 30 seconds
  }
}
```

## 🌍 Cross-Platform Development

### 1. Platform Abstraction

```typescript
// ✅ Good: Platform-specific implementations
abstract class PlatformGameLauncher {
  protected launcher: GameLauncher;
  
  constructor() {
    this.launcher = new GameLauncher(this.getPlatformConfig());
  }
  
  protected abstract getPlatformConfig(): GameLauncherOptions;
  protected abstract getDefaultGamePaths(): string[];
  protected abstract findExecutable(gameName: string): Promise<string | null>;
  
  async launchGameByName(gameId: string, gameName: string, args?: string[]): Promise<string> {
    const executable = await this.findExecutable(gameName);
    if (!executable) {
      throw new Error(`Game executable not found: ${gameName}`);
    }
    
    return await this.launcher.launchGame({
      gameId,
      executable,
      args
    });
  }
}

class WindowsGameLauncher extends PlatformGameLauncher {
  protected getPlatformConfig(): GameLauncherOptions {
    return {
      monitoringInterval: 500,
      processManager: {
        killTimeout: 3000,
        detachedMonitoring: true
      }
    };
  }
  
  protected getDefaultGamePaths(): string[] {
    return [
      'C:\\Program Files\\',
      'C:\\Program Files (x86)\\',
      'C:\\Games\\'
    ];
  }
  
  protected async findExecutable(gameName: string): Promise<string | null> {
    const paths = this.getDefaultGamePaths();
    
    for (const basePath of paths) {
      const executable = path.join(basePath, gameName, `${gameName}.exe`);
      try {
        await validateExecutable(executable);
        return executable;
      } catch {
        continue;
      }
    }
    
    return null;
  }
}

class LinuxGameLauncher extends PlatformGameLauncher {
  protected getPlatformConfig(): GameLauncherOptions {
    return {
      monitoringInterval: 1000,
      processManager: {
        killTimeout: 10000,
        detachedMonitoring: true
      }
    };
  }
  
  protected getDefaultGamePaths(): string[] {
    return [
      '/usr/local/games/',
      '/opt/',
      `/home/${process.env.USER}/games/`
    ];
  }
  
  protected async findExecutable(gameName: string): Promise<string | null> {
    // Check in PATH first
    try {
      const { stdout } = await exec(`which ${gameName}`);
      return stdout.trim();
    } catch {
      // Not in PATH, check default locations
    }
    
    const paths = this.getDefaultGamePaths();
    
    for (const basePath of paths) {
      const executable = path.join(basePath, gameName, gameName);
      try {
        await validateExecutable(executable);
        return executable;
      } catch {
        continue;
      }
    }
    
    return null;
  }
}

// Factory function
function createPlatformLauncher(): PlatformGameLauncher {
  const platform = getPlatform();
  
  switch (platform) {
    case 'win32':
      return new WindowsGameLauncher();
    case 'linux':
      return new LinuxGameLauncher();
    case 'darwin':
      return new MacOSGameLauncher();
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}
```

## 🚀 Production Deployment

### 1. Configuration Management

```typescript
// ✅ Good: Environment-based configuration
interface ProductionConfig {
  launcher: GameLauncherOptions;
  logging: {
    level: string;
    file?: string;
  };
  metrics: {
    enabled: boolean;
    endpoint?: string;
  };
  security: {
    allowedPaths: string[];
    maxConcurrentGames: number;
  };
}

class ProductionGameLauncher {
  private launcher: GameLauncher;
  private config: ProductionConfig;
  
  constructor() {
    this.config = this.loadConfiguration();
    this.launcher = new GameLauncher(this.config.launcher);
    this.setupProductionFeatures();
  }
  
  private loadConfiguration(): ProductionConfig {
    const env = process.env.NODE_ENV || 'development';
    
    // Load configuration from environment variables or config files
    return {
      launcher: {
        monitoringInterval: parseInt(process.env.MONITORING_INTERVAL || '1000'),
        maxRetries: parseInt(process.env.MAX_RETRIES || '3'),
        timeout: parseInt(process.env.TIMEOUT || '30000')
      },
      logging: {
        level: process.env.LOG_LEVEL || 'info',
        file: process.env.LOG_FILE
      },
      metrics: {
        enabled: process.env.METRICS_ENABLED === 'true',
        endpoint: process.env.METRICS_ENDPOINT
      },
      security: {
        allowedPaths: (process.env.ALLOWED_PATHS || '').split(',').filter(Boolean),
        maxConcurrentGames: parseInt(process.env.MAX_CONCURRENT_GAMES || '10')
      }
    };
  }
  
  private setupProductionFeatures(): void {
    // Setup logging
    if (this.config.logging.file) {
      // Configure file logging
    }
    
    // Setup metrics
    if (this.config.metrics.enabled) {
      // Configure metrics collection
    }
    
    // Setup graceful shutdown
    process.on('SIGTERM', () => this.gracefulShutdown());
    process.on('SIGINT', () => this.gracefulShutdown());
  }
  
  private async gracefulShutdown(): Promise<void> {
    console.log('Shutting down gracefully...');
    
    try {
      // Close all running games
      const runningGames = await this.launcher.getRunningGames();
      const closePromises = runningGames.map(gameId => 
        this.launcher.closeGame(gameId).catch(error => 
          console.error(`Failed to close game ${gameId}:`, error.message)
        )
      );
      
      await Promise.allSettled(closePromises);
      
      // Destroy launcher
      this.launcher.destroy();
      
      console.log('Shutdown complete');
      process.exit(0);
    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  }
}
```

## ❌ Common Anti-Patterns

### 1. Don't Ignore Errors

```typescript
// ❌ Bad: Ignoring errors
try {
  await launcher.launchGame({ gameId, executable });
} catch (error) {
  // Silently ignore errors
}

// ✅ Good: Proper error handling
try {
  await launcher.launchGame({ gameId, executable });
} catch (error) {
  console.error(`Failed to launch ${gameId}:`, error.message);
  // Take appropriate action (retry, notify user, etc.)
  throw error;
}
```

### 2. Don't Forget Cleanup

```typescript
// ❌ Bad: No cleanup
const launcher = new GameLauncher();
// ... use launcher ...
// Process exits without cleanup

// ✅ Good: Proper cleanup
const launcher = new GameLauncher();

process.on('exit', () => {
  launcher.destroy();
});

process.on('SIGTERM', async () => {
  await launcher.destroy();
  process.exit(0);
});
```

### 3. Don't Use Magic Numbers

```typescript
// ❌ Bad: Magic numbers
const launcher = new GameLauncher({
  monitoringInterval: 500,  // What does 500 mean?
  timeout: 30000           // Why 30000?
});

// ✅ Good: Named constants
const MONITORING_INTERVAL_MS = 500;
const OPERATION_TIMEOUT_MS = 30 * 1000; // 30 seconds

const launcher = new GameLauncher({
  monitoringInterval: MONITORING_INTERVAL_MS,
  timeout: OPERATION_TIMEOUT_MS
});
```

### 4. Don't Block the Event Loop

```typescript
// ❌ Bad: Blocking operations
function processGameOutput(data: string): void {
  // Synchronous heavy processing
  const processed = heavyProcessing(data);
  saveToDatabase(processed);
}

launcher.on('output', (event) => {
  processGameOutput(event.data); // Blocks event loop
});

// ✅ Good: Non-blocking operations
async function processGameOutput(data: string): Promise<void> {
  // Use worker threads or async processing
  const processed = await heavyProcessingAsync(data);
  await saveToDatabaseAsync(processed);
}

launcher.on('output', (event) => {
  // Process asynchronously without blocking
  processGameOutput(event.data).catch(error => {
    console.error('Failed to process game output:', error);
  });
});
```

---

**Next:** [Examples](../examples/) | [API Reference](../api/README.md)
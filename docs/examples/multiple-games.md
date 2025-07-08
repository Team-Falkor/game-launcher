# Multiple Games Management

This example demonstrates how to manage multiple games simultaneously using the Game Launcher library, including coordination, resource management, and advanced monitoring.

## Overview

The Multiple Games example covers:
- Launching and managing multiple games concurrently
- Resource allocation and limits
- Game coordination and dependencies
- Batch operations and scheduling
- Advanced monitoring and statistics
- Error handling for multiple processes

## Prerequisites

- Node.js 16.0.0 or higher
- Game Launcher library installed
- Multiple game executables for testing
- Understanding of concurrent programming concepts

## Code

### Complete Multiple Games Manager

```typescript
import { GameLauncher, GameStatus } from '@team-falkor/game-launcher';
import { EventEmitter } from 'events';

/**
 * Multiple Games Manager
 * Handles launching, monitoring, and coordinating multiple games
 */
class MultipleGamesManager extends EventEmitter {
  private launcher: GameLauncher;
  private activeGames: Map<string, GameInstance> = new Map();
  private gameQueue: QueuedGame[] = [];
  private config: MultiGameConfig;
  private stats: GlobalStats;
  private resourceMonitor: ResourceMonitor;

  constructor(config: Partial<MultiGameConfig> = {}) {
    super();
    
    this.config = {
      maxConcurrentGames: 5,
      maxMemoryUsage: 8 * 1024 * 1024 * 1024, // 8GB
      maxCpuUsage: 80, // 80%
      gameTimeout: 60000,
      queueProcessingInterval: 5000,
      resourceCheckInterval: 10000,
      autoCleanup: true,
      ...config
    };
    
    this.launcher = new GameLauncher({
      timeout: this.config.gameTimeout,
      verbose: true
    });
    
    this.stats = {
      totalLaunched: 0,
      totalClosed: 0,
      totalErrors: 0,
      currentActive: 0,
      peakConcurrent: 0,
      totalPlaytime: 0
    };
    
    this.resourceMonitor = new ResourceMonitor();
    
    this.setupEventHandlers();
    this.startQueueProcessor();
    this.startResourceMonitoring();
  }

  /**
   * Launch multiple games with various strategies
   */
  async launchGames(games: GameLaunchRequest[], strategy: LaunchStrategy = 'parallel'): Promise<LaunchResult[]> {
    console.log(`🚀 Launching ${games.length} games using ${strategy} strategy`);
    
    switch (strategy) {
      case 'parallel':
        return await this.launchParallel(games);
      
      case 'sequential':
        return await this.launchSequential(games);
      
      case 'staggered':
        return await this.launchStaggered(games);
      
      case 'priority':
        return await this.launchByPriority(games);
      
      case 'resource-aware':
        return await this.launchResourceAware(games);
      
      default:
        throw new Error(`Unknown launch strategy: ${strategy}`);
    }
  }

  /**
   * Launch games in parallel (all at once)
   */
  private async launchParallel(games: GameLaunchRequest[]): Promise<LaunchResult[]> {
    console.log('📦 Parallel launch initiated');
    
    const promises = games.map(async (game) => {
      try {
        if (this.canLaunchGame()) {
          const gameId = await this.launchSingleGame(game);
          return { success: true, gameId, game, error: null };
        } else {
          // Queue the game if we can't launch immediately
          this.queueGame(game);
          return { success: false, gameId: null, game, error: new Error('Resource limits reached, game queued') };
        }
      } catch (error) {
        return { success: false, gameId: null, game, error };
      }
    });
    
    const results = await Promise.allSettled(promises);
    return results.map(result => 
      result.status === 'fulfilled' ? result.value : 
      { success: false, gameId: null, game: null, error: result.reason }
    );
  }

  /**
   * Launch games sequentially (one after another)
   */
  private async launchSequential(games: GameLaunchRequest[]): Promise<LaunchResult[]> {
    console.log('🔄 Sequential launch initiated');
    const results: LaunchResult[] = [];
    
    for (const game of games) {
      try {
        // Wait for resources if needed
        await this.waitForResources();
        
        const gameId = await this.launchSingleGame(game);
        results.push({ success: true, gameId, game, error: null });
        
        // Optional delay between launches
        if (game.launchDelay) {
          await this.delay(game.launchDelay);
        }
        
      } catch (error) {
        results.push({ success: false, gameId: null, game, error });
        
        // Continue with next game unless stopOnError is set
        if (game.stopOnError) {
          break;
        }
      }
    }
    
    return results;
  }

  /**
   * Launch games with staggered timing
   */
  private async launchStaggered(games: GameLaunchRequest[], interval: number = 3000): Promise<LaunchResult[]> {
    console.log(`⏰ Staggered launch initiated (${interval}ms intervals)`);
    const results: LaunchResult[] = [];
    
    for (let i = 0; i < games.length; i++) {
      const game = games[i];
      
      try {
        const gameId = await this.launchSingleGame(game);
        results.push({ success: true, gameId, game, error: null });
      } catch (error) {
        results.push({ success: false, gameId: null, game, error });
      }
      
      // Wait before launching next game (except for the last one)
      if (i < games.length - 1) {
        await this.delay(interval);
      }
    }
    
    return results;
  }

  /**
   * Launch games by priority order
   */
  private async launchByPriority(games: GameLaunchRequest[]): Promise<LaunchResult[]> {
    console.log('🎯 Priority-based launch initiated');
    
    // Sort games by priority (higher number = higher priority)
    const sortedGames = [...games].sort((a, b) => (b.priority || 0) - (a.priority || 0));
    
    return await this.launchSequential(sortedGames);
  }

  /**
   * Launch games with resource awareness
   */
  private async launchResourceAware(games: GameLaunchRequest[]): Promise<LaunchResult[]> {
    console.log('🧠 Resource-aware launch initiated');
    const results: LaunchResult[] = [];
    
    for (const game of games) {
      try {
        // Check if we have enough resources for this game
        const resourcesAvailable = await this.checkResourcesForGame(game);
        
        if (resourcesAvailable) {
          const gameId = await this.launchSingleGame(game);
          results.push({ success: true, gameId, game, error: null });
        } else {
          // Queue the game for later
          this.queueGame(game);
          results.push({ 
            success: false, 
            gameId: null, 
            game, 
            error: new Error('Insufficient resources, game queued') 
          });
        }
        
      } catch (error) {
        results.push({ success: false, gameId: null, game, error });
      }
    }
    
    return results;
  }

  /**
   * Launch a single game with full tracking
   */
  private async launchSingleGame(gameRequest: GameLaunchRequest): Promise<string> {
    const gameId = gameRequest.gameId || `game-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`🎮 Launching: ${gameId}`);
    
    // Create game instance tracking
    const gameInstance: GameInstance = {
      gameId,
      request: gameRequest,
      startTime: Date.now(),
      status: 'launching',
      pid: null,
      memoryUsage: 0,
      cpuUsage: 0,
      errors: [],
      events: []
    };
    
    this.activeGames.set(gameId, gameInstance);
    
    try {
      // Launch the game
      const launchedGameId = await this.launcher.launchGame({
        gameId,
        executable: gameRequest.executable,
        args: gameRequest.args || [],
        cwd: gameRequest.cwd,
        env: gameRequest.env,
        detached: gameRequest.detached !== false // Default to true
      });
      
      // Update statistics
      this.stats.totalLaunched++;
      this.stats.currentActive++;
      this.stats.peakConcurrent = Math.max(this.stats.peakConcurrent, this.stats.currentActive);
      
      // Emit custom event
      this.emit('gameStarted', { gameId, gameInstance });
      
      return launchedGameId;
      
    } catch (error) {
      // Remove failed game from tracking
      this.activeGames.delete(gameId);
      this.stats.totalErrors++;
      
      console.error(`❌ Failed to launch ${gameId}:`, error.message);
      throw error;
    }
  }

  /**
   * Close a specific game
   */
  async closeGame(gameId: string, force: boolean = false): Promise<boolean> {
    console.log(`🔴 Closing game: ${gameId}${force ? ' (forced)' : ''}`);
    
    try {
      const success = await this.launcher.closeGame(gameId, force);
      
      if (success) {
        console.log(`✅ Game ${gameId} closed successfully`);
      } else {
        console.warn(`⚠️ Game ${gameId} may not have closed properly`);
      }
      
      return success;
      
    } catch (error) {
      console.error(`❌ Failed to close game ${gameId}:`, error.message);
      return false;
    }
  }

  /**
   * Close multiple games
   */
  async closeGames(gameIds: string[], strategy: CloseStrategy = 'parallel'): Promise<CloseResult[]> {
    console.log(`🔴 Closing ${gameIds.length} games using ${strategy} strategy`);
    
    switch (strategy) {
      case 'parallel':
        return await this.closeParallel(gameIds);
      
      case 'sequential':
        return await this.closeSequential(gameIds);
      
      case 'graceful-then-force':
        return await this.closeGracefulThenForce(gameIds);
      
      default:
        throw new Error(`Unknown close strategy: ${strategy}`);
    }
  }

  /**
   * Close all active games
   */
  async closeAllGames(strategy: CloseStrategy = 'graceful-then-force'): Promise<CloseResult[]> {
    const gameIds = Array.from(this.activeGames.keys());
    return await this.closeGames(gameIds, strategy);
  }

  /**
   * Close games in parallel
   */
  private async closeParallel(gameIds: string[]): Promise<CloseResult[]> {
    const promises = gameIds.map(async (gameId) => {
      try {
        const success = await this.closeGame(gameId);
        return { gameId, success, error: null };
      } catch (error) {
        return { gameId, success: false, error };
      }
    });
    
    const results = await Promise.allSettled(promises);
    return results.map(result => 
      result.status === 'fulfilled' ? result.value : 
      { gameId: 'unknown', success: false, error: result.reason }
    );
  }

  /**
   * Close games sequentially
   */
  private async closeSequential(gameIds: string[]): Promise<CloseResult[]> {
    const results: CloseResult[] = [];
    
    for (const gameId of gameIds) {
      try {
        const success = await this.closeGame(gameId);
        results.push({ gameId, success, error: null });
        
        // Small delay between closes
        await this.delay(1000);
        
      } catch (error) {
        results.push({ gameId, success: false, error });
      }
    }
    
    return results;
  }

  /**
   * Close games gracefully, then force close if needed
   */
  private async closeGracefulThenForce(gameIds: string[]): Promise<CloseResult[]> {
    console.log('🤝 Attempting graceful close first...');
    
    // First attempt: graceful close
    const gracefulResults = await this.closeParallel(gameIds);
    
    // Wait a bit for games to close
    await this.delay(5000);
    
    // Second attempt: force close any remaining games
    const stillRunning = gracefulResults
      .filter(result => !result.success)
      .map(result => result.gameId);
    
    if (stillRunning.length > 0) {
      console.log(`💪 Force closing ${stillRunning.length} remaining games...`);
      
      const forceResults = await Promise.all(
        stillRunning.map(async (gameId) => {
          try {
            const success = await this.closeGame(gameId, true);
            return { gameId, success, error: null };
          } catch (error) {
            return { gameId, success: false, error };
          }
        })
      );
      
      // Merge results
      const finalResults = [...gracefulResults];
      forceResults.forEach(forceResult => {
        const index = finalResults.findIndex(r => r.gameId === forceResult.gameId);
        if (index !== -1) {
          finalResults[index] = forceResult;
        }
      });
      
      return finalResults;
    }
    
    return gracefulResults;
  }

  /**
   * Get information about all active games
   */
  getActiveGames(): GameInstance[] {
    return Array.from(this.activeGames.values());
  }

  /**
   * Get information about a specific game
   */
  getGameInfo(gameId: string): GameInstance | null {
    return this.activeGames.get(gameId) || null;
  }

  /**
   * Get current statistics
   */
  getStats(): GlobalStats {
    return { ...this.stats };
  }

  /**
   * Get resource usage information
   */
  async getResourceUsage(): Promise<ResourceUsage> {
    return await this.resourceMonitor.getCurrentUsage();
  }

  /**
   * Check if we can launch another game
   */
  private canLaunchGame(): boolean {
    return this.stats.currentActive < this.config.maxConcurrentGames;
  }

  /**
   * Check if we have enough resources for a specific game
   */
  private async checkResourcesForGame(game: GameLaunchRequest): Promise<boolean> {
    const currentUsage = await this.resourceMonitor.getCurrentUsage();
    
    // Check concurrent games limit
    if (this.stats.currentActive >= this.config.maxConcurrentGames) {
      return false;
    }
    
    // Check memory usage
    if (currentUsage.memoryUsage > this.config.maxMemoryUsage * 0.9) {
      return false;
    }
    
    // Check CPU usage
    if (currentUsage.cpuUsage > this.config.maxCpuUsage) {
      return false;
    }
    
    return true;
  }

  /**
   * Wait for resources to become available
   */
  private async waitForResources(timeout: number = 30000): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      if (await this.checkResourcesForGame({} as GameLaunchRequest)) {
        return;
      }
      
      await this.delay(1000);
    }
    
    throw new Error('Timeout waiting for resources');
  }

  /**
   * Queue a game for later launching
   */
  private queueGame(game: GameLaunchRequest): void {
    const queuedGame: QueuedGame = {
      ...game,
      queuedAt: Date.now(),
      attempts: 0
    };
    
    this.gameQueue.push(queuedGame);
    console.log(`📋 Game queued: ${game.gameId || 'unnamed'} (queue size: ${this.gameQueue.length})`);
    
    this.emit('gameQueued', queuedGame);
  }

  /**
   * Process the game queue
   */
  private async processQueue(): Promise<void> {
    if (this.gameQueue.length === 0) {
      return;
    }
    
    console.log(`🔄 Processing queue (${this.gameQueue.length} games waiting)`);
    
    const gamesToProcess = [...this.gameQueue];
    this.gameQueue = [];
    
    for (const queuedGame of gamesToProcess) {
      try {
        if (await this.checkResourcesForGame(queuedGame)) {
          console.log(`📤 Launching queued game: ${queuedGame.gameId || 'unnamed'}`);
          await this.launchSingleGame(queuedGame);
        } else {
          // Re-queue if still no resources
          queuedGame.attempts++;
          
          if (queuedGame.attempts < 5) {
            this.gameQueue.push(queuedGame);
          } else {
            console.warn(`⚠️ Dropping game from queue after 5 attempts: ${queuedGame.gameId}`);
            this.emit('gameDropped', queuedGame);
          }
        }
      } catch (error) {
        console.error(`❌ Failed to launch queued game:`, error.message);
        this.emit('queueError', { game: queuedGame, error });
      }
    }
  }

  /**
   * Start the queue processor
   */
  private startQueueProcessor(): void {
    setInterval(() => {
      this.processQueue().catch(error => {
        console.error('Queue processing error:', error);
      });
    }, this.config.queueProcessingInterval);
  }

  /**
   * Start resource monitoring
   */
  private startResourceMonitoring(): void {
    setInterval(async () => {
      try {
        const usage = await this.resourceMonitor.getCurrentUsage();
        
        // Update game instances with resource usage
        for (const [gameId, instance] of this.activeGames) {
          const gameInfo = this.launcher.getGameInfo(gameId);
          if (gameInfo) {
            instance.pid = gameInfo.pid;
            // Note: Individual process resource usage would require additional monitoring
          }
        }
        
        // Emit resource update event
        this.emit('resourceUpdate', usage);
        
        // Check for resource warnings
        if (usage.memoryUsage > this.config.maxMemoryUsage * 0.9) {
          this.emit('resourceWarning', { type: 'memory', usage: usage.memoryUsage });
        }
        
        if (usage.cpuUsage > this.config.maxCpuUsage * 0.9) {
          this.emit('resourceWarning', { type: 'cpu', usage: usage.cpuUsage });
        }
        
      } catch (error) {
        console.error('Resource monitoring error:', error);
      }
    }, this.config.resourceCheckInterval);
  }

  /**
   * Set up event handlers for the game launcher
   */
  private setupEventHandlers(): void {
    this.launcher.on('launched', (event) => {
      const instance = this.activeGames.get(event.gameId);
      if (instance) {
        instance.status = 'running';
        instance.pid = event.pid;
        instance.events.push({ type: 'launched', timestamp: Date.now(), data: event });
      }
      
      console.log(`✅ Game launched: ${event.gameId} (PID: ${event.pid})`);
      this.emit('gameLaunched', event);
    });
    
    this.launcher.on('closed', (event) => {
      const instance = this.activeGames.get(event.gameId);
      if (instance) {
        instance.status = 'closed';
        instance.endTime = Date.now();
        instance.runtime = event.runtime;
        instance.exitCode = event.exitCode;
        instance.events.push({ type: 'closed', timestamp: Date.now(), data: event });
        
        // Update statistics
        this.stats.currentActive--;
        this.stats.totalClosed++;
        this.stats.totalPlaytime += event.runtime;
        
        // Remove from active games
        this.activeGames.delete(event.gameId);
      }
      
      console.log(`🔴 Game closed: ${event.gameId} (Runtime: ${this.formatDuration(event.runtime)})`);
      this.emit('gameClosed', event);
    });
    
    this.launcher.on('error', (event) => {
      const instance = this.activeGames.get(event.gameId);
      if (instance) {
        instance.errors.push(event.error);
        instance.events.push({ type: 'error', timestamp: Date.now(), data: event });
      }
      
      this.stats.totalErrors++;
      
      console.error(`❌ Game error: ${event.gameId} - ${event.error.message}`);
      this.emit('gameError', event);
    });
    
    this.launcher.on('output', (event) => {
      const instance = this.activeGames.get(event.gameId);
      if (instance) {
        instance.events.push({ type: 'output', timestamp: Date.now(), data: event });
      }
      
      this.emit('gameOutput', event);
    });
    
    this.launcher.on('statusChange', (event) => {
      const instance = this.activeGames.get(event.gameId);
      if (instance) {
        instance.status = event.newStatus;
        instance.events.push({ type: 'statusChange', timestamp: Date.now(), data: event });
      }
      
      this.emit('gameStatusChange', event);
    });
  }

  /**
   * Generate a comprehensive report
   */
  generateReport(): MultiGameReport {
    const activeGames = this.getActiveGames();
    const stats = this.getStats();
    
    return {
      timestamp: new Date().toISOString(),
      stats,
      activeGames: activeGames.length,
      queuedGames: this.gameQueue.length,
      gameDetails: activeGames.map(game => ({
        gameId: game.gameId,
        status: game.status,
        runtime: game.startTime ? Date.now() - game.startTime : 0,
        pid: game.pid,
        errorCount: game.errors.length
      })),
      resourceUsage: null // Will be filled by caller
    };
  }

  /**
   * Utility function to delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Format duration in milliseconds
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
   * Clean up resources
   */
  destroy(): void {
    console.log('🧹 Cleaning up MultipleGamesManager...');
    
    // Close all active games
    this.closeAllGames('graceful-then-force').catch(error => {
      console.error('Error during cleanup:', error);
    });
    
    // Clean up launcher
    this.launcher.destroy();
    
    // Clear data structures
    this.activeGames.clear();
    this.gameQueue.length = 0;
    
    // Remove all listeners
    this.removeAllListeners();
  }
}

/**
 * Resource Monitor
 * Monitors system resources
 */
class ResourceMonitor {
  async getCurrentUsage(): Promise<ResourceUsage> {
    // This is a simplified implementation
    // In a real application, you'd use libraries like 'systeminformation' or 'node-os-utils'
    
    const memoryUsage = process.memoryUsage();
    
    return {
      memoryUsage: memoryUsage.rss,
      cpuUsage: 0, // Would need proper CPU monitoring
      diskUsage: 0, // Would need proper disk monitoring
      networkUsage: 0 // Would need proper network monitoring
    };
  }
}

// Type definitions
interface MultiGameConfig {
  maxConcurrentGames: number;
  maxMemoryUsage: number;
  maxCpuUsage: number;
  gameTimeout: number;
  queueProcessingInterval: number;
  resourceCheckInterval: number;
  autoCleanup: boolean;
}

interface GameLaunchRequest {
  gameId?: string;
  executable: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  detached?: boolean;
  priority?: number;
  launchDelay?: number;
  stopOnError?: boolean;
}

interface GameInstance {
  gameId: string;
  request: GameLaunchRequest;
  startTime: number;
  endTime?: number;
  runtime?: number;
  status: GameStatus | 'launching';
  pid: number | null;
  exitCode?: number;
  memoryUsage: number;
  cpuUsage: number;
  errors: Error[];
  events: GameEvent[];
}

interface QueuedGame extends GameLaunchRequest {
  queuedAt: number;
  attempts: number;
}

interface LaunchResult {
  success: boolean;
  gameId: string | null;
  game: GameLaunchRequest | null;
  error: Error | null;
}

interface CloseResult {
  gameId: string;
  success: boolean;
  error: Error | null;
}

interface GlobalStats {
  totalLaunched: number;
  totalClosed: number;
  totalErrors: number;
  currentActive: number;
  peakConcurrent: number;
  totalPlaytime: number;
}

interface ResourceUsage {
  memoryUsage: number;
  cpuUsage: number;
  diskUsage: number;
  networkUsage: number;
}

interface GameEvent {
  type: string;
  timestamp: number;
  data: any;
}

interface MultiGameReport {
  timestamp: string;
  stats: GlobalStats;
  activeGames: number;
  queuedGames: number;
  gameDetails: Array<{
    gameId: string;
    status: GameStatus | 'launching';
    runtime: number;
    pid: number | null;
    errorCount: number;
  }>;
  resourceUsage: ResourceUsage | null;
}

type LaunchStrategy = 'parallel' | 'sequential' | 'staggered' | 'priority' | 'resource-aware';
type CloseStrategy = 'parallel' | 'sequential' | 'graceful-then-force';

/**
 * Example usage of Multiple Games Manager
 */
async function multipleGamesExample() {
  const gameManager = new MultipleGamesManager({
    maxConcurrentGames: 3,
    maxMemoryUsage: 4 * 1024 * 1024 * 1024, // 4GB
    maxCpuUsage: 70
  });
  
  try {
    // Set up event listeners
    gameManager.on('gameStarted', (event) => {
      console.log(`🎯 Custom Event: Game started - ${event.gameId}`);
    });
    
    gameManager.on('resourceWarning', (event) => {
      console.warn(`⚠️ Resource Warning: ${event.type} usage at ${event.usage}`);
    });
    
    gameManager.on('gameQueued', (event) => {
      console.log(`📋 Game queued: ${event.gameId}`);
    });
    
    // Define games to launch
    const games: GameLaunchRequest[] = [
      {
        gameId: 'game-1',
        executable: getTestExecutable(),
        priority: 10,
        args: []
      },
      {
        gameId: 'game-2',
        executable: getTestExecutable(),
        priority: 5,
        launchDelay: 2000
      },
      {
        gameId: 'game-3',
        executable: getTestExecutable(),
        priority: 8
      },
      {
        gameId: 'game-4',
        executable: getTestExecutable(),
        priority: 3
      }
    ];
    
    console.log('🚀 Starting multiple games example...');
    
    // Launch games using different strategies
    console.log('\n📦 Testing parallel launch:');
    const parallelResults = await gameManager.launchGames(games.slice(0, 2), 'parallel');
    console.log('Parallel results:', parallelResults.map(r => ({ gameId: r.gameId, success: r.success })));
    
    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('\n🎯 Testing priority launch:');
    const priorityResults = await gameManager.launchGames(games.slice(2), 'priority');
    console.log('Priority results:', priorityResults.map(r => ({ gameId: r.gameId, success: r.success })));
    
    // Monitor for a while
    console.log('\n📊 Monitoring games...');
    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const stats = gameManager.getStats();
      const activeGames = gameManager.getActiveGames();
      
      console.log(`   Active: ${stats.currentActive}, Total Launched: ${stats.totalLaunched}, Errors: ${stats.totalErrors}`);
      
      if (activeGames.length === 0) {
        console.log('   All games have closed');
        break;
      }
    }
    
    // Generate final report
    const report = gameManager.generateReport();
    console.log('\n📈 Final Report:');
    console.log(JSON.stringify(report, null, 2));
    
    // Close any remaining games
    const activeGames = gameManager.getActiveGames();
    if (activeGames.length > 0) {
      console.log('\n🔴 Closing remaining games...');
      const closeResults = await gameManager.closeAllGames();
      console.log('Close results:', closeResults.map(r => ({ gameId: r.gameId, success: r.success })));
    }
    
  } catch (error) {
    console.error('💥 Multiple games example failed:', error);
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
  multipleGamesExample()
    .then(() => {
      console.log('✨ Multiple games example completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Example failed:', error);
      process.exit(1);
    });
}

export { MultipleGamesManager, multipleGamesExample };
```

## Usage Examples

### Basic Multiple Games Launch

```typescript
import { MultipleGamesManager } from './multiple-games';

async function basicExample() {
  const manager = new MultipleGamesManager();
  
  const games = [
    { gameId: 'game1', executable: 'game1.exe' },
    { gameId: 'game2', executable: 'game2.exe' },
    { gameId: 'game3', executable: 'game3.exe' }
  ];
  
  // Launch all games in parallel
  const results = await manager.launchGames(games, 'parallel');
  
  console.log('Launch results:', results);
  
  manager.destroy();
}
```

### Resource-Aware Launch

```typescript
// Configure with resource limits
const manager = new MultipleGamesManager({
  maxConcurrentGames: 5,
  maxMemoryUsage: 8 * 1024 * 1024 * 1024, // 8GB
  maxCpuUsage: 80 // 80%
});

// Launch with resource awareness
const results = await manager.launchGames(games, 'resource-aware');
```

### Priority-Based Launch

```typescript
const games = [
  { gameId: 'critical-game', executable: 'game.exe', priority: 10 },
  { gameId: 'normal-game', executable: 'game2.exe', priority: 5 },
  { gameId: 'background-game', executable: 'game3.exe', priority: 1 }
];

// Higher priority games launch first
const results = await manager.launchGames(games, 'priority');
```

### Staggered Launch

```typescript
// Launch games with 5-second intervals
const results = await manager.launchGames(games, 'staggered');

// Custom staggered launch with specific interval
const staggeredManager = new MultipleGamesManager();
const results = await staggeredManager.launchStaggered(games, 3000); // 3 seconds
```

## Launch Strategies

### 1. Parallel Launch
- **Best for**: Independent games with sufficient resources
- **Pros**: Fastest overall launch time
- **Cons**: High resource usage spike

### 2. Sequential Launch
- **Best for**: Resource-constrained environments
- **Pros**: Predictable resource usage
- **Cons**: Slower overall launch time

### 3. Staggered Launch
- **Best for**: Avoiding system overload
- **Pros**: Balanced resource usage
- **Cons**: Moderate launch time

### 4. Priority Launch
- **Best for**: Mixed importance games
- **Pros**: Important games start first
- **Cons**: Lower priority games may be delayed

### 5. Resource-Aware Launch
- **Best for**: Dynamic resource management
- **Pros**: Optimal resource utilization
- **Cons**: Complex logic, variable timing

## Advanced Features

### Game Dependencies

```typescript
class DependencyManager extends MultipleGamesManager {
  private dependencies: Map<string, string[]> = new Map();
  
  addDependency(gameId: string, dependsOn: string[]): void {
    this.dependencies.set(gameId, dependsOn);
  }
  
  async launchWithDependencies(games: GameLaunchRequest[]): Promise<LaunchResult[]> {
    const results: LaunchResult[] = [];
    const launched = new Set<string>();
    
    // Topological sort for dependency order
    const sortedGames = this.topologicalSort(games);
    
    for (const game of sortedGames) {
      const deps = this.dependencies.get(game.gameId!) || [];
      
      // Wait for dependencies to be running
      await this.waitForDependencies(deps, launched);
      
      try {
        const gameId = await this.launchSingleGame(game);
        launched.add(game.gameId!);
        results.push({ success: true, gameId, game, error: null });
      } catch (error) {
        results.push({ success: false, gameId: null, game, error });
      }
    }
    
    return results;
  }
}
```

### Load Balancing

```typescript
class LoadBalancedManager extends MultipleGamesManager {
  private servers: string[] = ['server1', 'server2', 'server3'];
  private serverLoads: Map<string, number> = new Map();
  
  async launchWithLoadBalancing(games: GameLaunchRequest[]): Promise<LaunchResult[]> {
    const results: LaunchResult[] = [];
    
    for (const game of games) {
      // Find server with lowest load
      const server = this.getLeastLoadedServer();
      
      // Modify game to run on specific server
      const modifiedGame = {
        ...game,
        env: {
          ...game.env,
          TARGET_SERVER: server
        }
      };
      
      try {
        const gameId = await this.launchSingleGame(modifiedGame);
        this.updateServerLoad(server, 1);
        results.push({ success: true, gameId, game: modifiedGame, error: null });
      } catch (error) {
        results.push({ success: false, gameId: null, game: modifiedGame, error });
      }
    }
    
    return results;
  }
  
  private getLeastLoadedServer(): string {
    let minLoad = Infinity;
    let selectedServer = this.servers[0];
    
    for (const server of this.servers) {
      const load = this.serverLoads.get(server) || 0;
      if (load < minLoad) {
        minLoad = load;
        selectedServer = server;
      }
    }
    
    return selectedServer;
  }
}
```

### Game Coordination

```typescript
class CoordinatedManager extends MultipleGamesManager {
  async launchGameSession(sessionConfig: GameSessionConfig): Promise<string> {
    const sessionId = `session-${Date.now()}`;
    
    // Launch main game
    const mainGameId = await this.launchSingleGame(sessionConfig.mainGame);
    
    // Launch support games
    const supportResults = await Promise.all(
      sessionConfig.supportGames.map(game => 
        this.launchSingleGame({
          ...game,
          env: {
            ...game.env,
            SESSION_ID: sessionId,
            MAIN_GAME_ID: mainGameId
          }
        })
      )
    );
    
    // Set up coordination
    this.setupGameCoordination(sessionId, mainGameId, supportResults);
    
    return sessionId;
  }
  
  private setupGameCoordination(sessionId: string, mainGameId: string, supportGameIds: string[]): void {
    // Monitor main game
    this.launcher.on('closed', (event) => {
      if (event.gameId === mainGameId) {
        // Close all support games when main game closes
        console.log(`Main game ${mainGameId} closed, closing support games...`);
        this.closeGames(supportGameIds, 'graceful-then-force');
      }
    });
    
    // Monitor support games
    supportGameIds.forEach(supportGameId => {
      this.launcher.on('error', (event) => {
        if (event.gameId === supportGameId) {
          console.log(`Support game ${supportGameId} error, notifying main game...`);
          // Could send IPC message to main game
        }
      });
    });
  }
}

interface GameSessionConfig {
  mainGame: GameLaunchRequest;
  supportGames: GameLaunchRequest[];
}
```

## Monitoring and Analytics

### Real-time Dashboard

```typescript
class GameDashboard {
  private manager: MultipleGamesManager;
  private updateInterval: NodeJS.Timeout;
  
  constructor(manager: MultipleGamesManager) {
    this.manager = manager;
    this.startDashboard();
  }
  
  private startDashboard(): void {
    this.updateInterval = setInterval(() => {
      this.displayDashboard();
    }, 5000);
  }
  
  private displayDashboard(): void {
    console.clear();
    console.log('🎮 Game Launcher Dashboard');
    console.log('=' .repeat(50));
    
    const stats = this.manager.getStats();
    const activeGames = this.manager.getActiveGames();
    
    console.log(`📊 Statistics:`);
    console.log(`   Active Games: ${stats.currentActive}`);
    console.log(`   Total Launched: ${stats.totalLaunched}`);
    console.log(`   Total Closed: ${stats.totalClosed}`);
    console.log(`   Total Errors: ${stats.totalErrors}`);
    console.log(`   Peak Concurrent: ${stats.peakConcurrent}`);
    console.log(`   Total Playtime: ${this.formatDuration(stats.totalPlaytime)}`);
    
    console.log(`\n🎯 Active Games:`);
    if (activeGames.length === 0) {
      console.log('   No active games');
    } else {
      activeGames.forEach(game => {
        const runtime = Date.now() - game.startTime;
        console.log(`   ${game.gameId}: ${game.status} (${this.formatDuration(runtime)})`);
      });
    }
  }
  
  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }
  
  stop(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
  }
}
```

## Best Practices

### 1. Resource Management

```typescript
// Set appropriate limits
const manager = new MultipleGamesManager({
  maxConcurrentGames: Math.min(8, os.cpus().length),
  maxMemoryUsage: os.totalmem() * 0.8, // 80% of total RAM
  maxCpuUsage: 75
});
```

### 2. Error Handling

```typescript
// Implement comprehensive error handling
manager.on('gameError', (event) => {
  console.error(`Game error: ${event.gameId}`);
  
  // Log error details
  logError(event);
  
  // Attempt recovery if appropriate
  if (event.error.message.includes('crashed')) {
    attemptGameRestart(event.gameId);
  }
});
```

### 3. Graceful Shutdown

```typescript
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  
  try {
    await manager.closeAllGames('graceful-then-force');
    manager.destroy();
    process.exit(0);
  } catch (error) {
    console.error('Shutdown error:', error);
    process.exit(1);
  }
});
```

### 4. Performance Monitoring

```typescript
// Monitor performance metrics
manager.on('resourceUpdate', (usage) => {
  if (usage.memoryUsage > MEMORY_WARNING_THRESHOLD) {
    console.warn('High memory usage detected');
    // Consider closing non-essential games
  }
});
```

## Troubleshooting

### Common Issues

1. **Resource Exhaustion**
   - Lower `maxConcurrentGames`
   - Increase system resources
   - Use resource-aware launch strategy

2. **Games Not Launching**
   - Check executable paths
   - Verify permissions
   - Review resource limits

3. **Queue Not Processing**
   - Check `queueProcessingInterval`
   - Verify resource availability
   - Review error logs

4. **Memory Leaks**
   - Enable `autoCleanup`
   - Monitor event listeners
   - Check for circular references

## Next Steps

After mastering multiple games management:

1. **[Game Library Manager](game-library-manager.md)** - Complete game library
2. **[Playtime Tracker](playtime-tracker.md)** - Session tracking
3. **[Best Practices](../guides/best-practices.md)** - Production patterns

---

**Manage your game empire! 🎮👑**
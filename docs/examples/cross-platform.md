# Cross-Platform Compatibility

This example demonstrates how to build cross-platform game launchers that work seamlessly across Windows, macOS, and Linux using the Game Launcher library.

## Overview

The Cross-Platform Compatibility example covers:
- Platform detection and adaptation
- Path handling across different file systems
- Platform-specific executable formats
- Environment variable management
- Process management differences
- Configuration abstraction
- Testing across platforms

## Prerequisites

- Node.js 16.0.0 or higher
- Game Launcher library installed
- Understanding of platform differences
- Test environments for multiple platforms (optional)

## Code

### Complete Cross-Platform Game Launcher

```typescript
import { GameLauncher, Platform } from '@team-falkor/game-launcher';
import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

/**
 * Cross-Platform Game Launcher
 * Handles platform-specific differences transparently
 */
class CrossPlatformGameLauncher extends EventEmitter {
  private launcher: GameLauncher;
  private platform: Platform;
  private platformConfig: PlatformConfig;
  private gameRegistry: Map<string, CrossPlatformGame> = new Map();

  constructor(config: CrossPlatformConfig = {}) {
    super();
    
    this.platform = this.detectPlatform();
    this.platformConfig = this.initializePlatformConfig(config);
    
    this.launcher = new GameLauncher({
      verbose: config.verbose || false
    });
    
    this.setupEventHandlers();
    
    console.log(`🖥️ Cross-platform launcher initialized for ${this.platform}`);
  }

  /**
   * Detect the current platform
   */
  private detectPlatform(): Platform {
    const platform = os.platform();
    
    switch (platform) {
      case 'win32':
        return 'windows';
      case 'darwin':
        return 'macos';
      case 'linux':
        return 'linux';
      default:
        console.warn(`⚠️ Unsupported platform: ${platform}, defaulting to linux`);
        return 'linux';
    }
  }

  /**
   * Initialize platform-specific configuration
   */
  private initializePlatformConfig(config: CrossPlatformConfig): PlatformConfig {
    const baseConfig: PlatformConfig = {
      executableExtensions: this.getExecutableExtensions(),
      pathSeparator: path.sep,
      envPathSeparator: this.getEnvPathSeparator(),
      defaultGameDirectories: this.getDefaultGameDirectories(),
      systemRequirements: this.getSystemRequirements(),
      processManager: this.getProcessManagerConfig(),
      fileSystem: this.getFileSystemConfig()
    };
    
    // Merge with user config
    return {
      ...baseConfig,
      ...config.platformOverrides?.[this.platform]
    };
  }

  /**
   * Get executable extensions for current platform
   */
  private getExecutableExtensions(): string[] {
    switch (this.platform) {
      case 'windows':
        return ['.exe', '.bat', '.cmd', '.msi'];
      case 'macos':
        return ['.app', '.command', '.tool'];
      case 'linux':
        return ['', '.sh', '.run', '.AppImage'];
      default:
        return [''];
    }
  }

  /**
   * Get environment PATH separator
   */
  private getEnvPathSeparator(): string {
    return this.platform === 'windows' ? ';' : ':';
  }

  /**
   * Get default game directories for current platform
   */
  private getDefaultGameDirectories(): string[] {
    switch (this.platform) {
      case 'windows':
        return [
          'C:\\Program Files\\Steam\\steamapps\\common',
          'C:\\Program Files (x86)\\Steam\\steamapps\\common',
          'C:\\Program Files\\Epic Games',
          'C:\\Program Files (x86)\\Epic Games',
          'C:\\GOG Games',
          'C:\\Games',
          path.join(os.homedir(), 'AppData', 'Local', 'Programs')
        ];
      
      case 'macos':
        return [
          '/Applications',
          path.join(os.homedir(), 'Applications'),
          path.join(os.homedir(), 'Library', 'Application Support', 'Steam', 'steamapps', 'common'),
          path.join(os.homedir(), 'Games'),
          '/usr/local/games'
        ];
      
      case 'linux':
        return [
          path.join(os.homedir(), '.steam', 'steam', 'steamapps', 'common'),
          path.join(os.homedir(), '.local', 'share', 'Steam', 'steamapps', 'common'),
          path.join(os.homedir(), 'Games'),
          '/usr/games',
          '/usr/local/games',
          '/opt/games',
          '/snap/bin'
        ];
      
      default:
        return [];
    }
  }

  /**
   * Get system requirements for current platform
   */
  private getSystemRequirements(): SystemRequirements {
    const totalMemory = os.totalmem();
    const cpuCount = os.cpus().length;
    
    return {
      minMemory: Math.max(2 * 1024 * 1024 * 1024, totalMemory * 0.1), // 2GB or 10% of total
      recommendedMemory: Math.max(4 * 1024 * 1024 * 1024, totalMemory * 0.25), // 4GB or 25% of total
      minCpuCores: Math.max(2, Math.floor(cpuCount * 0.5)),
      recommendedCpuCores: cpuCount,
      platform: this.platform,
      architecture: os.arch(),
      nodeVersion: process.version
    };
  }

  /**
   * Get process manager configuration
   */
  private getProcessManagerConfig(): ProcessManagerConfig {
    switch (this.platform) {
      case 'windows':
        return {
          killSignal: 'SIGTERM',
          forceKillSignal: 'SIGKILL',
          killTimeout: 5000,
          useTaskkill: true,
          detached: false
        };
      
      case 'macos':
      case 'linux':
        return {
          killSignal: 'SIGTERM',
          forceKillSignal: 'SIGKILL',
          killTimeout: 5000,
          useTaskkill: false,
          detached: true
        };
      
      default:
        return {
          killSignal: 'SIGTERM',
          forceKillSignal: 'SIGKILL',
          killTimeout: 5000,
          useTaskkill: false,
          detached: true
        };
    }
  }

  /**
   * Get file system configuration
   */
  private getFileSystemConfig(): FileSystemConfig {
    return {
      caseSensitive: this.platform !== 'windows',
      maxPathLength: this.platform === 'windows' ? 260 : 4096,
      reservedNames: this.platform === 'windows' ? 
        ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'] : 
        [],
      invalidChars: this.platform === 'windows' ? 
        ['<', '>', ':', '"', '|', '?', '*'] : 
        ['\0'],
      pathSeparator: path.sep
    };
  }

  /**
   * Register a cross-platform game
   */
  registerGame(game: CrossPlatformGameDefinition): string {
    const gameId = this.generateGameId(game.name);
    
    const crossPlatformGame: CrossPlatformGame = {
      id: gameId,
      name: game.name,
      platforms: new Map(),
      defaultPlatform: game.defaultPlatform || this.platform,
      metadata: game.metadata || {},
      requirements: game.requirements || {}
    };
    
    // Register platform-specific configurations
    for (const [platform, config] of Object.entries(game.platforms)) {
      crossPlatformGame.platforms.set(platform as Platform, {
        executable: this.normalizePath(config.executable),
        args: config.args || [],
        cwd: config.cwd ? this.normalizePath(config.cwd) : undefined,
        env: config.env || {},
        requirements: config.requirements || {}
      });
    }
    
    this.gameRegistry.set(gameId, crossPlatformGame);
    
    console.log(`🎮 Registered cross-platform game: ${game.name} (${gameId})`);
    this.emit('gameRegistered', { gameId, game: crossPlatformGame });
    
    return gameId;
  }

  /**
   * Launch a game with platform-specific handling
   */
  async launchGame(gameId: string, options: CrossPlatformLaunchOptions = {}): Promise<string> {
    const game = this.gameRegistry.get(gameId);
    if (!game) {
      throw new Error(`Game not found: ${gameId}`);
    }
    
    const targetPlatform = options.platform || this.platform;
    const platformConfig = game.platforms.get(targetPlatform);
    
    if (!platformConfig) {
      throw new Error(`Game ${game.name} is not available on ${targetPlatform}`);
    }
    
    console.log(`🚀 Launching ${game.name} on ${targetPlatform}...`);
    
    try {
      // Check system requirements
      await this.checkSystemRequirements(game, platformConfig);
      
      // Prepare launch environment
      const launchEnv = await this.prepareLaunchEnvironment(platformConfig, options);
      
      // Resolve executable path
      const executablePath = await this.resolveExecutablePath(platformConfig.executable);
      
      // Prepare arguments
      const args = this.prepareArguments(platformConfig.args, options.args);
      
      // Launch the game
      const launchedGameId = await this.launcher.launchGame({
        gameId,
        executable: executablePath,
        args,
        cwd: platformConfig.cwd,
        env: launchEnv
      });
      
      console.log(`✅ Game launched: ${game.name} (${launchedGameId})`);
      this.emit('gameLaunched', {
        gameId,
        launchedGameId,
        platform: targetPlatform,
        game
      });
      
      return launchedGameId;
      
    } catch (error) {
      console.error(`❌ Failed to launch ${game.name}:`, error);
      this.emit('launchError', {
        gameId,
        game,
        platform: targetPlatform,
        error
      });
      throw error;
    }
  }

  /**
   * Check system requirements
   */
  private async checkSystemRequirements(
    game: CrossPlatformGame,
    platformConfig: PlatformGameConfig
  ): Promise<void> {
    const requirements = {
      ...game.requirements,
      ...platformConfig.requirements
    };
    
    const systemInfo = this.getSystemInfo();
    
    // Check memory
    if (requirements.minMemory && systemInfo.totalMemory < requirements.minMemory) {
      throw new Error(
        `Insufficient memory: ${this.formatBytes(systemInfo.totalMemory)} available, ` +
        `${this.formatBytes(requirements.minMemory)} required`
      );
    }
    
    // Check CPU cores
    if (requirements.minCpuCores && systemInfo.cpuCores < requirements.minCpuCores) {
      throw new Error(
        `Insufficient CPU cores: ${systemInfo.cpuCores} available, ` +
        `${requirements.minCpuCores} required`
      );
    }
    
    // Check platform
    if (requirements.platform && requirements.platform !== this.platform) {
      throw new Error(
        `Platform mismatch: running on ${this.platform}, ` +
        `requires ${requirements.platform}`
      );
    }
    
    // Check architecture
    if (requirements.architecture && requirements.architecture !== systemInfo.architecture) {
      throw new Error(
        `Architecture mismatch: running on ${systemInfo.architecture}, ` +
        `requires ${requirements.architecture}`
      );
    }
    
    console.log(`✅ System requirements check passed for ${game.name}`);
  }

  /**
   * Prepare launch environment
   */
  private async prepareLaunchEnvironment(
    platformConfig: PlatformGameConfig,
    options: CrossPlatformLaunchOptions
  ): Promise<Record<string, string>> {
    const env = {
      ...process.env,
      ...platformConfig.env,
      ...options.env
    };
    
    // Platform-specific environment setup
    switch (this.platform) {
      case 'windows':
        // Ensure proper PATH handling on Windows
        if (env.PATH) {
          env.PATH = this.normalizeWindowsPath(env.PATH);
        }
        break;
      
      case 'macos':
        // Set up macOS-specific environment
        env.DYLD_LIBRARY_PATH = env.DYLD_LIBRARY_PATH || '';
        break;
      
      case 'linux':
        // Set up Linux-specific environment
        env.LD_LIBRARY_PATH = env.LD_LIBRARY_PATH || '';
        env.DISPLAY = env.DISPLAY || ':0';
        break;
    }
    
    return env;
  }

  /**
   * Resolve executable path with platform-specific logic
   */
  private async resolveExecutablePath(executablePath: string): Promise<string> {
    let resolvedPath = this.normalizePath(executablePath);
    
    // Handle relative paths
    if (!path.isAbsolute(resolvedPath)) {
      // Try to find in default game directories
      for (const gameDir of this.platformConfig.defaultGameDirectories) {
        const fullPath = path.join(gameDir, resolvedPath);
        if (await this.fileExists(fullPath)) {
          resolvedPath = fullPath;
          break;
        }
      }
    }
    
    // Platform-specific executable resolution
    switch (this.platform) {
      case 'windows':
        resolvedPath = await this.resolveWindowsExecutable(resolvedPath);
        break;
      
      case 'macos':
        resolvedPath = await this.resolveMacOSExecutable(resolvedPath);
        break;
      
      case 'linux':
        resolvedPath = await this.resolveLinuxExecutable(resolvedPath);
        break;
    }
    
    // Verify executable exists and is executable
    await this.verifyExecutable(resolvedPath);
    
    return resolvedPath;
  }

  /**
   * Resolve Windows executable
   */
  private async resolveWindowsExecutable(executablePath: string): Promise<string> {
    // If no extension, try common Windows executable extensions
    if (!path.extname(executablePath)) {
      for (const ext of ['.exe', '.bat', '.cmd']) {
        const pathWithExt = executablePath + ext;
        if (await this.fileExists(pathWithExt)) {
          return pathWithExt;
        }
      }
    }
    
    return executablePath;
  }

  /**
   * Resolve macOS executable
   */
  private async resolveMacOSExecutable(executablePath: string): Promise<string> {
    // Handle .app bundles
    if (executablePath.endsWith('.app')) {
      const infoPlistPath = path.join(executablePath, 'Contents', 'Info.plist');
      if (await this.fileExists(infoPlistPath)) {
        // Try to read the actual executable from Info.plist
        // For simplicity, we'll use a common pattern
        const executableName = path.basename(executablePath, '.app');
        const macOSExecutable = path.join(
          executablePath,
          'Contents',
          'MacOS',
          executableName
        );
        
        if (await this.fileExists(macOSExecutable)) {
          return macOSExecutable;
        }
      }
    }
    
    return executablePath;
  }

  /**
   * Resolve Linux executable
   */
  private async resolveLinuxExecutable(executablePath: string): Promise<string> {
    // Handle AppImage files
    if (executablePath.endsWith('.AppImage')) {
      // Make sure it's executable
      try {
        await fs.chmod(executablePath, 0o755);
      } catch (error) {
        console.warn(`Failed to make AppImage executable: ${error.message}`);
      }
    }
    
    return executablePath;
  }

  /**
   * Verify executable exists and is executable
   */
  private async verifyExecutable(executablePath: string): Promise<void> {
    try {
      const stats = await fs.stat(executablePath);
      
      if (!stats.isFile()) {
        throw new Error(`Not a file: ${executablePath}`);
      }
      
      // Check if executable (Unix-like systems)
      if (this.platform !== 'windows') {
        try {
          await fs.access(executablePath, fs.constants.X_OK);
        } catch (error) {
          throw new Error(`File is not executable: ${executablePath}`);
        }
      }
      
    } catch (error) {
      throw new Error(`Executable verification failed: ${error.message}`);
    }
  }

  /**
   * Prepare arguments with platform-specific handling
   */
  private prepareArguments(
    baseArgs: string[] = [],
    additionalArgs: string[] = []
  ): string[] {
    const args = [...baseArgs, ...additionalArgs];
    
    // Platform-specific argument processing
    switch (this.platform) {
      case 'windows':
        // Handle Windows-specific argument escaping
        return args.map(arg => this.escapeWindowsArgument(arg));
      
      case 'macos':
      case 'linux':
        // Handle Unix-like argument escaping
        return args.map(arg => this.escapeUnixArgument(arg));
      
      default:
        return args;
    }
  }

  /**
   * Escape Windows command line arguments
   */
  private escapeWindowsArgument(arg: string): string {
    // If argument contains spaces or special characters, quote it
    if (/[\s"&<>|^]/.test(arg)) {
      return `"${arg.replace(/"/g, '\\"')}"`;
    }
    return arg;
  }

  /**
   * Escape Unix command line arguments
   */
  private escapeUnixArgument(arg: string): string {
    // If argument contains spaces or special characters, quote it
    if (/[\s"'&<>|;$`\\*?\[\]{}()]/.test(arg)) {
      return `'${arg.replace(/'/g, "'\\''")}''`;
    }
    return arg;
  }

  /**
   * Normalize file paths for current platform
   */
  private normalizePath(filePath: string): string {
    // Convert path separators to platform-specific ones
    let normalized = filePath.replace(/[\/\\]/g, path.sep);
    
    // Handle platform-specific path normalization
    switch (this.platform) {
      case 'windows':
        // Handle Windows drive letters and UNC paths
        normalized = path.resolve(normalized);
        break;
      
      case 'macos':
      case 'linux':
        // Handle Unix-like paths
        if (normalized.startsWith('~')) {
          normalized = path.join(os.homedir(), normalized.slice(1));
        }
        normalized = path.resolve(normalized);
        break;
    }
    
    return normalized;
  }

  /**
   * Normalize Windows PATH environment variable
   */
  private normalizeWindowsPath(pathEnv: string): string {
    return pathEnv
      .split(';')
      .map(p => p.trim())
      .filter(p => p.length > 0)
      .join(';');
  }

  /**
   * Check if file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get system information
   */
  private getSystemInfo(): SystemInfo {
    return {
      platform: this.platform,
      architecture: os.arch(),
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      cpuCores: os.cpus().length,
      nodeVersion: process.version,
      osVersion: os.release()
    };
  }

  /**
   * Format bytes to human readable format
   */
  private formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  /**
   * Generate unique game ID
   */
  private generateGameId(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '-');
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    this.launcher.on('launched', (event) => {
      this.emit('launched', event);
    });
    
    this.launcher.on('closed', (event) => {
      this.emit('closed', event);
    });
    
    this.launcher.on('error', (event) => {
      this.emit('error', event);
    });
    
    this.launcher.on('output', (event) => {
      this.emit('output', event);
    });
  }

  /**
   * Get all registered games
   */
  getRegisteredGames(): CrossPlatformGame[] {
    return Array.from(this.gameRegistry.values());
  }

  /**
   * Get games available on current platform
   */
  getAvailableGames(): CrossPlatformGame[] {
    return this.getRegisteredGames().filter(game => 
      game.platforms.has(this.platform)
    );
  }

  /**
   * Get platform information
   */
  getPlatformInfo(): PlatformInfo {
    return {
      current: this.platform,
      config: this.platformConfig,
      systemInfo: this.getSystemInfo(),
      supportedPlatforms: ['windows', 'macos', 'linux'] as Platform[]
    };
  }

  /**
   * Clean up resources
   */
  async destroy(): Promise<void> {
    console.log('🧹 Cleaning up cross-platform launcher...');
    
    this.launcher.destroy();
    this.removeAllListeners();
    
    console.log('✅ Cross-platform launcher cleaned up');
  }
}

// Type definitions
interface CrossPlatformConfig {
  verbose?: boolean;
  platformOverrides?: Partial<Record<Platform, Partial<PlatformConfig>>>;
}

interface PlatformConfig {
  executableExtensions: string[];
  pathSeparator: string;
  envPathSeparator: string;
  defaultGameDirectories: string[];
  systemRequirements: SystemRequirements;
  processManager: ProcessManagerConfig;
  fileSystem: FileSystemConfig;
}

interface SystemRequirements {
  minMemory: number;
  recommendedMemory: number;
  minCpuCores: number;
  recommendedCpuCores: number;
  platform: Platform;
  architecture: string;
  nodeVersion: string;
}

interface ProcessManagerConfig {
  killSignal: string;
  forceKillSignal: string;
  killTimeout: number;
  useTaskkill: boolean;
  detached: boolean;
}

interface FileSystemConfig {
  caseSensitive: boolean;
  maxPathLength: number;
  reservedNames: string[];
  invalidChars: string[];
  pathSeparator: string;
}

interface CrossPlatformGameDefinition {
  name: string;
  platforms: Record<string, PlatformGameDefinition>;
  defaultPlatform?: Platform;
  metadata?: Record<string, any>;
  requirements?: Partial<SystemRequirements>;
}

interface PlatformGameDefinition {
  executable: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  requirements?: Partial<SystemRequirements>;
}

interface CrossPlatformGame {
  id: string;
  name: string;
  platforms: Map<Platform, PlatformGameConfig>;
  defaultPlatform: Platform;
  metadata: Record<string, any>;
  requirements: Partial<SystemRequirements>;
}

interface PlatformGameConfig {
  executable: string;
  args: string[];
  cwd?: string;
  env: Record<string, string>;
  requirements: Partial<SystemRequirements>;
}

interface CrossPlatformLaunchOptions {
  platform?: Platform;
  args?: string[];
  env?: Record<string, string>;
}

interface SystemInfo {
  platform: Platform;
  architecture: string;
  totalMemory: number;
  freeMemory: number;
  cpuCores: number;
  nodeVersion: string;
  osVersion: string;
}

interface PlatformInfo {
  current: Platform;
  config: PlatformConfig;
  systemInfo: SystemInfo;
  supportedPlatforms: Platform[];
}

/**
 * Example usage of Cross-Platform Game Launcher
 */
async function crossPlatformExample() {
  const launcher = new CrossPlatformGameLauncher({
    verbose: true
  });
  
  try {
    console.log('🚀 Starting cross-platform example...');
    
    // Get platform information
    const platformInfo = launcher.getPlatformInfo();
    console.log(`\n🖥️ Platform Information:`);
    console.log(`   Current platform: ${platformInfo.current}`);
    console.log(`   Architecture: ${platformInfo.systemInfo.architecture}`);
    console.log(`   Total memory: ${launcher.formatBytes(platformInfo.systemInfo.totalMemory)}`);
    console.log(`   CPU cores: ${platformInfo.systemInfo.cpuCores}`);
    
    // Register a cross-platform game
    const gameId = launcher.registerGame({
      name: 'Example Game',
      platforms: {
        windows: {
          executable: 'C:\\Games\\ExampleGame\\game.exe',
          args: ['--windowed'],
          env: { GAME_MODE: 'windows' }
        },
        macos: {
          executable: '/Applications/ExampleGame.app',
          args: ['--windowed'],
          env: { GAME_MODE: 'macos' }
        },
        linux: {
          executable: '/usr/games/example-game',
          args: ['--windowed'],
          env: { GAME_MODE: 'linux' }
        }
      },
      requirements: {
        minMemory: 2 * 1024 * 1024 * 1024, // 2GB
        minCpuCores: 2
      }
    });
    
    console.log(`\n🎮 Registered game: ${gameId}`);
    
    // Register a platform-specific game
    const platformSpecificId = launcher.registerGame({
      name: 'Platform Specific Game',
      platforms: {
        [platformInfo.current]: {
          executable: platformInfo.current === 'windows' ? 
            'notepad.exe' : 
            platformInfo.current === 'macos' ? 
              '/System/Applications/TextEdit.app' : 
              '/usr/bin/gedit',
          args: []
        }
      }
    });
    
    console.log(`\n🎯 Registered platform-specific game: ${platformSpecificId}`);
    
    // List available games
    const availableGames = launcher.getAvailableGames();
    console.log(`\n📚 Available games on ${platformInfo.current}:`);
    availableGames.forEach(game => {
      const platformConfig = game.platforms.get(platformInfo.current);
      console.log(`   ${game.name}: ${platformConfig?.executable}`);
    });
    
    // Set up event listeners
    launcher.on('gameLaunched', (event) => {
      console.log(`🚀 Game launched: ${event.game.name} on ${event.platform}`);
    });
    
    launcher.on('launchError', (event) => {
      console.error(`❌ Launch failed: ${event.game.name} - ${event.error.message}`);
    });
    
    launcher.on('closed', (event) => {
      console.log(`🔴 Game closed: ${event.gameId}`);
    });
    
    // Try to launch the platform-specific game
    if (availableGames.length > 0) {
      const gameToLaunch = availableGames.find(g => g.id === platformSpecificId);
      if (gameToLaunch) {
        console.log(`\n🚀 Launching ${gameToLaunch.name}...`);
        
        try {
          const launchedGameId = await launcher.launchGame(gameToLaunch.id);
          console.log(`✅ Game launched successfully: ${launchedGameId}`);
          
          // Close after a few seconds
          setTimeout(async () => {
            try {
              await launcher.launcher.closeGame(launchedGameId);
              console.log('🔴 Game closed');
            } catch (error) {
              console.warn('Failed to close game:', error.message);
            }
          }, 3000);
          
        } catch (error) {
          console.warn(`Failed to launch ${gameToLaunch.name}:`, error.message);
        }
      }
    }
    
    // Demonstrate cross-platform path handling
    console.log('\n🛤️ Path Handling Examples:');
    const testPaths = [
      'C:\\Games\\MyGame\\game.exe',
      '/Applications/MyGame.app',
      '~/Games/my-game',
      './relative/path/game'
    ];
    
    testPaths.forEach(testPath => {
      const normalized = launcher.normalizePath(testPath);
      console.log(`   ${testPath} -> ${normalized}`);
    });
    
  } catch (error) {
    console.error('💥 Cross-platform example failed:', error);
  } finally {
    // Clean up after a delay
    setTimeout(async () => {
      await launcher.destroy();
    }, 5000);
  }
}

// Run the example
if (require.main === module) {
  crossPlatformExample()
    .then(() => {
      console.log('✨ Cross-platform example completed!');
    })
    .catch((error) => {
      console.error('💥 Example failed:', error);
      process.exit(1);
    });
}

export { CrossPlatformGameLauncher, crossPlatformExample };
```

## Usage Examples

### Basic Cross-Platform Setup

```typescript
import { CrossPlatformGameLauncher } from './cross-platform-launcher';

const launcher = new CrossPlatformGameLauncher({
  verbose: true
});

// Register a game for all platforms
const gameId = launcher.registerGame({
  name: 'My Game',
  platforms: {
    windows: {
      executable: 'C:\\Games\\MyGame\\game.exe'
    },
    macos: {
      executable: '/Applications/MyGame.app'
    },
    linux: {
      executable: '/usr/games/my-game'
    }
  }
});

// Launch on current platform
const launchedId = await launcher.launchGame(gameId);
```

### Platform-Specific Configuration

```typescript
// Different configurations per platform
const gameId = launcher.registerGame({
  name: 'Advanced Game',
  platforms: {
    windows: {
      executable: 'game.exe',
      args: ['--dx11', '--windowed'],
      env: { GRAPHICS_API: 'DirectX' }
    },
    macos: {
      executable: 'Game.app',
      args: ['--metal', '--windowed'],
      env: { GRAPHICS_API: 'Metal' }
    },
    linux: {
      executable: 'game',
      args: ['--vulkan', '--windowed'],
      env: { GRAPHICS_API: 'Vulkan' }
    }
  },
  requirements: {
    minMemory: 4 * 1024 * 1024 * 1024, // 4GB
    minCpuCores: 4
  }
});
```

### Platform Detection and Adaptation

```typescript
// Get platform information
const platformInfo = launcher.getPlatformInfo();

if (platformInfo.current === 'windows') {
  // Windows-specific logic
  console.log('Running on Windows');
} else if (platformInfo.current === 'macos') {
  // macOS-specific logic
  console.log('Running on macOS');
} else if (platformInfo.current === 'linux') {
  // Linux-specific logic
  console.log('Running on Linux');
}

// Get available games for current platform
const availableGames = launcher.getAvailableGames();
console.log(`${availableGames.length} games available on ${platformInfo.current}`);
```

### System Requirements Checking

```typescript
// Register game with specific requirements
const gameId = launcher.registerGame({
  name: 'High-End Game',
  platforms: {
    windows: {
      executable: 'high-end-game.exe',
      requirements: {
        minMemory: 8 * 1024 * 1024 * 1024, // 8GB
        minCpuCores: 6,
        architecture: 'x64'
      }
    }
  }
});

// Launch will automatically check requirements
try {
  await launcher.launchGame(gameId);
} catch (error) {
  if (error.message.includes('Insufficient')) {
    console.log('System does not meet requirements');
  }
}
```

## Features

### 1. Platform Detection
- **Automatic Detection**: Detects Windows, macOS, and Linux
- **Platform-Specific Config**: Different settings per platform
- **Graceful Fallbacks**: Handles unsupported platforms
- **Runtime Adaptation**: Adapts behavior based on platform

### 2. Path Handling
- **Path Normalization**: Converts paths to platform format
- **Separator Handling**: Uses correct path separators
- **Home Directory**: Expands ~ on Unix-like systems
- **Relative Paths**: Resolves relative to game directories

### 3. Executable Resolution
- **Extension Handling**: Adds appropriate extensions
- **Bundle Support**: Handles .app bundles on macOS
- **AppImage Support**: Handles AppImage files on Linux
- **Permission Checking**: Verifies executable permissions

### 4. Environment Management
- **Platform Variables**: Sets platform-specific env vars
- **Path Variables**: Handles PATH differences
- **Library Paths**: Sets LD_LIBRARY_PATH, DYLD_LIBRARY_PATH
- **Display Variables**: Sets DISPLAY on Linux

### 5. System Requirements
- **Memory Checking**: Verifies available memory
- **CPU Checking**: Checks CPU core count
- **Architecture**: Validates system architecture
- **Platform Validation**: Ensures platform compatibility

## Advanced Usage

### Custom Platform Configuration

```typescript
class CustomCrossPlatformLauncher extends CrossPlatformGameLauncher {
  constructor() {
    super({
      platformOverrides: {
        windows: {
          defaultGameDirectories: [
            'D:\\Games',
            'E:\\Steam\\steamapps\\common'
          ]
        },
        linux: {
          defaultGameDirectories: [
            '/opt/games',
            '/home/user/Games'
          ]
        }
      }
    });
  }
  
  // Override executable resolution for custom logic
  protected async resolveExecutablePath(executablePath: string): Promise<string> {
    // Custom resolution logic
    return super.resolveExecutablePath(executablePath);
  }
}
```

### Steam Integration

```typescript
class SteamCrossPlatformLauncher extends CrossPlatformGameLauncher {
  private steamPaths: Map<Platform, string> = new Map([
    ['windows', 'C:\\Program Files (x86)\\Steam\\steam.exe'],
    ['macos', '/Applications/Steam.app/Contents/MacOS/steam_osx'],
    ['linux', '/usr/bin/steam']
  ]);
  
  async launchSteamGame(appId: string): Promise<string> {
    const steamPath = this.steamPaths.get(this.platform);
    if (!steamPath) {
      throw new Error(`Steam not supported on ${this.platform}`);
    }
    
    return this.launcher.launchGame({
      gameId: `steam-${appId}`,
      executable: steamPath,
      args: ['-applaunch', appId]
    });
  }
}
```

### Wine Integration (Linux)

```typescript
class WineCrossPlatformLauncher extends CrossPlatformGameLauncher {
  async launchWindowsGameOnLinux(
    gameId: string,
    windowsExecutable: string
  ): Promise<string> {
    if (this.platform !== 'linux') {
      throw new Error('Wine only available on Linux');
    }
    
    // Check if Wine is available
    const wineExists = await this.fileExists('/usr/bin/wine');
    if (!wineExists) {
      throw new Error('Wine not installed');
    }
    
    return this.launcher.launchGame({
      gameId,
      executable: '/usr/bin/wine',
      args: [windowsExecutable],
      env: {
        WINEPREFIX: '/home/user/.wine',
        WINEDEBUG: '-all'
      }
    });
  }
}
```

### Container Support

```typescript
class ContainerCrossPlatformLauncher extends CrossPlatformGameLauncher {
  async launchInContainer(
    gameId: string,
    containerImage: string,
    gameExecutable: string
  ): Promise<string> {
    const containerRuntime = await this.detectContainerRuntime();
    
    return this.launcher.launchGame({
      gameId,
      executable: containerRuntime,
      args: [
        'run',
        '--rm',
        '-it',
        '--volume', '/tmp/.X11-unix:/tmp/.X11-unix',
        '--env', 'DISPLAY',
        containerImage,
        gameExecutable
      ]
    });
  }
  
  private async detectContainerRuntime(): Promise<string> {
    const runtimes = ['docker', 'podman', 'containerd'];
    
    for (const runtime of runtimes) {
      if (await this.commandExists(runtime)) {
        return runtime;
      }
    }
    
    throw new Error('No container runtime found');
  }
}
```

## Platform-Specific Considerations

### Windows

```typescript
// Windows-specific features
const windowsLauncher = new CrossPlatformGameLauncher();

// Handle Windows registry
class WindowsRegistryHelper {
  static async getGameInstallPath(gameKey: string): Promise<string | null> {
    // Read from Windows registry
    // Implementation would use node-winreg or similar
    return null;
  }
}

// Handle Windows services
class WindowsServiceManager {
  static async startService(serviceName: string): Promise<void> {
    // Start Windows service if needed
  }
}
```

### macOS

```typescript
// macOS-specific features
class MacOSHelper {
  static async getApplicationInfo(appPath: string): Promise<any> {
    // Read Info.plist from .app bundle
    const plistPath = path.join(appPath, 'Contents', 'Info.plist');
    // Parse plist file
    return {};
  }
  
  static async requestPermissions(): Promise<void> {
    // Request necessary permissions on macOS
    // (Accessibility, Screen Recording, etc.)
  }
}
```

### Linux

```typescript
// Linux-specific features
class LinuxHelper {
  static async getDesktopEntry(appName: string): Promise<string | null> {
    // Look for .desktop files
    const desktopDirs = [
      '/usr/share/applications',
      '/usr/local/share/applications',
      path.join(os.homedir(), '.local/share/applications')
    ];
    
    for (const dir of desktopDirs) {
      const desktopFile = path.join(dir, `${appName}.desktop`);
      if (await this.fileExists(desktopFile)) {
        return desktopFile;
      }
    }
    
    return null;
  }
  
  static async checkDisplayServer(): Promise<'x11' | 'wayland' | 'unknown'> {
    if (process.env.WAYLAND_DISPLAY) {
      return 'wayland';
    } else if (process.env.DISPLAY) {
      return 'x11';
    }
    return 'unknown';
  }
}
```

## Configuration Examples

### Development Configuration

```typescript
const devLauncher = new CrossPlatformGameLauncher({
  verbose: true,
  platformOverrides: {
    windows: {
      defaultGameDirectories: [
        'C:\\Dev\\Games',
        'D:\\GameDev\\Builds'
      ]
    },
    macos: {
      defaultGameDirectories: [
        '/Users/dev/Games',
        '/Applications/GameDev'
      ]
    },
    linux: {
      defaultGameDirectories: [
        '/home/dev/Games',
        '/opt/gamedev'
      ]
    }
  }
});
```

### Production Configuration

```typescript
const prodLauncher = new CrossPlatformGameLauncher({
  verbose: false,
  platformOverrides: {
    windows: {
      processManager: {
        killTimeout: 10000,
        useTaskkill: true
      }
    },
    linux: {
      processManager: {
        killTimeout: 15000,
        detached: true
      }
    }
  }
});
```

## Best Practices

### 1. Path Handling

```typescript
// Always use path.join() for cross-platform paths
const gamePath = path.join('Games', 'MyGame', 'game.exe');

// Use platform-specific defaults
const getDefaultGameDir = (platform: Platform): string => {
  switch (platform) {
    case 'windows': return 'C:\\Games';
    case 'macos': return '/Applications';
    case 'linux': return '/usr/games';
  }
};
```

### 2. Error Handling

```typescript
// Handle platform-specific errors
try {
  await launcher.launchGame(gameId);
} catch (error) {
  if (error.message.includes('ENOENT')) {
    console.error('Game executable not found');
  } else if (error.message.includes('EACCES')) {
    console.error('Permission denied');
  } else {
    console.error('Unknown error:', error);
  }
}
```

### 3. Testing

```typescript
// Test on multiple platforms
const testPlatforms: Platform[] = ['windows', 'macos', 'linux'];

for (const platform of testPlatforms) {
  if (platform === currentPlatform) {
    // Run actual tests
    await testGameLaunch(gameId);
  } else {
    // Mock tests for other platforms
    await mockTestGameLaunch(gameId, platform);
  }
}
```

### 4. Performance

```typescript
// Cache platform detection
class CachedCrossPlatformLauncher extends CrossPlatformGameLauncher {
  private static platformCache: Platform | null = null;
  
  protected detectPlatform(): Platform {
    if (!CachedCrossPlatformLauncher.platformCache) {
      CachedCrossPlatformLauncher.platformCache = super.detectPlatform();
    }
    return CachedCrossPlatformLauncher.platformCache;
  }
}
```

## Troubleshooting

### Common Issues

1. **Path Separator Issues**
   - Always use `path.join()` or `path.resolve()`
   - Don't hardcode path separators
   - Test on target platforms

2. **Permission Errors**
   - Check file permissions on Unix-like systems
   - Verify executable bit is set
   - Handle Windows UAC requirements

3. **Environment Variables**
   - Use platform-specific environment setup
   - Handle PATH differences correctly
   - Set display variables on Linux

4. **Executable Detection**
   - Handle different executable formats
   - Check for platform-specific extensions
   - Verify executable exists and is accessible

### Debug Mode

```typescript
const launcher = new CrossPlatformGameLauncher({
  verbose: true
});

// Enable detailed logging
launcher.on('debug', (message) => {
  console.log(`[DEBUG] ${message}`);
});

// Log platform information
const platformInfo = launcher.getPlatformInfo();
console.log('Platform Info:', JSON.stringify(platformInfo, null, 2));
```

## Next Steps

- **[Game Library Manager](game-library-manager.md)** - Comprehensive library management
- **[Steam Integration](steam-integration.md)** - Platform-specific Steam integration
- **[Multiple Games](multiple-games.md)** - Managing multiple games
- **[API Documentation](../api/README.md)** - Complete API reference
- **[Best Practices](../guides/best-practices.md)** - Recommended patterns

## Related Examples

- [Simple Launcher](simple-launcher.md) - Basic game launching
- [Event Handling](event-handling.md) - Event system patterns
- [Playtime Tracker](playtime-tracker.md) - Cross-platform playtime tracking

---

*This example demonstrates comprehensive cross-platform compatibility. For production use, thoroughly test on all target platforms and consider platform-specific requirements and limitations.*

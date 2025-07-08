# Configuration Guide

This guide covers all configuration options available in the Game Launcher library, helping you customize its behavior to fit your specific needs.

## 📋 Table of Contents

- [GameLauncher Configuration](#gamelauncher-configuration)
- [Launch Options](#launch-options)
- [Process Manager Configuration](#process-manager-configuration)
- [Environment Variables](#environment-variables)
- [Platform-Specific Configuration](#platform-specific-configuration)
- [Advanced Configuration](#advanced-configuration)
- [Configuration Examples](#configuration-examples)
- [Best Practices](#best-practices)

## 🎮 GameLauncher Configuration

The `GameLauncher` constructor accepts a `GameLauncherOptions` object to customize its behavior.

### GameLauncherOptions Interface

```typescript
interface GameLauncherOptions {
  monitoringInterval?: number;     // Process monitoring interval in milliseconds
  maxRetries?: number;            // Maximum retry attempts for failed operations
  timeout?: number;               // Operation timeout in milliseconds
  processManager?: ProcessManagerOptions; // Process manager configuration
}
```

### Default Configuration

```typescript
const defaultOptions: GameLauncherOptions = {
  monitoringInterval: 1000,  // Check process status every second
  maxRetries: 3,            // Retry failed operations up to 3 times
  timeout: 30000,           // 30 second timeout for operations
  processManager: {         // Default process manager options
    // See Process Manager Configuration section
  }
};
```

### Basic Configuration Examples

```typescript
import { GameLauncher } from '@team-falkor/game-launcher';

// Default configuration
const launcher = new GameLauncher();

// Custom monitoring interval
const fastLauncher = new GameLauncher({
  monitoringInterval: 500  // Check every 500ms for faster response
});

// Conservative configuration
const conservativeLauncher = new GameLauncher({
  monitoringInterval: 5000,  // Check every 5 seconds
  maxRetries: 1,            // Only retry once
  timeout: 60000            // 60 second timeout
});

// High-performance configuration
const performanceLauncher = new GameLauncher({
  monitoringInterval: 250,   // Very frequent monitoring
  maxRetries: 5,            // More retry attempts
  timeout: 10000            // Shorter timeout
});
```

## 🚀 Launch Options

When launching a game, you can specify various options through the `LaunchGameOptions` interface.

### LaunchGameOptions Interface

```typescript
interface LaunchGameOptions {
  gameId: string;                    // Unique identifier for the game
  executable: string;                // Path to the game executable
  args?: string[];                   // Command line arguments
  workingDirectory?: string;         // Working directory for the process
  environment?: Record<string, string>; // Environment variables
  processOptions?: ProcessStartOptions; // Advanced process options
}
```

### Launch Configuration Examples

#### Basic Launch

```typescript
const gameId = await launcher.launchGame({
  gameId: 'my-game',
  executable: '/path/to/game.exe'
});
```

#### Launch with Arguments

```typescript
const gameId = await launcher.launchGame({
  gameId: 'my-game',
  executable: '/path/to/game.exe',
  args: [
    '--fullscreen',
    '--resolution=1920x1080',
    '--quality=high',
    '--no-intro'
  ]
});
```

#### Launch with Working Directory

```typescript
const gameId = await launcher.launchGame({
  gameId: 'my-game',
  executable: '/path/to/game.exe',
  workingDirectory: '/path/to/game/data',  // Game will run from this directory
  args: ['--config=./config.ini']          // Relative paths will be relative to workingDirectory
});
```

#### Launch with Environment Variables

```typescript
const gameId = await launcher.launchGame({
  gameId: 'my-game',
  executable: '/path/to/game.exe',
  environment: {
    // Inherit existing environment
    ...process.env,
    
    // Add game-specific variables
    GAME_MODE: 'development',
    DEBUG_LEVEL: '2',
    GRAPHICS_API: 'vulkan',
    AUDIO_DRIVER: 'alsa',
    
    // Override system variables if needed
    PATH: `/custom/path:${process.env.PATH}`
  }
});
```

## ⚙️ Process Manager Configuration

The Process Manager handles the low-level process operations and can be configured through `ProcessManagerOptions`.

### ProcessManagerOptions Interface

```typescript
interface ProcessManagerOptions {
  killSignal?: string;           // Signal to use when terminating processes
  killTimeout?: number;          // Timeout for graceful termination
  detachedMonitoring?: boolean;  // Enable monitoring for detached processes
  monitoringCommand?: string;    // Custom command for process monitoring
}
```

### Process Manager Examples

```typescript
const launcher = new GameLauncher({
  processManager: {
    killSignal: 'SIGTERM',        // Use SIGTERM for graceful shutdown
    killTimeout: 5000,            // Wait 5 seconds before force kill
    detachedMonitoring: true,     // Monitor GUI applications that detach
    monitoringCommand: 'custom'   // Use custom monitoring command
  }
});
```

### ProcessStartOptions Interface

```typescript
interface ProcessStartOptions {
  detached?: boolean;           // Start process in detached mode
  stdio?: string | string[];    // Standard I/O configuration
  uid?: number;                // User ID (Unix only)
  gid?: number;                // Group ID (Unix only)
  shell?: boolean | string;     // Run in shell
}
```

### Advanced Process Options

```typescript
const gameId = await launcher.launchGame({
  gameId: 'my-game',
  executable: '/path/to/game.exe',
  processOptions: {
    detached: true,              // Detach from parent process
    stdio: ['ignore', 'pipe', 'pipe'], // Capture stdout and stderr
    shell: false,               // Don't use shell
    // Unix-specific options
    uid: 1000,                  // Run as specific user
    gid: 1000                   // Run as specific group
  }
});
```

## 🌍 Environment Variables

### Common Game Environment Variables

```typescript
const commonGameEnvironment = {
  // Graphics settings
  DISPLAY: ':0',                    // X11 display (Linux)
  MESA_GL_VERSION_OVERRIDE: '4.5',  // OpenGL version override
  __GL_SYNC_TO_VBLANK: '1',        // NVIDIA VSync
  
  // Audio settings
  PULSE_RUNTIME_PATH: '/run/user/1000/pulse', // PulseAudio
  ALSA_CARD: '0',                  // ALSA sound card
  
  // Wine settings (for Windows games on Linux)
  WINEPREFIX: '/home/user/.wine',  // Wine prefix
  WINEDLLOVERRIDES: 'mscoree,mshtml=', // DLL overrides
  
  // Steam settings
  STEAM_COMPAT_DATA_PATH: '/path/to/proton', // Proton compatibility
  
  // Debug settings
  MESA_DEBUG: 'silent',            // Mesa debug level
  LIBGL_DEBUG: 'quiet',           // OpenGL debug level
  
  // Performance settings
  OMP_NUM_THREADS: '4',           // OpenMP thread count
  MKL_NUM_THREADS: '4'            // Intel MKL thread count
};

const gameId = await launcher.launchGame({
  gameId: 'my-game',
  executable: '/path/to/game.exe',
  environment: {
    ...process.env,
    ...commonGameEnvironment,
    // Game-specific overrides
    GAME_QUALITY: 'ultra'
  }
});
```

### Dynamic Environment Configuration

```typescript
function createGameEnvironment(gameConfig: any) {
  const baseEnv = { ...process.env };
  
  // Add graphics settings based on system capabilities
  if (hasNvidiaGPU()) {
    baseEnv.__GL_SYNC_TO_VBLANK = '1';
    baseEnv.__GL_SHADER_DISK_CACHE = '1';
  }
  
  // Add audio settings based on system
  if (hasPulseAudio()) {
    baseEnv.PULSE_RUNTIME_PATH = `/run/user/${process.getuid()}/pulse`;
  }
  
  // Add game-specific settings
  if (gameConfig.debugMode) {
    baseEnv.GAME_DEBUG = '1';
    baseEnv.MESA_DEBUG = 'verbose';
  }
  
  return baseEnv;
}

const gameId = await launcher.launchGame({
  gameId: 'my-game',
  executable: '/path/to/game.exe',
  environment: createGameEnvironment({ debugMode: true })
});
```

## 🖥️ Platform-Specific Configuration

### Windows Configuration

```typescript
import { getPlatform } from '@team-falkor/game-launcher';

function createWindowsLauncher() {
  if (getPlatform() !== 'win32') {
    throw new Error('This launcher is for Windows only');
  }
  
  return new GameLauncher({
    monitoringInterval: 500,  // Windows processes can change quickly
    processManager: {
      killSignal: 'SIGTERM',  // Windows supports SIGTERM
      killTimeout: 3000,      // Shorter timeout on Windows
      detachedMonitoring: true // Many Windows games detach
    }
  });
}

// Windows-specific launch options
const gameId = await launcher.launchGame({
  gameId: 'windows-game',
  executable: 'C:\\Program Files\\MyGame\\game.exe',
  args: ['/fullscreen', '/quality:high'],  // Windows-style arguments
  environment: {
    ...process.env,
    PROCESSOR_ARCHITECTURE: 'AMD64',
    TEMP: 'C:\\Temp',
    TMP: 'C:\\Temp'
  },
  processOptions: {
    shell: true,  // Use cmd.exe shell
    stdio: ['ignore', 'pipe', 'pipe']
  }
});
```

### macOS Configuration

```typescript
function createMacOSLauncher() {
  if (getPlatform() !== 'darwin') {
    throw new Error('This launcher is for macOS only');
  }
  
  return new GameLauncher({
    monitoringInterval: 1000,
    processManager: {
      killSignal: 'SIGTERM',
      killTimeout: 5000,      // macOS apps may take longer to close
      detachedMonitoring: true
    }
  });
}

// macOS-specific launch options
const gameId = await launcher.launchGame({
  gameId: 'macos-game',
  executable: '/Applications/MyGame.app/Contents/MacOS/MyGame',
  args: ['--retina', '--metal'],  // macOS-specific arguments
  environment: {
    ...process.env,
    NSHighResolutionCapable: 'YES',
    NSSupportsAutomaticGraphicsSwitching: 'YES'
  },
  processOptions: {
    detached: false,  // Keep attached for better monitoring
    stdio: 'inherit'
  }
});
```

### Linux Configuration

```typescript
function createLinuxLauncher() {
  if (getPlatform() !== 'linux') {
    throw new Error('This launcher is for Linux only');
  }
  
  return new GameLauncher({
    monitoringInterval: 1000,
    processManager: {
      killSignal: 'SIGTERM',
      killTimeout: 10000,     // Linux apps may need more time
      detachedMonitoring: true
    }
  });
}

// Linux-specific launch options
const gameId = await launcher.launchGame({
  gameId: 'linux-game',
  executable: '/usr/local/games/mygame/mygame',
  args: ['--opengl', '--fullscreen'],
  environment: {
    ...process.env,
    DISPLAY: process.env.DISPLAY || ':0',
    XDG_RUNTIME_DIR: `/run/user/${process.getuid()}`,
    LD_LIBRARY_PATH: '/usr/local/lib:/usr/lib',
    MESA_GL_VERSION_OVERRIDE: '4.5'
  },
  processOptions: {
    uid: process.getuid(),
    gid: process.getgid(),
    stdio: ['ignore', 'pipe', 'pipe']
  }
});
```

## 🔧 Advanced Configuration

### Configuration Factory Pattern

```typescript
class GameLauncherFactory {
  static createForPlatform(platform?: string): GameLauncher {
    const currentPlatform = platform || getPlatform();
    
    const baseConfig: GameLauncherOptions = {
      monitoringInterval: 1000,
      maxRetries: 3,
      timeout: 30000
    };
    
    switch (currentPlatform) {
      case 'win32':
        return new GameLauncher({
          ...baseConfig,
          monitoringInterval: 500,
          processManager: {
            killSignal: 'SIGTERM',
            killTimeout: 3000,
            detachedMonitoring: true
          }
        });
        
      case 'darwin':
        return new GameLauncher({
          ...baseConfig,
          processManager: {
            killSignal: 'SIGTERM',
            killTimeout: 5000,
            detachedMonitoring: true
          }
        });
        
      case 'linux':
        return new GameLauncher({
          ...baseConfig,
          processManager: {
            killSignal: 'SIGTERM',
            killTimeout: 10000,
            detachedMonitoring: true
          }
        });
        
      default:
        return new GameLauncher(baseConfig);
    }
  }
  
  static createForPerformance(): GameLauncher {
    return new GameLauncher({
      monitoringInterval: 250,  // Very fast monitoring
      maxRetries: 5,
      timeout: 15000,
      processManager: {
        killTimeout: 2000,      // Quick termination
        detachedMonitoring: true
      }
    });
  }
  
  static createForStability(): GameLauncher {
    return new GameLauncher({
      monitoringInterval: 2000, // Slower monitoring
      maxRetries: 1,           // Don't retry much
      timeout: 60000,          // Long timeout
      processManager: {
        killTimeout: 15000,     // Give processes time to close
        detachedMonitoring: false
      }
    });
  }
}

// Usage
const platformLauncher = GameLauncherFactory.createForPlatform();
const performanceLauncher = GameLauncherFactory.createForPerformance();
const stableLauncher = GameLauncherFactory.createForStability();
```

### Configuration Profiles

```typescript
interface LauncherProfile {
  name: string;
  description: string;
  config: GameLauncherOptions;
  defaultLaunchOptions?: Partial<LaunchGameOptions>;
}

const profiles: Record<string, LauncherProfile> = {
  gaming: {
    name: 'Gaming',
    description: 'Optimized for gaming performance',
    config: {
      monitoringInterval: 500,
      maxRetries: 3,
      timeout: 20000,
      processManager: {
        killTimeout: 3000,
        detachedMonitoring: true
      }
    },
    defaultLaunchOptions: {
      environment: {
        GAME_MODE: 'performance',
        PRIORITY: 'high'
      }
    }
  },
  
  development: {
    name: 'Development',
    description: 'For game development and debugging',
    config: {
      monitoringInterval: 1000,
      maxRetries: 1,
      timeout: 60000,
      processManager: {
        killTimeout: 10000,
        detachedMonitoring: false
      }
    },
    defaultLaunchOptions: {
      environment: {
        DEBUG: '1',
        VERBOSE: '1'
      },
      processOptions: {
        stdio: 'inherit'
      }
    }
  },
  
  server: {
    name: 'Server',
    description: 'For dedicated game servers',
    config: {
      monitoringInterval: 2000,
      maxRetries: 5,
      timeout: 120000,
      processManager: {
        killTimeout: 30000,
        detachedMonitoring: false
      }
    },
    defaultLaunchOptions: {
      processOptions: {
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe']
      }
    }
  }
};

class ProfiledGameLauncher {
  private launcher: GameLauncher;
  private profile: LauncherProfile;
  
  constructor(profileName: string) {
    this.profile = profiles[profileName];
    if (!this.profile) {
      throw new Error(`Unknown profile: ${profileName}`);
    }
    
    this.launcher = new GameLauncher(this.profile.config);
    console.log(`Initialized ${this.profile.name} launcher: ${this.profile.description}`);
  }
  
  async launchGame(options: LaunchGameOptions): Promise<string> {
    // Merge profile defaults with provided options
    const mergedOptions: LaunchGameOptions = {
      ...this.profile.defaultLaunchOptions,
      ...options,
      environment: {
        ...this.profile.defaultLaunchOptions?.environment,
        ...options.environment
      },
      processOptions: {
        ...this.profile.defaultLaunchOptions?.processOptions,
        ...options.processOptions
      }
    };
    
    return await this.launcher.launchGame(mergedOptions);
  }
  
  // Delegate other methods to the underlying launcher
  async closeGame(gameId: string) {
    return await this.launcher.closeGame(gameId);
  }
  
  async isGameRunning(gameId: string) {
    return await this.launcher.isGameRunning(gameId);
  }
  
  on(event: string, listener: Function) {
    return this.launcher.on(event, listener);
  }
}

// Usage
const gamingLauncher = new ProfiledGameLauncher('gaming');
const devLauncher = new ProfiledGameLauncher('development');
const serverLauncher = new ProfiledGameLauncher('server');

// Launch with profile-specific defaults
await gamingLauncher.launchGame({
  gameId: 'my-game',
  executable: '/path/to/game.exe'
  // Gaming profile defaults will be applied automatically
});
```

## 📚 Configuration Examples

### Steam Game Launcher

```typescript
class SteamGameLauncher {
  private launcher: GameLauncher;
  
  constructor() {
    this.launcher = new GameLauncher({
      monitoringInterval: 1000,
      processManager: {
        detachedMonitoring: true,  // Steam games often detach
        killTimeout: 5000
      }
    });
  }
  
  async launchSteamGame(appId: string, steamPath?: string): Promise<string> {
    const steamExecutable = steamPath || this.findSteamExecutable();
    
    return await this.launcher.launchGame({
      gameId: `steam-${appId}`,
      executable: steamExecutable,
      args: ['-applaunch', appId],
      environment: {
        ...process.env,
        STEAM_COMPAT_DATA_PATH: this.getSteamCompatPath(),
        STEAM_RUNTIME: '1'
      }
    });
  }
  
  private findSteamExecutable(): string {
    const platform = getPlatform();
    switch (platform) {
      case 'win32':
        return 'C:\\Program Files (x86)\\Steam\\steam.exe';
      case 'darwin':
        return '/Applications/Steam.app/Contents/MacOS/steam_osx';
      case 'linux':
        return '/usr/bin/steam';
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }
  
  private getSteamCompatPath(): string {
    return process.env.HOME + '/.steam/steam/steamapps/compatdata';
  }
}

// Usage
const steamLauncher = new SteamGameLauncher();
await steamLauncher.launchSteamGame('12345'); // Launch Steam app ID 12345
```

### Wine Game Launcher (Linux)

```typescript
class WineGameLauncher {
  private launcher: GameLauncher;
  private winePrefix: string;
  
  constructor(winePrefix: string = process.env.HOME + '/.wine') {
    this.winePrefix = winePrefix;
    this.launcher = new GameLauncher({
      monitoringInterval: 1500,  // Wine processes can be slower
      processManager: {
        killTimeout: 15000,      // Wine apps may take longer to close
        detachedMonitoring: true
      }
    });
  }
  
  async launchWindowsGame(gameId: string, executable: string, args?: string[]): Promise<string> {
    return await this.launcher.launchGame({
      gameId,
      executable: 'wine',
      args: [executable, ...(args || [])],
      environment: {
        ...process.env,
        WINEPREFIX: this.winePrefix,
        WINEDLLOVERRIDES: 'mscoree,mshtml=',
        WINE_CPU_TOPOLOGY: '4:2',
        DXVK_HUD: 'fps',
        MESA_GL_VERSION_OVERRIDE: '4.5'
      },
      workingDirectory: this.winePrefix + '/drive_c'
    });
  }
}

// Usage
const wineLauncher = new WineGameLauncher('/home/user/.wine-gaming');
await wineLauncher.launchWindowsGame(
  'windows-game',
  'C:\\Games\\MyGame\\game.exe',
  ['--fullscreen']
);
```

## 🎯 Best Practices

### 1. Use Environment-Specific Configuration

```typescript
// ✅ Good: Environment-aware configuration
const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

const launcher = new GameLauncher({
  monitoringInterval: isDevelopment ? 500 : 2000,
  maxRetries: isDevelopment ? 1 : 3,
  timeout: isDevelopment ? 60000 : 30000
});

// ❌ Bad: Hardcoded configuration
const launcher = new GameLauncher({
  monitoringInterval: 500  // Always fast, even in production
});
```

### 2. Validate Configuration

```typescript
// ✅ Good: Validate configuration
function createValidatedLauncher(options: GameLauncherOptions): GameLauncher {
  if (options.monitoringInterval && options.monitoringInterval < 100) {
    throw new Error('Monitoring interval too low (minimum 100ms)');
  }
  
  if (options.timeout && options.timeout < 1000) {
    throw new Error('Timeout too low (minimum 1000ms)');
  }
  
  return new GameLauncher(options);
}

// ❌ Bad: No validation
const launcher = new GameLauncher({
  monitoringInterval: 10,  // Too low!
  timeout: 100            // Too low!
});
```

### 3. Use Configuration Files

```typescript
// config.json
{
  "development": {
    "monitoringInterval": 500,
    "maxRetries": 1,
    "timeout": 60000,
    "processManager": {
      "killTimeout": 10000
    }
  },
  "production": {
    "monitoringInterval": 2000,
    "maxRetries": 3,
    "timeout": 30000,
    "processManager": {
      "killTimeout": 5000
    }
  }
}

// launcher.ts
import config from './config.json';

const environment = process.env.NODE_ENV || 'development';
const launcherConfig = config[environment];

const launcher = new GameLauncher(launcherConfig);
```

### 4. Handle Platform Differences

```typescript
// ✅ Good: Platform-aware configuration
function createPlatformLauncher(): GameLauncher {
  const platform = getPlatform();
  const baseConfig = {
    maxRetries: 3,
    timeout: 30000
  };
  
  switch (platform) {
    case 'win32':
      return new GameLauncher({
        ...baseConfig,
        monitoringInterval: 500,  // Windows processes change quickly
        processManager: {
          killTimeout: 3000       // Windows apps close faster
        }
      });
      
    case 'linux':
      return new GameLauncher({
        ...baseConfig,
        monitoringInterval: 1000,
        processManager: {
          killTimeout: 10000      // Linux apps may need more time
        }
      });
      
    default:
      return new GameLauncher(baseConfig);
  }
}

// ❌ Bad: One-size-fits-all configuration
const launcher = new GameLauncher({
  monitoringInterval: 1000  // Same for all platforms
});
```

### 5. Document Your Configuration

```typescript
/**
 * Game Launcher Configuration
 * 
 * Performance Profile:
 * - Fast monitoring (500ms) for responsive UI
 * - Multiple retries for reliability
 * - Shorter timeout for quick feedback
 * 
 * Platform: Windows
 * - Optimized for Windows process behavior
 * - Detached monitoring for GUI applications
 */
const launcher = new GameLauncher({
  monitoringInterval: 500,   // Fast response for UI updates
  maxRetries: 3,            // Retry failed operations
  timeout: 20000,           // 20 second timeout
  processManager: {
    killTimeout: 3000,      // Windows apps close quickly
    detachedMonitoring: true // Handle GUI app detachment
  }
});
```

---

**Next:** [Best Practices Guide](best-practices.md) | [API Reference](../api/README.md)
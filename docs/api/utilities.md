# Utilities Documentation

The Game Launcher library provides several utility functions and modules to help with common tasks such as validation, platform detection, and process management.

## 📋 Table of Contents

- [Validation Utilities](#validation-utilities)
- [Platform Utilities](#platform-utilities)
- [Process Utilities](#process-utilities)
- [Usage Examples](#usage-examples)
- [Best Practices](#best-practices)

## ✅ Validation Utilities

### `validateGameId(gameId)`

Validates that a game ID meets the required format and constraints.

```typescript
function validateGameId(gameId: string): void
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `gameId` | `string` | The game ID to validate |

#### Validation Rules

- Must be a non-empty string
- Must be less than 255 characters
- Can only contain alphanumeric characters, hyphens, and underscores
- Matches pattern: `/^[a-zA-Z0-9_-]+$/`

#### Throws

- `Error` - If game ID is invalid

#### Usage Example

```typescript
import { validateGameId } from '@team-falkor/game-launcher';

try {
  validateGameId('my-game-123'); // ✅ Valid
  validateGameId('game_with_underscores'); // ✅ Valid
  validateGameId('GAME-WITH-CAPS'); // ✅ Valid
  
  validateGameId(''); // ❌ Throws: "Game ID must be a non-empty string"
  validateGameId('game with spaces'); // ❌ Throws: Invalid characters
  validateGameId('game@special!chars'); // ❌ Throws: Invalid characters
} catch (error) {
  console.error('Invalid game ID:', error.message);
}
```

### `validateExecutable(executable)`

Validates that an executable file exists and is executable.

```typescript
function validateExecutable(executable: string): Promise<void>
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `executable` | `string` | Path to the executable file |

#### Validation Checks

- File exists at the specified path
- File has execute permissions
- Path is resolved to absolute path

#### Throws

- `Error` - If executable is not found or not executable

#### Usage Example

```typescript
import { validateExecutable } from '@team-falkor/game-launcher';

try {
  // Validate executable before launching
  await validateExecutable('/path/to/game.exe');
  console.log('Executable is valid');
  
  // Now safe to launch
  await launcher.launchGame({
    gameId: 'my-game',
    executable: '/path/to/game.exe'
  });
} catch (error) {
  console.error('Invalid executable:', error.message);
}
```

#### Platform-Specific Behavior

```typescript
// Windows
await validateExecutable('C:\\Games\\MyGame\\game.exe');

// macOS/Linux
await validateExecutable('/Applications/MyGame.app/Contents/MacOS/game');
await validateExecutable('/usr/local/bin/game');

// Relative paths are resolved
await validateExecutable('./game.exe'); // Resolved to absolute path
```

## 🌍 Platform Utilities

### `getPlatform()`

Detects the current operating system platform.

```typescript
function getPlatform(): Platform
```

#### Returns

- `Platform` - One of `'win32'`, `'darwin'`, `'linux'`, or `'other'`

#### Platform Mapping

| Node.js `process.platform` | Returned Value |
|----------------------------|----------------|
| `'win32'` | `'win32'` |
| `'darwin'` | `'darwin'` |
| `'linux'` | `'linux'` |
| Any other | `'other'` |

#### Usage Example

```typescript
import { getPlatform } from '@team-falkor/game-launcher';

const platform = getPlatform();

switch (platform) {
  case 'win32':
    console.log('Running on Windows');
    // Use Windows-specific paths or commands
    break;
  case 'darwin':
    console.log('Running on macOS');
    // Use macOS-specific paths or commands
    break;
  case 'linux':
    console.log('Running on Linux');
    // Use Linux-specific paths or commands
    break;
  case 'other':
    console.log('Running on other Unix-like system');
    // Use generic Unix commands
    break;
}
```

### `getKillSignal(force?)`

Returns the appropriate signal to use for terminating processes.

```typescript
function getKillSignal(force?: boolean): string
```

#### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `force` | `boolean` | `false` | Whether to use force kill signal |

#### Returns

- `string` - Signal name (`'SIGTERM'` or `'SIGKILL'`)

#### Signal Selection

| Platform | Graceful (`force=false`) | Force (`force=true`) |
|----------|-------------------------|---------------------|
| Windows | `'SIGTERM'` | `'SIGKILL'` |
| Unix-like | `'SIGTERM'` | `'SIGKILL'` |

#### Usage Example

```typescript
import { getKillSignal } from '@team-falkor/game-launcher';

// Graceful termination
const gracefulSignal = getKillSignal(false); // 'SIGTERM'
console.log('Using graceful signal:', gracefulSignal);

// Force termination
const forceSignal = getKillSignal(true); // 'SIGKILL'
console.log('Using force signal:', forceSignal);

// Use in process termination
process.kill(pid, getKillSignal(false));
```

## ⚙️ Process Utilities

While not directly exported, the library includes internal process utilities that power the main functionality.

### Process Status Management

The library internally manages process statuses through the `GameStatus` type:

```typescript
type GameStatus = 
  | "launching"  // Process is being started
  | "running"    // Process is running normally
  | "detached"   // Process has detached (GUI applications)
  | "closing"    // Process is being terminated
  | "closed"     // Process has terminated
  | "error";     // Process encountered an error
```

### Process Monitoring

The library includes sophisticated process monitoring capabilities:

- **Regular Process Monitoring** - For standard console applications
- **Detached Process Monitoring** - For GUI applications that detach quickly
- **Cross-Platform Compatibility** - Uses platform-specific commands

## 📚 Usage Examples

### Pre-Launch Validation

```typescript
import { validateGameId, validateExecutable, getPlatform } from '@team-falkor/game-launcher';

async function safeLaunchGame(gameId: string, executable: string, args?: string[]) {
  try {
    // Validate inputs before launching
    validateGameId(gameId);
    await validateExecutable(executable);
    
    console.log(`Platform: ${getPlatform()}`);
    console.log(`Launching ${gameId} from ${executable}`);
    
    // Now safe to launch
    await launcher.launchGame({
      gameId,
      executable,
      args
    });
    
    console.log('Game launched successfully!');
  } catch (error) {
    console.error('Failed to launch game:', error.message);
    throw error;
  }
}

// Usage
await safeLaunchGame('my-game', '/path/to/game.exe', ['--fullscreen']);
```

### Platform-Specific Game Paths

```typescript
import { getPlatform } from 'game-launcher';

function getGameExecutable(gameName: string): string {
  const platform = getPlatform();
  
  switch (platform) {
    case 'win32':
      return `C:\\Program Files\\${gameName}\\${gameName}.exe`;
    case 'darwin':
      return `/Applications/${gameName}.app/Contents/MacOS/${gameName}`;
    case 'linux':
      return `/usr/local/games/${gameName}/${gameName}`;
    default:
      return `/opt/${gameName}/${gameName}`;
  }
}

// Usage
const executable = getGameExecutable('MyAwesomeGame');
console.log('Game executable:', executable);
```

### Batch Game Validation

```typescript
import { validateGameId, validateExecutable } from '@team-falkor/game-launcher';

interface GameConfig {
  gameId: string;
  executable: string;
  args?: string[];
}

async function validateGameConfigs(games: GameConfig[]): Promise<GameConfig[]> {
  const validGames: GameConfig[] = [];
  const errors: Array<{ game: GameConfig; error: string }> = [];
  
  for (const game of games) {
    try {
      // Validate game ID
      validateGameId(game.gameId);
      
      // Validate executable
      await validateExecutable(game.executable);
      
      validGames.push(game);
      console.log(`✅ ${game.gameId} is valid`);
    } catch (error) {
      errors.push({ game, error: error.message });
      console.error(`❌ ${game.gameId}: ${error.message}`);
    }
  }
  
  if (errors.length > 0) {
    console.log(`\nValidation Summary:`);
    console.log(`Valid games: ${validGames.length}`);
    console.log(`Invalid games: ${errors.length}`);
  }
  
  return validGames;
}

// Usage
const gameConfigs: GameConfig[] = [
  { gameId: 'game1', executable: '/path/to/game1.exe' },
  { gameId: 'game2', executable: '/path/to/game2.exe' },
  { gameId: 'invalid game', executable: '/invalid/path' }
];

const validGames = await validateGameConfigs(gameConfigs);
console.log(`${validGames.length} games are ready to launch`);
```

### Dynamic Platform Configuration

```typescript
import { getPlatform, getKillSignal } from '@team-falkor/game-launcher';

class PlatformConfig {
  private platform = getPlatform();
  
  getDefaultGamePaths(): string[] {
    switch (this.platform) {
      case 'win32':
        return [
          'C:\\Program Files\\',
          'C:\\Program Files (x86)\\',
          'C:\\Games\\'
        ];
      case 'darwin':
        return [
          '/Applications/',
          '/Users/' + process.env.USER + '/Applications/',
          '/opt/'
        ];
      case 'linux':
        return [
          '/usr/local/games/',
          '/opt/',
          '/home/' + process.env.USER + '/games/'
        ];
      default:
        return ['/opt/', '/usr/local/'];
    }
  }
  
  getProcessTerminationStrategy() {
    return {
      gracefulSignal: getKillSignal(false),
      forceSignal: getKillSignal(true),
      gracefulTimeout: this.platform === 'win32' ? 5000 : 3000
    };
  }
  
  getMonitoringInterval(): number {
    // More frequent monitoring on Windows due to process behavior
    return this.platform === 'win32' ? 500 : 1000;
  }
}

// Usage
const config = new PlatformConfig();
const launcher = new GameLauncher({
  monitoringInterval: config.getMonitoringInterval()
});

console.log('Default game paths:', config.getDefaultGamePaths());
console.log('Termination strategy:', config.getProcessTerminationStrategy());
```

### Error-Safe Utility Wrapper

```typescript
import { validateGameId, validateExecutable, getPlatform } from 'game-launcher';

class SafeGameLauncher {
  private launcher: GameLauncher;
  
  constructor(options?: GameLauncherOptions) {
    this.launcher = new GameLauncher(options);
  }
  
  async safeLaunchGame(options: LaunchGameOptions): Promise<string | null> {
    try {
      // Pre-launch validation
      validateGameId(options.gameId);
      
      if (options.executable) {
        await validateExecutable(options.executable);
      }
      
      // Platform-specific adjustments
      const adjustedOptions = this.adjustOptionsForPlatform(options);
      
      // Launch the game
      return await this.launcher.launchGame(adjustedOptions);
    } catch (error) {
      console.error(`Failed to launch ${options.gameId}:`, error.message);
      return null;
    }
  }
  
  private adjustOptionsForPlatform(options: LaunchGameOptions): LaunchGameOptions {
    const platform = getPlatform();
    
    // Platform-specific adjustments
    if (platform === 'win32' && !options.executable.endsWith('.exe')) {
      console.warn('Windows executable should end with .exe');
    }
    
    return {
      ...options,
      // Add platform-specific environment variables
      environment: {
        PLATFORM: platform,
        ...options.environment
      }
    };
  }
}

// Usage
const safeLauncher = new SafeGameLauncher();
const gameId = await safeLauncher.safeLaunchGame({
  gameId: 'my-game',
  executable: '/path/to/game.exe'
});

if (gameId) {
  console.log('Game launched successfully with ID:', gameId);
} else {
  console.log('Failed to launch game');
}
```

## 🎯 Best Practices

### 1. Always Validate Before Launch

```typescript
// ✅ Good: Validate before launching
try {
  validateGameId(gameId);
  await validateExecutable(executable);
  await launcher.launchGame({ gameId, executable });
} catch (error) {
  console.error('Validation failed:', error.message);
}

// ❌ Bad: Launch without validation
await launcher.launchGame({ gameId, executable }); // May fail at runtime
```

### 2. Use Platform Detection for Paths

```typescript
// ✅ Good: Platform-aware paths
const platform = getPlatform();
const executable = platform === 'win32' 
  ? 'C:\\Games\\game.exe'
  : '/usr/local/games/game';

// ❌ Bad: Hardcoded paths
const executable = 'C:\\Games\\game.exe'; // Won't work on Unix
```

### 3. Handle Validation Errors Gracefully

```typescript
// ✅ Good: Specific error handling
try {
  validateGameId(gameId);
} catch (error) {
  if (error.message.includes('non-empty')) {
    console.error('Game ID cannot be empty');
  } else if (error.message.includes('characters')) {
    console.error('Game ID contains invalid characters');
  }
}

// ❌ Bad: Generic error handling
try {
  validateGameId(gameId);
} catch (error) {
  console.error('Something went wrong');
}
```

### 4. Use Async Validation Properly

```typescript
// ✅ Good: Proper async handling
async function validateAndLaunch(gameId: string, executable: string) {
  try {
    validateGameId(gameId); // Sync validation
    await validateExecutable(executable); // Async validation
    return await launcher.launchGame({ gameId, executable });
  } catch (error) {
    console.error('Validation or launch failed:', error.message);
    throw error;
  }
}

// ❌ Bad: Missing await
function validateAndLaunch(gameId: string, executable: string) {
  validateGameId(gameId);
  validateExecutable(executable); // Missing await!
  return launcher.launchGame({ gameId, executable });
}
```

### 5. Create Reusable Validation Functions

```typescript
// ✅ Good: Reusable validation
async function validateGameConfig(config: LaunchGameOptions): Promise<void> {
  validateGameId(config.gameId);
  await validateExecutable(config.executable);
  
  // Additional custom validations
  if (config.args && config.args.length > 50) {
    throw new Error('Too many arguments');
  }
}

// Usage
try {
  await validateGameConfig(gameConfig);
  await launcher.launchGame(gameConfig);
} catch (error) {
  console.error('Configuration invalid:', error.message);
}
```

---

**Next:** [Getting Started Guide](../guides/getting-started.md) | [Configuration Guide](../guides/configuration.md)
# Steam Integration

This example demonstrates how to integrate the Game Launcher library with Steam to launch Steam games programmatically.

## Overview

The Steam Integration example shows how to:
- Detect Steam installation and games
- Launch Steam games using their App IDs
- Handle Steam-specific launch parameters
- Monitor Steam game processes
- Work with Steam's protocol and file structure

## Prerequisites

- Node.js 16.0.0 or higher
- Game Launcher library installed
- Steam client installed on the system
- Steam games installed and accessible

## Steam Basics

### Steam App IDs
Every Steam game has a unique App ID. You can find these:
- In the Steam store URL: `https://store.steampowered.com/app/[APP_ID]/`
- Using Steam's web API
- In Steam's local files

### Steam Launch Methods
1. **Steam Protocol**: `steam://run/[APP_ID]`
2. **Steam Executable**: Direct Steam.exe with parameters
3. **Game Executable**: Direct game executable (if accessible)

## Code

### Complete Steam Integration Example

```typescript
import { GameLauncher } from '@team-falkor/game-launcher';
import path from 'path';
import fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Steam Game Launcher
 * Provides Steam-specific game launching capabilities
 */
class SteamGameLauncher {
  private launcher: GameLauncher;
  private steamPath: string | null = null;
  private steamGames: Map<string, SteamGame> = new Map();

  constructor() {
    this.launcher = new GameLauncher({
      timeout: 45000, // Steam games may take longer to start
      verbose: true
    });
    
    this.setupEventHandlers();
  }

  /**
   * Initialize Steam integration
   */
  async initialize(): Promise<void> {
    console.log('🔍 Initializing Steam integration...');
    
    try {
      // Detect Steam installation
      this.steamPath = await this.detectSteamPath();
      if (!this.steamPath) {
        throw new Error('Steam installation not found');
      }
      
      console.log(`✅ Steam found at: ${this.steamPath}`);
      
      // Load Steam games
      await this.loadSteamGames();
      console.log(`📚 Loaded ${this.steamGames.size} Steam games`);
      
    } catch (error) {
      console.error('❌ Steam initialization failed:', error.message);
      throw error;
    }
  }

  /**
   * Launch a Steam game by App ID
   */
  async launchSteamGame(appId: string, options: SteamLaunchOptions = {}): Promise<string> {
    try {
      console.log(`🚀 Launching Steam game: ${appId}`);
      
      // Get game information
      const game = this.steamGames.get(appId);
      if (game) {
        console.log(`   Game: ${game.name}`);
        console.log(`   Path: ${game.installPath || 'Unknown'}`);
      }
      
      // Choose launch method
      const launchMethod = options.launchMethod || 'steam-protocol';
      
      switch (launchMethod) {
        case 'steam-protocol':
          return await this.launchViaSteamProtocol(appId, options);
        
        case 'steam-executable':
          return await this.launchViaSteamExecutable(appId, options);
        
        case 'direct-executable':
          return await this.launchViaDirectExecutable(appId, options);
        
        default:
          throw new Error(`Unknown launch method: ${launchMethod}`);
      }
      
    } catch (error) {
      console.error(`💥 Failed to launch Steam game ${appId}:`, error.message);
      throw error;
    }
  }

  /**
   * Launch game using Steam protocol (steam://run/appid)
   */
  private async launchViaSteamProtocol(appId: string, options: SteamLaunchOptions): Promise<string> {
    const gameId = options.gameId || `steam-${appId}`;
    const steamUrl = `steam://run/${appId}`;
    
    // Add launch parameters if specified
    const launchParams = this.buildLaunchParameters(options);
    const fullUrl = launchParams ? `${steamUrl}/${launchParams}` : steamUrl;
    
    console.log(`🔗 Using Steam protocol: ${fullUrl}`);
    
    // Launch using system's default handler for steam:// URLs
    const gameInstanceId = await this.launcher.launchGame({
      gameId,
      executable: this.getSteamProtocolLauncher(),
      args: [fullUrl],
      detached: true,
      env: {
        ...process.env,
        STEAM_COMPAT_DATA_PATH: options.compatDataPath || ''
      }
    });
    
    return gameInstanceId;
  }

  /**
   * Launch game using Steam executable with parameters
   */
  private async launchViaSteamExecutable(appId: string, options: SteamLaunchOptions): Promise<string> {
    if (!this.steamPath) {
      throw new Error('Steam path not detected');
    }
    
    const gameId = options.gameId || `steam-exe-${appId}`;
    const steamExe = path.join(this.steamPath, 'steam.exe');
    
    // Build Steam arguments
    const args = ['-applaunch', appId];
    
    // Add launch parameters
    const launchParams = this.buildLaunchParameters(options);
    if (launchParams) {
      args.push('--', ...launchParams.split(' '));
    }
    
    console.log(`⚙️ Using Steam executable: ${steamExe}`);
    console.log(`📋 Arguments: ${args.join(' ')}`);
    
    const gameInstanceId = await this.launcher.launchGame({
      gameId,
      executable: steamExe,
      args,
      detached: true,
      cwd: this.steamPath,
      env: {
        ...process.env,
        STEAM_COMPAT_DATA_PATH: options.compatDataPath || ''
      }
    });
    
    return gameInstanceId;
  }

  /**
   * Launch game directly via its executable (bypassing Steam)
   */
  private async launchViaDirectExecutable(appId: string, options: SteamLaunchOptions): Promise<string> {
    const game = this.steamGames.get(appId);
    if (!game || !game.executablePath) {
      throw new Error(`Direct executable not found for Steam game ${appId}`);
    }
    
    const gameId = options.gameId || `direct-${appId}`;
    
    console.log(`🎯 Direct launch: ${game.executablePath}`);
    
    const gameInstanceId = await this.launcher.launchGame({
      gameId,
      executable: game.executablePath,
      args: options.gameArgs || [],
      detached: true,
      cwd: game.installPath,
      env: {
        ...process.env,
        ...options.env
      }
    });
    
    return gameInstanceId;
  }

  /**
   * Get list of installed Steam games
   */
  getSteamGames(): SteamGame[] {
    return Array.from(this.steamGames.values());
  }

  /**
   * Get specific Steam game information
   */
  getSteamGame(appId: string): SteamGame | undefined {
    return this.steamGames.get(appId);
  }

  /**
   * Check if a Steam game is installed
   */
  isSteamGameInstalled(appId: string): boolean {
    return this.steamGames.has(appId);
  }

  /**
   * Detect Steam installation path
   */
  private async detectSteamPath(): Promise<string | null> {
    const platform = process.platform;
    
    try {
      switch (platform) {
        case 'win32':
          return await this.detectSteamPathWindows();
        
        case 'darwin':
          return await this.detectSteamPathMacOS();
        
        case 'linux':
          return await this.detectSteamPathLinux();
        
        default:
          throw new Error(`Unsupported platform: ${platform}`);
      }
    } catch (error) {
      console.error('Steam detection failed:', error.message);
      return null;
    }
  }

  /**
   * Detect Steam path on Windows
   */
  private async detectSteamPathWindows(): Promise<string | null> {
    const possiblePaths = [
      'C:\\Program Files (x86)\\Steam',
      'C:\\Program Files\\Steam',
      path.join(process.env.PROGRAMFILES || '', 'Steam'),
      path.join(process.env['PROGRAMFILES(X86)'] || '', 'Steam')
    ];
    
    for (const steamPath of possiblePaths) {
      try {
        const steamExe = path.join(steamPath, 'steam.exe');
        await fs.access(steamExe);
        return steamPath;
      } catch {
        continue;
      }
    }
    
    // Try registry lookup
    try {
      const { stdout } = await execAsync(
        'reg query "HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432Node\\Valve\\Steam" /v InstallPath'
      );
      const match = stdout.match(/InstallPath\s+REG_SZ\s+(.+)/);
      if (match) {
        return match[1].trim();
      }
    } catch {
      // Registry lookup failed
    }
    
    return null;
  }

  /**
   * Detect Steam path on macOS
   */
  private async detectSteamPathMacOS(): Promise<string | null> {
    const possiblePaths = [
      '/Applications/Steam.app/Contents/MacOS',
      path.join(process.env.HOME || '', 'Applications/Steam.app/Contents/MacOS')
    ];
    
    for (const steamPath of possiblePaths) {
      try {
        await fs.access(path.join(steamPath, 'steam_osx'));
        return steamPath;
      } catch {
        continue;
      }
    }
    
    return null;
  }

  /**
   * Detect Steam path on Linux
   */
  private async detectSteamPathLinux(): Promise<string | null> {
    const possiblePaths = [
      path.join(process.env.HOME || '', '.steam/steam'),
      path.join(process.env.HOME || '', '.local/share/Steam'),
      '/usr/bin/steam',
      '/usr/local/bin/steam'
    ];
    
    for (const steamPath of possiblePaths) {
      try {
        await fs.access(steamPath);
        return steamPath;
      } catch {
        continue;
      }
    }
    
    return null;
  }

  /**
   * Load Steam games from library folders
   */
  private async loadSteamGames(): Promise<void> {
    if (!this.steamPath) {
      throw new Error('Steam path not available');
    }
    
    try {
      // Load from steamapps folders
      const steamappsPath = path.join(this.steamPath, 'steamapps');
      await this.loadGamesFromSteamapps(steamappsPath);
      
      // Load from library folders (if any)
      await this.loadLibraryFolders();
      
    } catch (error) {
      console.error('Failed to load Steam games:', error.message);
    }
  }

  /**
   * Load games from a steamapps directory
   */
  private async loadGamesFromSteamapps(steamappsPath: string): Promise<void> {
    try {
      const commonPath = path.join(steamappsPath, 'common');
      const manifestFiles = await fs.readdir(steamappsPath);
      
      for (const file of manifestFiles) {
        if (file.startsWith('appmanifest_') && file.endsWith('.acf')) {
          try {
            const manifestPath = path.join(steamappsPath, file);
            const game = await this.parseAppManifest(manifestPath, commonPath);
            if (game) {
              this.steamGames.set(game.appId, game);
            }
          } catch (error) {
            console.warn(`Failed to parse manifest ${file}:`, error.message);
          }
        }
      }
    } catch (error) {
      console.warn('Failed to load steamapps:', error.message);
    }
  }

  /**
   * Parse Steam app manifest file
   */
  private async parseAppManifest(manifestPath: string, commonPath: string): Promise<SteamGame | null> {
    try {
      const content = await fs.readFile(manifestPath, 'utf-8');
      
      // Simple ACF parser (Steam's format)
      const appId = this.extractACFValue(content, 'appid');
      const name = this.extractACFValue(content, 'name');
      const installDir = this.extractACFValue(content, 'installdir');
      
      if (!appId || !name || !installDir) {
        return null;
      }
      
      const installPath = path.join(commonPath, installDir);
      
      // Try to find the main executable
      const executablePath = await this.findGameExecutable(installPath, name);
      
      return {
        appId,
        name,
        installDir,
        installPath,
        executablePath,
        manifestPath
      };
      
    } catch (error) {
      console.warn(`Failed to parse manifest ${manifestPath}:`, error.message);
      return null;
    }
  }

  /**
   * Extract value from ACF (Steam's config format)
   */
  private extractACFValue(content: string, key: string): string | null {
    const regex = new RegExp(`"${key}"\\s*"([^"]+)"`);
    const match = content.match(regex);
    return match ? match[1] : null;
  }

  /**
   * Find the main executable for a game
   */
  private async findGameExecutable(installPath: string, gameName: string): Promise<string | null> {
    try {
      const files = await fs.readdir(installPath);
      
      // Look for common executable patterns
      const executablePatterns = [
        new RegExp(`${gameName.replace(/\s+/g, '')}\\.(exe|app)$`, 'i'),
        /\.exe$/i,
        /\.app$/i
      ];
      
      for (const pattern of executablePatterns) {
        const executable = files.find(file => pattern.test(file));
        if (executable) {
          return path.join(installPath, executable);
        }
      }
      
    } catch (error) {
      console.warn(`Failed to find executable in ${installPath}:`, error.message);
    }
    
    return null;
  }

  /**
   * Load additional library folders
   */
  private async loadLibraryFolders(): Promise<void> {
    if (!this.steamPath) return;
    
    try {
      const configPath = path.join(this.steamPath, 'steamapps', 'libraryfolders.vdf');
      const content = await fs.readFile(configPath, 'utf-8');
      
      // Parse library folders (simplified VDF parsing)
      const pathMatches = content.match(/"path"\s*"([^"]+)"/g);
      if (pathMatches) {
        for (const match of pathMatches) {
          const pathMatch = match.match(/"path"\s*"([^"]+)"/);
          if (pathMatch) {
            const libraryPath = pathMatch[1].replace(/\\\\/g, '\\');
            const steamappsPath = path.join(libraryPath, 'steamapps');
            await this.loadGamesFromSteamapps(steamappsPath);
          }
        }
      }
    } catch (error) {
      console.warn('Failed to load library folders:', error.message);
    }
  }

  /**
   * Build launch parameters string
   */
  private buildLaunchParameters(options: SteamLaunchOptions): string {
    const params: string[] = [];
    
    if (options.gameArgs) {
      params.push(...options.gameArgs);
    }
    
    if (options.steamArgs) {
      params.push(...options.steamArgs);
    }
    
    return params.join(' ');
  }

  /**
   * Get the appropriate launcher for Steam protocol
   */
  private getSteamProtocolLauncher(): string {
    switch (process.platform) {
      case 'win32':
        return 'cmd';
      case 'darwin':
        return 'open';
      case 'linux':
        return 'xdg-open';
      default:
        throw new Error(`Unsupported platform for Steam protocol: ${process.platform}`);
    }
  }

  /**
   * Set up event handlers
   */
  private setupEventHandlers(): void {
    this.launcher.on('launched', (event) => {
      console.log(`🎮 Steam game launched: ${event.gameId}`);
    });
    
    this.launcher.on('closed', (event) => {
      console.log(`🔴 Steam game closed: ${event.gameId} (${this.formatDuration(event.runtime)})`);
    });
    
    this.launcher.on('error', (event) => {
      console.error(`❌ Steam game error: ${event.gameId} - ${event.error.message}`);
    });
  }

  /**
   * Format duration in milliseconds
   */
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

  /**
   * Clean up resources
   */
  destroy(): void {
    console.log('🧹 Cleaning up Steam launcher...');
    this.launcher.destroy();
    this.steamGames.clear();
  }
}

// Type definitions
interface SteamGame {
  appId: string;
  name: string;
  installDir: string;
  installPath: string;
  executablePath: string | null;
  manifestPath: string;
}

interface SteamLaunchOptions {
  gameId?: string;
  launchMethod?: 'steam-protocol' | 'steam-executable' | 'direct-executable';
  gameArgs?: string[];
  steamArgs?: string[];
  env?: Record<string, string>;
  compatDataPath?: string; // For Linux/Proton
}

/**
 * Example usage of Steam integration
 */
async function steamIntegrationExample() {
  const steamLauncher = new SteamGameLauncher();
  
  try {
    // Initialize Steam integration
    await steamLauncher.initialize();
    
    // List available Steam games
    const games = steamLauncher.getSteamGames();
    console.log('\n📚 Available Steam Games:');
    games.slice(0, 10).forEach(game => {
      console.log(`   ${game.appId}: ${game.name}`);
    });
    
    if (games.length === 0) {
      console.log('   No Steam games found!');
      return;
    }
    
    // Launch a game (using the first available game as example)
    const gameToLaunch = games[0];
    console.log(`\n🚀 Launching: ${gameToLaunch.name} (${gameToLaunch.appId})`);
    
    const gameId = await steamLauncher.launchSteamGame(gameToLaunch.appId, {
      gameId: 'steam-example-game',
      launchMethod: 'steam-protocol', // Try different methods
      gameArgs: [], // Add game-specific arguments if needed
    });
    
    console.log(`✅ Game launched with ID: ${gameId}`);
    console.log('⏳ Game is running... (close it manually to continue)');
    
    // Wait for game to close
    await new Promise(resolve => {
      steamLauncher.launcher.on('closed', (event) => {
        if (event.gameId === gameId) {
          resolve(undefined);
        }
      });
    });
    
  } catch (error) {
    console.error('💥 Steam integration example failed:', error.message);
  } finally {
    steamLauncher.destroy();
  }
}

// Popular Steam games for testing
const POPULAR_STEAM_GAMES = {
  'Counter-Strike 2': '730',
  'Dota 2': '570',
  'Team Fortress 2': '440',
  'Portal 2': '620',
  'Half-Life 2': '220',
  'Left 4 Dead 2': '550',
  'Garry\'s Mod': '4000',
  'Terraria': '105600',
  'Stardew Valley': '413150',
  'Among Us': '945360'
};

/**
 * Launch a specific popular game
 */
async function launchPopularGame(gameName: keyof typeof POPULAR_STEAM_GAMES) {
  const steamLauncher = new SteamGameLauncher();
  
  try {
    await steamLauncher.initialize();
    
    const appId = POPULAR_STEAM_GAMES[gameName];
    if (!steamLauncher.isSteamGameInstalled(appId)) {
      console.log(`❌ ${gameName} (${appId}) is not installed`);
      return;
    }
    
    console.log(`🚀 Launching ${gameName}...`);
    const gameId = await steamLauncher.launchSteamGame(appId);
    console.log(`✅ ${gameName} launched with ID: ${gameId}`);
    
  } catch (error) {
    console.error(`💥 Failed to launch ${gameName}:`, error.message);
  } finally {
    steamLauncher.destroy();
  }
}

// Run the example
if (require.main === module) {
  steamIntegrationExample()
    .then(() => {
      console.log('✨ Steam integration example completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Example failed:', error);
      process.exit(1);
    });
}

export { SteamGameLauncher, steamIntegrationExample, launchPopularGame, POPULAR_STEAM_GAMES };
```

## Usage

### Basic Steam Game Launch

```typescript
import { SteamGameLauncher } from './steam-integration';

async function launchSteamGame() {
  const steamLauncher = new SteamGameLauncher();
  
  try {
    await steamLauncher.initialize();
    
    // Launch Counter-Strike 2
    const gameId = await steamLauncher.launchSteamGame('730', {
      launchMethod: 'steam-protocol'
    });
    
    console.log(`Game launched: ${gameId}`);
    
  } finally {
    steamLauncher.destroy();
  }
}
```

### Launch with Custom Parameters

```typescript
// Launch with specific game arguments
const gameId = await steamLauncher.launchSteamGame('730', {
  gameId: 'cs2-competitive',
  launchMethod: 'steam-executable',
  gameArgs: ['-console', '-novid', '+exec autoexec.cfg'],
  steamArgs: ['-silent']
});
```

### Direct Executable Launch

```typescript
// Bypass Steam and launch game directly
const gameId = await steamLauncher.launchSteamGame('620', {
  launchMethod: 'direct-executable',
  gameArgs: ['-windowed', '-width', '1920', '-height', '1080']
});
```

## Launch Methods

### 1. Steam Protocol (Recommended)

**Pros:**
- Works with Steam overlay
- Handles Steam authentication
- Respects Steam settings
- Works with all Steam features

**Cons:**
- Requires Steam to be running
- Less control over launch process

```typescript
const gameId = await steamLauncher.launchSteamGame('appId', {
  launchMethod: 'steam-protocol'
});
```

### 2. Steam Executable

**Pros:**
- More control over Steam parameters
- Can pass Steam-specific arguments
- Works when Steam isn't running

**Cons:**
- May start Steam if not running
- Platform-specific behavior

```typescript
const gameId = await steamLauncher.launchSteamGame('appId', {
  launchMethod: 'steam-executable',
  steamArgs: ['-silent', '-no-browser']
});
```

### 3. Direct Executable

**Pros:**
- Fastest launch time
- Complete control over process
- Works without Steam running

**Cons:**
- No Steam overlay
- No Steam achievements
- May not work with DRM-protected games

```typescript
const gameId = await steamLauncher.launchSteamGame('appId', {
  launchMethod: 'direct-executable',
  gameArgs: ['-windowed']
});
```

## Platform-Specific Considerations

### Windows

```typescript
// Windows-specific Steam detection
const steamPath = 'C:\\Program Files (x86)\\Steam';
const steamExe = path.join(steamPath, 'steam.exe');

// Registry-based detection
const registryPath = 'HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432Node\\Valve\\Steam';
```

### Linux (with Proton)

```typescript
// Linux with Proton compatibility
const gameId = await steamLauncher.launchSteamGame('appId', {
  launchMethod: 'steam-executable',
  env: {
    STEAM_COMPAT_DATA_PATH: '/home/user/.steam/steam/steamapps/compatdata',
    PROTON_USE_WINED3D: '1'
  }
});
```

### macOS

```typescript
// macOS Steam detection
const steamPath = '/Applications/Steam.app/Contents/MacOS';
const steamExe = path.join(steamPath, 'steam_osx');
```

## Advanced Features

### Game Discovery

```typescript
// Find games by name
const games = steamLauncher.getSteamGames();
const portalGames = games.filter(game => 
  game.name.toLowerCase().includes('portal')
);

// Check if specific game is installed
if (steamLauncher.isSteamGameInstalled('620')) {
  console.log('Portal 2 is installed!');
}
```

### Batch Operations

```typescript
// Launch multiple games
const gameIds = ['730', '570', '440']; // CS2, Dota 2, TF2
const launchedGames = [];

for (const appId of gameIds) {
  if (steamLauncher.isSteamGameInstalled(appId)) {
    try {
      const gameId = await steamLauncher.launchSteamGame(appId);
      launchedGames.push(gameId);
      
      // Wait between launches
      await new Promise(resolve => setTimeout(resolve, 5000));
    } catch (error) {
      console.error(`Failed to launch ${appId}:`, error.message);
    }
  }
}
```

### Game Monitoring

```typescript
// Monitor all Steam games
steamLauncher.launcher.on('launched', (event) => {
  if (event.gameId.startsWith('steam-')) {
    console.log(`Steam game started: ${event.gameId}`);
    
    // Start monitoring game-specific metrics
    startGameMetrics(event.gameId);
  }
});

steamLauncher.launcher.on('closed', (event) => {
  if (event.gameId.startsWith('steam-')) {
    console.log(`Steam game ended: ${event.gameId}`);
    console.log(`Session time: ${formatDuration(event.runtime)}`);
    
    // Save session data
    saveGameSession(event);
  }
});
```

## Error Handling

### Common Steam Errors

```typescript
try {
  await steamLauncher.launchSteamGame(appId);
} catch (error) {
  if (error.message.includes('Steam installation not found')) {
    console.error('❌ Steam is not installed');
    // Prompt user to install Steam
  } else if (error.message.includes('not installed')) {
    console.error('❌ Game is not installed in Steam');
    // Redirect to Steam store page
  } else if (error.message.includes('timeout')) {
    console.error('❌ Game took too long to start');
    // Retry with longer timeout
  } else {
    console.error('❌ Unknown Steam error:', error.message);
  }
}
```

### Retry Logic

```typescript
async function launchWithRetry(appId: string, maxRetries = 3): Promise<string> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await steamLauncher.launchSteamGame(appId);
    } catch (error) {
      console.warn(`Launch attempt ${attempt} failed:`, error.message);
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
    }
  }
  
  throw new Error('All retry attempts failed');
}
```

## Performance Optimization

### Lazy Loading

```typescript
// Load games on demand
class OptimizedSteamLauncher extends SteamGameLauncher {
  private gamesLoaded = false;
  
  async ensureGamesLoaded(): Promise<void> {
    if (!this.gamesLoaded) {
      await this.loadSteamGames();
      this.gamesLoaded = true;
    }
  }
  
  async launchSteamGame(appId: string, options?: SteamLaunchOptions): Promise<string> {
    await this.ensureGamesLoaded();
    return super.launchSteamGame(appId, options);
  }
}
```

### Caching

```typescript
// Cache Steam game data
class CachedSteamLauncher extends SteamGameLauncher {
  private cacheFile = path.join(os.tmpdir(), 'steam-games-cache.json');
  
  async loadSteamGames(): Promise<void> {
    try {
      // Try to load from cache first
      const cached = await this.loadFromCache();
      if (cached && this.isCacheValid(cached)) {
        this.steamGames = new Map(cached.games);
        return;
      }
    } catch {
      // Cache load failed, continue with normal loading
    }
    
    // Load normally and cache results
    await super.loadSteamGames();
    await this.saveToCache();
  }
  
  private async loadFromCache(): Promise<any> {
    const content = await fs.readFile(this.cacheFile, 'utf-8');
    return JSON.parse(content);
  }
  
  private isCacheValid(cached: any): boolean {
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    return (Date.now() - cached.timestamp) < maxAge;
  }
  
  private async saveToCache(): Promise<void> {
    const cacheData = {
      timestamp: Date.now(),
      games: Array.from(this.steamGames.entries())
    };
    
    await fs.writeFile(this.cacheFile, JSON.stringify(cacheData, null, 2));
  }
}
```

## Troubleshooting

### Steam Not Detected

1. **Check installation paths**: Verify Steam is installed in standard locations
2. **Registry check (Windows)**: Ensure Steam registry entries exist
3. **Permissions**: Verify read access to Steam directories

### Games Not Loading

1. **Manifest files**: Check if `.acf` files exist in steamapps
2. **Library folders**: Verify `libraryfolders.vdf` is readable
3. **Permissions**: Ensure access to Steam library directories

### Launch Failures

1. **Steam running**: Ensure Steam client is running for protocol launches
2. **Game installed**: Verify game is actually installed
3. **DRM protection**: Some games require Steam to be running

### Platform Issues

1. **Linux**: Install `xdg-utils` for protocol handling
2. **macOS**: Ensure Steam.app is in Applications folder
3. **Windows**: Check UAC settings for Steam access

## Next Steps

After mastering Steam integration, explore:

1. **[Game Library Manager](game-library-manager.md)** - Complete game management
2. **[Playtime Tracker](playtime-tracker.md)** - Track Steam game sessions
3. **[Multiple Games](multiple-games.md)** - Managing multiple Steam games

## Related Examples

- **[Simple Launcher](simple-launcher.md)** - Basic game launching
- **[Event Handling](event-handling.md)** - Advanced event management
- **[Platform-Specific Examples](windows-games.md)** - Platform considerations

---

**Ready to launch your Steam library! 🎮**
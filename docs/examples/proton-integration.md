# Proton Integration Example

## Overview

This example demonstrates how to use the Game Launcher library with Proton integration to run Windows games on Linux systems. Proton is a compatibility layer that allows Windows games to run on Linux, developed by Valve for Steam.

## Prerequisites

- **Linux operating system** (Proton is Linux-only)
- **Node.js** 16.0.0 or higher
- **Game Launcher library** with Proton support
- **Proton builds** installed (Proton-GE, Steam Proton, etc.)
- **Steam** (optional, for automatic Proton detection)

## Proton Variants Supported

- **proton-ge** - GloriousEggroll's Proton builds (recommended)
- **proton-experimental** - Valve's experimental Proton builds
- **proton-stable** - Valve's stable Proton releases
- **wine-ge** - GloriousEggroll's Wine builds

## Installation

### 1. Install the Game Launcher Library

```bash
npm install game-launcher
```

### 2. Install Proton Builds

#### Option A: Using Steam (Automatic)
Proton builds installed through Steam are automatically detected.

#### Option B: Manual Installation
```bash
# Download and extract Proton-GE to ~/.steam/compatibilitytools.d/
mkdir -p ~/.steam/compatibilitytools.d/
cd ~/.steam/compatibilitytools.d/
wget https://github.com/GloriousEggroll/proton-ge-custom/releases/download/GE-Proton8-26/GE-Proton8-26.tar.gz
tar -xzf GE-Proton8-26.tar.gz
```

## Basic Configuration

```typescript
import { GameLauncher } from 'game-launcher';
import type { ProtonVariant } from 'game-launcher';

const launcher = new GameLauncher({
  // Enable Proton support
  proton: {
    enabled: true,
    autoDetect: true,
    preferredVariant: 'proton-ge' as ProtonVariant,
    // Optional: custom installation path
    // installPath: '/custom/proton/path',
    // Optional: default version to use
    // defaultVersion: '8.0-5'
  },
  logging: {
    enabled: true,
    config: {
      level: 1, // INFO level
      enableConsole: true
    }
  }
});
```

## Complete Example

```typescript
import { GameLauncher } from 'game-launcher';
import type { ProtonVariant } from 'game-launcher';

async function protonExample() {
  // Initialize GameLauncher with Proton support
  const launcher = new GameLauncher({
    proton: {
      enabled: true,
      autoDetect: true,
      preferredVariant: 'proton-ge' as ProtonVariant
    },
    logging: { enabled: true }
  });

  // Check if Proton is available
  if (!launcher.isProtonAvailable()) {
    console.log('Proton is not available on this system');
    return;
  }

  const protonManager = launcher.getProtonManager();
  if (!protonManager) {
    console.log('ProtonManager not initialized');
    return;
  }

  try {
    // List available Proton versions
    console.log('Available Proton versions:');
    const versions = await protonManager.listAvailableProtonVersions();
    
    for (const [variant, versionList] of Object.entries(versions)) {
      console.log(`\n${variant}:`);
      versionList.slice(0, 3).forEach(version => {
        console.log(`  ${version.version} - ${version.installed ? 'Installed' : 'Available'}`);
      });
    }

    // Example 1: Launch with default Proton settings
    console.log('\nLaunching game with default Proton settings...');
    const game1 = await launcher.launchGame({
      gameId: 'windows-game-1',
      executable: '/path/to/windows/game.exe',
      args: ['-windowed'],
      proton: {
        enabled: true
        // Uses preferred variant and auto-selects version
      }
    });
    console.log(`Game launched: ${game1.id}`);

    // Example 2: Launch with specific Proton configuration
    console.log('\nLaunching game with specific Proton configuration...');
    const game2 = await launcher.launchGame({
      gameId: 'windows-game-2',
      executable: '/path/to/another/game.exe',
      proton: {
        enabled: true,
        variant: 'proton-experimental' as ProtonVariant,
        version: 'bleeding-edge',
        customArgs: ['-force-d3d11'],
        winePrefix: '/home/user/.wine-prefixes/game2'
      },
      environment: {
        DXVK_HUD: 'fps',
        PROTON_LOG: '1'
      }
    });
    console.log(`Game 2 launched: ${game2.id}`);

    // Example 3: Install a new Proton version
    console.log('\nInstalling new Proton version...');
    const installResult = await protonManager.installProtonVersion({
      variant: 'proton-ge',
      version: '8.0-5',
      force: false
    });

    if (installResult.success) {
      console.log(`Successfully installed ${installResult.variant} ${installResult.version}`);
    } else {
      console.log(`Installation failed: ${installResult.error}`);
    }

    // Monitor running games
    setInterval(() => {
      const runningGames = launcher.getRunningGames();
      if (runningGames.length > 0) {
        console.log(`Running games: ${runningGames.join(', ')}`);
      }
    }, 5000);

    // Event handling
    launcher.on('gameStarted', (gameId) => {
      console.log(`Game started: ${gameId}`);
    });

    launcher.on('gameExited', (gameId, exitCode) => {
      console.log(`Game exited: ${gameId} (code: ${exitCode})`);
    });

    launcher.on('gameError', (gameId, error) => {
      console.error(`Game error: ${gameId} - ${error}`);
    });

  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the example
protonExample();
```

## Configuration Options

### GameLauncher Proton Options

```typescript
interface ProtonOptions {
  /** Enable Proton support */
  enabled?: boolean;
  /** Auto-detect installed Proton builds */
  autoDetect?: boolean;
  /** Preferred Proton variant */
  preferredVariant?: ProtonVariant;
  /** Custom Proton installation path */
  installPath?: string;
  /** Default Proton version to use */
  defaultVersion?: string;
}
```

### Launch Game Proton Options

```typescript
interface ProtonLaunchOptions {
  /** Enable Proton for this game launch */
  enabled?: boolean;
  /** Specific Proton variant to use */
  variant?: ProtonVariant;
  /** Specific Proton version to use */
  version?: string;
  /** Custom Proton arguments */
  customArgs?: string[];
  /** Wine prefix path for this game */
  winePrefix?: string;
}
```

## Advanced Usage

### Custom Wine Prefixes

```typescript
// Create separate Wine prefixes for different games
const game = await launcher.launchGame({
  gameId: 'my-game',
  executable: '/path/to/game.exe',
  proton: {
    enabled: true,
    winePrefix: '/home/user/.wine-prefixes/my-game'
  }
});
```

### Environment Variables

```typescript
// Common Proton environment variables
const game = await launcher.launchGame({
  gameId: 'my-game',
  executable: '/path/to/game.exe',
  proton: { enabled: true },
  environment: {
    // DXVK settings
    DXVK_HUD: 'fps,memory',
    DXVK_LOG_LEVEL: 'info',
    
    // Proton settings
    PROTON_USE_WINED3D: '1',
    PROTON_NO_D3D11: '0',
    PROTON_NO_D3D12: '0',
    PROTON_LOG: '1',
    
    // Wine settings
    WINEDEBUG: '-all',
    WINE_CPU_TOPOLOGY: '4:2'
  }
});
```

### Version Management

```typescript
// List all available versions
const versions = await protonManager.listAvailableProtonVersions();

// Install specific version
const result = await protonManager.installProtonVersion({
  variant: 'proton-ge',
  version: '8.0-5'
});

// Remove version
const removeResult = await protonManager.removeProtonVersion({
  variant: 'proton-ge',
  version: '7.0-6'
});
```

## Troubleshooting

### Common Issues

1. **Proton not detected**
   ```bash
   # Check if Proton is installed
   ls ~/.steam/compatibilitytools.d/
   ls ~/.steam/steam/compatibilitytools.d/
   ```

2. **Game won't start**
   - Check game executable path
   - Verify Proton version compatibility
   - Enable Proton logging: `PROTON_LOG=1`

3. **Performance issues**
   - Try different Proton variants
   - Adjust DXVK settings
   - Use appropriate Wine prefix

### Debug Logging

```typescript
const launcher = new GameLauncher({
  proton: { enabled: true },
  logging: {
    enabled: true,
    config: {
      level: 0, // DEBUG level
      enableConsole: true
    }
  }
});
```

### Environment Variables for Debugging

```bash
# Enable all Proton logging
export PROTON_LOG=1
export WINEDEBUG=+all

# DXVK debugging
export DXVK_LOG_LEVEL=debug
export DXVK_HUD=full
```

## Platform Compatibility

- ✅ **Linux** - Full support
- ❌ **Windows** - Not applicable (use native Windows games)
- ❌ **macOS** - Not supported (Proton is Linux-only)

## Performance Tips

1. **Use Proton-GE** for better game compatibility
2. **Create separate Wine prefixes** for different games
3. **Enable DXVK** for better DirectX performance
4. **Adjust CPU topology** with `WINE_CPU_TOPOLOGY`
5. **Use appropriate Proton version** for each game

## Related Examples

- [Linux Games](linux-games.md) - Native Linux gaming
- [Steam Integration](steam-integration.md) - Steam game management
- [Multiple Games](multiple-games.md) - Managing multiple games

## External Resources

- [Proton-GE Releases](https://github.com/GloriousEggroll/proton-ge-custom/releases)
- [ProtonDB](https://www.protondb.com/) - Game compatibility database
- [DXVK Documentation](https://github.com/doitsujin/dxvk)
- [Wine Documentation](https://wiki.winehq.org/)

---

**Note**: This example requires a Linux system with Proton installed. Proton functionality is automatically disabled on non-Linux platforms.
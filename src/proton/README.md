# Proton Management Module

This module provides comprehensive functionality for managing Proton compatibility layers in the game launcher. Proton is a Linux-only compatibility tool that allows running Windows games on Linux systems.

## Features

### Core Functionality
- **Version Detection**: Automatically detect installed Proton versions from Steam and manual installations
- **Version Fetching**: Retrieve available Proton versions from multiple sources (GitHub releases, etc.)
- **Installation Management**: Download, install, and remove Proton versions
- **Caching**: Intelligent caching system to reduce API calls and improve performance

### Supported Proton Variants
- **Proton GE (GloriousEggroll)**: Community-maintained Proton with additional patches
- **Proton Experimental**: Valve's experimental Proton builds
- **Steam Proton**: Official Proton versions distributed through Steam

## Usage

### Basic Setup

```typescript
import { ProtonManager } from './proton';

const protonManager = new ProtonManager();
```

### Check System Compatibility

```typescript
// Proton is only supported on Linux
if (protonManager.isProtonSupported()) {
    console.log('Proton is supported on this system');
}

// Check if installation is supported
if (protonManager.isInstallationSupported()) {
    console.log('Proton installation is supported');
}
```

### List Available Versions

```typescript
// Get all available Proton versions
const versions = await protonManager.listAvailableProtonVersions();
console.log('Available versions:', versions);

// Get latest version of a specific variant
const latest = await protonManager.getLatestVersion('proton-ge');
console.log('Latest Proton GE:', latest);
```

### Detect Installed Versions

```typescript
// Get all installed Proton builds
const installed = await protonManager.getInstalledProtonBuilds();
console.log('Installed builds:', installed);

// Get only Steam Proton builds
const steamBuilds = await protonManager.detectSteamProtonBuilds();
console.log('Steam Proton builds:', steamBuilds);

// Get manually installed builds
const manualBuilds = await protonManager.detectManualProtonBuilds();
console.log('Manual Proton builds:', manualBuilds);
```

### Install Proton Versions

```typescript
// Install a specific version
const installResult = await protonManager.installProtonVersion({
    variant: 'proton-ge',
    version: 'GE-Proton8-32',
    force: false // Don't reinstall if already exists
});

if (installResult.success) {
    console.log(`Installed at: ${installResult.installPath}`);
} else {
    console.error(`Installation failed: ${installResult.error}`);
}

// Install the latest version of a variant
const latestResult = await protonManager.installLatestVersion('proton-ge');
```

### Download Progress Tracking

The module provides comprehensive event-driven progress tracking for downloads and installations:

```typescript
// Set up progress tracking
protonManager.onInstallProgress((event) => {
    const progressBar = '█'.repeat(Math.floor(event.percentage / 5)) + '░'.repeat(20 - Math.floor(event.percentage / 5));
    const speedMB = (event.speed / 1024 / 1024).toFixed(1);
    const etaMin = Math.floor(event.estimatedTimeRemaining / 60);
    const etaSec = Math.floor(event.estimatedTimeRemaining % 60);
    
    process.stdout.write(`\r📊 [${progressBar}] ${event.percentage.toFixed(1)}% | ${speedMB} MB/s | ETA: ${etaMin}:${etaSec.toString().padStart(2, '0')}`);
});

// Track installation status changes
protonManager.onInstallStatus((event) => {
    switch (event.status) {
        case 'started':
            console.log(`🚀 Download started for ${event.variant} ${event.version}`);
            break;
        case 'downloading':
            console.log(`📥 ${event.message}`);
            break;
        case 'extracting':
            console.log(`📦 Extracting ${event.variant} ${event.version}...`);
            break;
        case 'completed':
            console.log(`✅ ${event.message}`);
            break;
        case 'failed':
            console.log(`❌ Download failed: ${event.error}`);
            break;
    }
});

// Handle installation completion
protonManager.onInstallComplete((event) => {
    console.log(`🎉 Installation completed: ${event.variant} ${event.version}`);
    console.log(`📁 Installed to: ${event.installPath}`);
});

// Handle installation errors
protonManager.onInstallError((event) => {
    console.error(`💥 Installation error: ${event.error}`);
});

// Start installation
const result = await protonManager.installProtonVersion({
    variant: 'proton-ge',
    version: 'GE-Proton8-32'
});

// Clean up event listeners when done
protonManager.removeAllInstallListeners();
```

### Event Types

#### Download Progress Event
```typescript
interface DownloadProgressEvent {
    variant: ProtonVariant;
    version: string;
    bytesDownloaded: number;
    totalBytes: number;
    percentage: number;
    speed: number; // bytes per second
    estimatedTimeRemaining: number; // seconds
}
```

#### Download Status Event
```typescript
interface DownloadStatusEvent {
    variant: ProtonVariant;
    version: string;
    status: 'started' | 'downloading' | 'extracting' | 'completed' | 'failed';
    message?: string;
    error?: string;
}
```

### Remove Proton Versions

```typescript
// Remove a specific version
const removeResult = await protonManager.removeProtonVersion({
    variant: 'proton-ge',
    version: 'GE-Proton8-32'
});

if (removeResult.success) {
    console.log('Successfully removed');
} else {
    console.error(`Removal failed: ${removeResult.error}`);
}
```

### Check Installation Status

```typescript
// Check if a specific version is installed
const status = await protonManager.getInstallationStatus('proton-ge', 'GE-Proton8-32');

if (status.installed) {
    console.log(`Installed at: ${status.installPath}`);
    console.log(`Install source: ${status.installSource}`);
} else {
    console.log('Not installed');
}
```

## Installation Paths

Proton versions are installed in the Steam compatibility tools directory:

- **Linux**: `~/.steam/root/compatibilitytools.d/`
- **Custom Steam**: `<steam_root>/compatibilitytools.d/`

## Error Handling

All installation and removal operations return result objects with success/error information:

```typescript
interface ProtonInstallResult {
    success: boolean;
    version: string;
    variant: ProtonVariant;
    installPath: string;
    error?: string;
}

interface ProtonRemoveResult {
    success: boolean;
    version: string;
    variant: ProtonVariant;
    removedPath: string;
    error?: string;
}
```

## Platform Support

- **Linux**: Full support for all features
- **Windows/macOS**: Detection and listing only (installation not supported)

## Caching

The module implements intelligent caching to improve performance:

- **Version Cache**: Available versions are cached for 5 minutes
- **Installation Cache**: Installed builds are cached for 5 minutes
- **Automatic Invalidation**: Caches are cleared after successful installations/removals

```typescript
// Manually refresh caches
await protonManager.refreshVersions();
protonManager.clearCache();
```

## Examples

See the examples directory for comprehensive usage demonstrations:

### `examples/installation-example.ts`
- Basic installation workflow with progress tracking
- Event-driven installation monitoring
- Error handling patterns
- Status checking and validation

### `examples/progress-tracking-example.ts`
- Advanced progress tracking with detailed statistics
- Custom progress bar implementations
- Batch installation with aggregated progress
- Retry mechanisms with exponential backoff
- Real-time download speed monitoring

### Key Example Features
- Real-time progress bars with ETA calculations
- Download speed tracking (current, peak, average)
- Event-driven architecture for responsive UIs
- Comprehensive error handling and recovery
- Batch operations with progress aggregation

## Architecture

The module is organized into several core classes:

- **ProtonManager**: Main interface for all Proton operations
- **ProtonDetector**: Handles detection of installed Proton builds
- **ProtonVersionFetcher**: Fetches available versions from remote sources
- **ProtonInstaller**: Handles installation and removal operations

## Dependencies

The module uses Node.js built-in modules and requires:

- `node:fs/promises` for file system operations
- `node:path` for path manipulation
- `node:os` for platform detection
- `node:https` for downloading files
- `tar` package for extracting archives

## Contributing

When adding new Proton variants or sources:

1. Update the `ProtonVariant` type in `@types/proton/index.ts`
2. Add detection logic in `ProtonDetector.ts`
3. Add fetching logic in `ProtonVersionFetcher.ts`
4. Add installation logic in `ProtonInstaller.ts`
5. Update tests and examples
# Proton Build-from-Source Support

This document describes the enhanced Proton installation system that supports building from source code distributions.

## Overview

The Proton installer now automatically detects whether a downloaded archive contains:
- **Pre-built binaries**: Ready-to-use Proton installations
- **Source code**: Requires compilation before use

When source code is detected, the installer can automatically configure, compile, and install Proton using the standard build process.

## Features

### Automatic Source Detection

The installer automatically detects source code by looking for:
- `Makefile` or `makefile`
- `configure.sh` or `configure`
- `CMakeLists.txt`
- Source directories: `src/`, `wine/`, `dxvk/`, etc.

### Build Process

When source code is detected and building is enabled, the installer:

1. **Configure**: Runs `./configure.sh` with optional custom arguments
2. **Compile**: Runs `make` with configurable parallel jobs
3. **Install**: Runs `make install` to finalize the installation

### Build Configuration

The build process is highly configurable through `ProtonBuildOptions`:

```typescript
interface ProtonBuildOptions {
  enableBuild?: boolean;        // Enable/disable building (default: false)
  buildTimeout?: number;        // Build timeout in milliseconds (default: 1 hour)
  makeJobs?: number;           // Parallel make jobs (default: CPU cores)
  configureArgs?: string[];    // Custom configure arguments
  makeArgs?: string[];         // Custom make arguments
}
```

## Usage Examples

### Basic Source Installation

```typescript
import { ProtonManager } from "./core/ProtonManager";

const protonManager = new ProtonManager();

// Install with basic build support
const result = await protonManager.installProtonVersion({
  variant: "proton-ge",
  version: "GE-Proton8-26",
  buildOptions: {
    enableBuild: true,
  },
});
```

### Advanced Build Configuration

```typescript
// Install with custom build options
const result = await protonManager.installProtonVersion({
  variant: "proton-ge",
  version: "GE-Proton8-26",
  buildOptions: {
    enableBuild: true,
    buildTimeout: 7200000,      // 2 hours
    makeJobs: 8,                // Use 8 CPU cores
    configureArgs: [
      "--enable-win64",
      "--enable-win32",
      "--with-vulkan",
    ],
    makeArgs: [
      "VERBOSE=1",
      "OPTIMIZATION=-O2",
    ],
  },
});
```

### Event Monitoring

```typescript
// Monitor build progress
protonManager.onBuildProgress((event) => {
  console.log(`[${event.step}] ${event.message}`);
});

// Monitor installation status
protonManager.onInstallStatus((event) => {
  switch (event.status) {
    case "building":
      console.log("🔨 Building from source...");
      break;
    case "completed":
      console.log("✅ Installation completed");
      break;
    case "failed":
      console.error("❌ Installation failed:", event.error);
      break;
  }
});
```

## Build Events

### Build Progress Events

```typescript
interface BuildProgressEvent {
  variant: ProtonVariant;
  version: string;
  step: "configure" | "make" | "install" | "error";
  message: string;
}
```

### Installation Status Events

```typescript
interface DownloadStatusEvent {
  status: "started" | "downloading" | "extracting" | "building" | "completed" | "failed";
  variant: ProtonVariant;
  version: string;
  message?: string;
  error?: string;
}
```

## Build Requirements

### System Dependencies

For successful compilation, ensure these tools are installed:

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install build-essential git cmake ninja-build
sudo apt install gcc-multilib g++-multilib
sudo apt install python3 python3-pip

# Arch Linux
sudo pacman -S base-devel git cmake ninja
sudo pacman -S gcc-multilib
sudo pacman -S python python-pip

# Fedora
sudo dnf groupinstall "Development Tools"
sudo dnf install git cmake ninja-build
sudo dnf install gcc-c++ glibc-devel.i686
sudo dnf install python3 python3-pip
```

### Wine Dependencies

For Wine-based builds:

```bash
# Ubuntu/Debian
sudo apt install libfreetype6-dev libfontconfig1-dev
sudo apt install libxrandr-dev libxinerama-dev libxcursor-dev
sudo apt install libxi-dev libxcomposite-dev libxss-dev

# Additional for 32-bit support
sudo apt install libfreetype6-dev:i386 libfontconfig1-dev:i386
```

### DXVK Dependencies

For DXVK compilation:

```bash
# Meson build system
pip3 install meson

# Vulkan development libraries
sudo apt install libvulkan-dev vulkan-validationlayers-dev
```

## Build Process Details

### Configure Step

```bash
./configure.sh [custom-args]
```

Common configure arguments:
- `--enable-win64`: Enable 64-bit Windows support
- `--enable-win32`: Enable 32-bit Windows support
- `--with-vulkan`: Enable Vulkan support
- `--with-dxvk`: Enable DXVK integration
- `--prefix=/path`: Set installation prefix

### Make Step

```bash
make -j[jobs] [custom-args]
```

Common make arguments:
- `VERBOSE=1`: Enable verbose output
- `OPTIMIZATION=-O2`: Set optimization level
- `CCACHE_DISABLE=1`: Disable ccache

### Install Step

```bash
make install
```

Installs the compiled Proton to the Steam compatibility tools directory.

## Troubleshooting

### Build Timeouts

If builds are timing out, increase the timeout:

```typescript
buildOptions: {
  enableBuild: true,
  buildTimeout: 10800000, // 3 hours
}
```

### Memory Issues

Reduce parallel jobs for systems with limited RAM:

```typescript
buildOptions: {
  enableBuild: true,
  makeJobs: 2, // Use fewer cores
}
```

### Missing Dependencies

Check build output for missing dependencies:

```typescript
protonManager.onBuildProgress((event) => {
  if (event.message.includes("error") || event.message.includes("not found")) {
    console.error("Build error:", event.message);
  }
});
```

### Configure Failures

Add debug flags to configure:

```typescript
buildOptions: {
  enableBuild: true,
  configureArgs: ["--enable-debug", "--verbose"],
}
```

## Performance Considerations

### Build Time

- **Small builds**: 30-60 minutes
- **Full Proton builds**: 1-3 hours
- **Complex builds with DXVK**: 2-4 hours

### Resource Usage

- **CPU**: High during compilation
- **Memory**: 2-8 GB depending on parallel jobs
- **Disk**: 5-15 GB for build artifacts

### Optimization Tips

1. **Use ccache**: Speeds up repeated builds
2. **Adjust parallel jobs**: Match your CPU cores
3. **Use SSD storage**: Faster I/O during compilation
4. **Close other applications**: Free up system resources

## Examples

See the complete examples in:
- `examples/build-from-source-example.ts`

Run the examples:

```bash
# Basic example
npx ts-node src/proton/examples/build-from-source-example.ts

# Or import in your code
import { demonstrateSourceBuild } from "./examples/build-from-source-example";
await demonstrateSourceBuild();
```

## API Reference

### ProtonManager Methods

- `installProtonVersion(options)`: Install with build support
- `onBuildProgress(listener)`: Monitor build progress
- `onInstallStatus(listener)`: Monitor installation status
- `onDownloadProgress(listener)`: Monitor download progress

### ProtonInstaller Methods

- `detectSourceCode(extractPath)`: Check if directory contains source
- `buildFromSource(extractPath, options)`: Build from source code
- `runBuildStep(command, args, options)`: Execute build command

## Security Considerations

- Build processes run with user permissions
- Source code is extracted to temporary directories
- Build artifacts are cleaned up after installation
- No elevated privileges required for building

## Limitations

- **Linux only**: Building is only supported on Linux systems
- **Build dependencies**: Requires development tools to be installed
- **Build time**: Source builds take significantly longer than binary installs
- **Resource intensive**: Requires substantial CPU, memory, and disk space

## Future Enhancements

- **Docker builds**: Containerized build environments
- **Cross-compilation**: Build for different architectures
- **Build caching**: Cache compiled artifacts
- **Incremental builds**: Only rebuild changed components
- **Build profiles**: Predefined build configurations
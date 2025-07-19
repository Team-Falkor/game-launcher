# Proton Detection Troubleshooting Guide

This guide helps you troubleshoot Proton detection issues in the Game Launcher.

## Recent Fix

We've improved the Proton detection logic to handle various naming patterns and provide better fallback mechanisms. The fix addresses the common issue where GE-Proton builds are not found even when they exist.

### What Was Fixed

1. **Enhanced Directory Name Generation**: The system now tries multiple possible directory name patterns for GE-Proton builds:
   - Exact version match (e.g., "GE-Proton10-9")
   - Version with prefix variations (e.g., "GE-Proton-10-9", "GE-Proton10-9")
   - Version without prefix (e.g., "10-9")
   - Common naming variations

2. **Fallback Detection**: If direct directory search fails, the system now falls back to using the ProtonManager's comprehensive detection system.

3. **Better Logging**: Added detailed debug logging to help identify detection issues.

## Testing the Fix

Run the test script to verify the fix works:

```bash
# Using Bun (recommended)
bun run test-fix.ts

# Using Node.js
npx tsx test-fix.ts
```

Or run the debug script for detailed information:

```bash
bun run debug-proton.ts
```

## Common Issues and Solutions

### 1. "Proton [version] not found" Error

**Symptoms**: Error message like "Proton proton-ge GE-Proton10-9 not found"

**Solutions**:

1. **Check if Proton is actually installed**:
   ```bash
   ls ~/.steam/compatibilitytools.d/
   ls ~/.steam/steam/compatibilitytools.d/
   ```

2. **Verify the exact directory name**:
   ```bash
   find ~/.steam -name "*GE-Proton*" -type d 2>/dev/null
   ```

3. **Use the debug script** to see what builds are detected:
   ```bash
   bun run debug-proton.ts
   ```

4. **Try using the exact version name** as detected by the system.

### 2. No Proton Builds Detected

**Symptoms**: Empty list when checking for installed builds

**Solutions**:

1. **Ensure you're on Linux**: Proton only works on Linux systems.

2. **Install GE-Proton**:
   - Download from [GloriousEggroll/proton-ge-custom](https://github.com/GloriousEggroll/proton-ge-custom/releases)
   - Extract to `~/.steam/compatibilitytools.d/`
   - Restart Steam

3. **Check Steam installation paths**:
   ```bash
   # Common Steam paths
   ls ~/.steam/
   ls ~/.local/share/Steam/
   ls /usr/share/steam/
   ```

### 3. Version Mismatch

**Symptoms**: The version you specify doesn't match what's detected

**Solutions**:

1. **Use auto-detection** instead of specifying a version:
   ```typescript
   const launcher = new GameLauncher({
     proton: {
       enabled: true,
       autoDetect: true,
       preferredVariant: "proton-ge"
       // Don't specify defaultVersion
     }
   });
   ```

2. **Check available versions** using the debug script and use the exact version string.

## Configuration Examples

### Auto-Detection (Recommended)

```typescript
const launcher = new GameLauncher({
  proton: {
    enabled: true,
    autoDetect: true,
    preferredVariant: "proton-ge"
  },
  logging: {
    enabled: true,
    config: { level: 1 } // INFO level
  }
});
```

### Specific Version

```typescript
const launcher = new GameLauncher({
  proton: {
    enabled: true,
    preferredVariant: "proton-ge",
    defaultVersion: "GE-Proton10-9" // Use exact version from detection
  }
});
```

### Debug Mode

```typescript
const launcher = new GameLauncher({
  proton: {
    enabled: true,
    autoDetect: true,
    preferredVariant: "proton-ge"
  },
  logging: {
    enabled: true,
    config: {
      level: 0, // DEBUG level
      enableConsole: true
    }
  }
});
```

## Manual Installation Verification

To manually verify your Proton installation:

1. **Check directory structure**:
   ```bash
   ls -la ~/.steam/compatibilitytools.d/GE-Proton*/
   ```

2. **Verify proton executable exists**:
   ```bash
   ls -la ~/.steam/compatibilitytools.d/GE-Proton*/proton
   ```

3. **Test proton executable**:
   ```bash
   ~/.steam/compatibilitytools.d/GE-Proton*/proton --version
   ```

## Getting Help

If you're still experiencing issues:

1. **Run the debug script** and share the output
2. **Check the logs** with debug level enabled
3. **Verify your Proton installation** manually
4. **Share your system information**: OS, Steam version, Proton version

## Files Created for Debugging

- `debug-proton.ts`: Comprehensive Proton detection debugging
- `test-fix.ts`: Test script to verify the fix works
- This troubleshooting guide

These files can be safely deleted after resolving your issues.
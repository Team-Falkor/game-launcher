# Game Launcher

> Cross-platform Node.js utility package for managing game processes

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![Cross Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)](#platform-support)

## Overview

Game Launcher is a robust, cross-platform Node.js library designed for managing game processes with advanced monitoring capabilities. It provides a comprehensive solution for launching, monitoring, and managing game applications with real-time event handling and process lifecycle management.

## ✨ Features

- **🚀 Cross-Platform Support** - Works seamlessly on Windows, macOS, and Linux
- **🎮 Game Process Management** - Launch, monitor, and terminate game processes
- **📡 Real-time Events** - Comprehensive event system for process lifecycle
- **⏱️ Process Monitoring** - Built-in monitoring for detached GUI applications
- **🔧 Flexible Configuration** - Customizable options for different use cases
- **📊 Resource Tracking** - Monitor process status, playtime, and resource usage
- **🛡️ Error Handling** - Robust error handling and recovery mechanisms
- **📝 TypeScript Support** - Full TypeScript definitions included

## 📦 Installation

```bash
npm install game-launcher
# or
yarn add game-launcher
# or
pnpm add game-launcher
```

## 🚀 Quick Start

```typescript
import GameLauncher from 'game-launcher';

// Create launcher instance
const launcher = new GameLauncher({
  maxConcurrentGames: 5,
  enableProcessMonitoring: true,
  monitoringInterval: 1000
});

// Set up event listeners
launcher.on('launched', (data) => {
  console.log(`Game launched: ${data.gameId} (PID: ${data.pid})`);
});

launcher.on('closed', (data) => {
  console.log(`Game closed: ${data.gameId} (Exit code: ${data.exitCode})`);
});

// Launch a game
const gameId = await launcher.launchGame({
  gameId: 'my-game',
  executable: '/path/to/game.exe',
  args: ['--fullscreen', '--level=1'],
  workingDirectory: '/path/to/game',
  captureOutput: true
});

// Check if game is running
if (launcher.isGameRunning('my-game')) {
  console.log('Game is running!');
}

// Close the game
await launcher.closeGame('my-game');
```

## 📚 Documentation

### Core Documentation
- [API Reference](./api/README.md) - Complete API documentation
- [Configuration Guide](./guides/configuration.md) - Configuration options and best practices
- [Event System](./guides/events.md) - Understanding the event system
- [Process Management](./guides/process-management.md) - Process lifecycle and monitoring

### Guides & Examples
- [Getting Started](./guides/getting-started.md) - Step-by-step setup guide
- [Basic Usage](./examples/basic-usage.md) - Simple examples and use cases
- [Advanced Usage](./examples/advanced-usage.md) - Complex scenarios and patterns
- [Platform-Specific Notes](./guides/platform-specific.md) - Platform considerations
- [Troubleshooting](./guides/troubleshooting.md) - Common issues and solutions

### API Reference
- [GameLauncher Class](./api/GameLauncher.md) - Main launcher class
- [Events](./api/events.md) - Event types and data structures
- [Types](./api/types.md) - TypeScript interfaces and types
- [Utilities](./api/utilities.md) - Helper functions and utilities

## 🎯 Use Cases

- **Game Launchers** - Build custom game launchers with process management
- **Game Development Tools** - Integrate into development workflows
- **System Administration** - Manage game server processes
- **Testing Frameworks** - Automate game testing scenarios
- **Performance Monitoring** - Track game performance and resource usage
- **Playtime Tracking** - Monitor and log game session durations

## 🌍 Platform Support

| Platform | Status | Notes |
|----------|--------|---------|
| Windows | ✅ Full Support | Native process management with tasklist |
| macOS | ✅ Full Support | Unix-style process management |
| Linux | ✅ Full Support | Unix-style process management |
| Other Unix | ⚠️ Limited | Basic functionality available |

## 🔧 Requirements

- **Node.js**: 18.0.0 or higher
- **TypeScript**: 5.0.0 or higher (for TypeScript projects)
- **Operating System**: Windows 10+, macOS 10.15+, or Linux (any modern distribution)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](../LICENSE) file for details.

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](../CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## 📞 Support

If you encounter any issues or have questions:

1. Check the [Troubleshooting Guide](./guides/troubleshooting.md)
2. Search existing [GitHub Issues](https://github.com/your-org/game-launcher/issues)
3. Create a new issue with detailed information

## 🚀 What's Next?

Explore the documentation to learn more:

- Start with the [Getting Started Guide](./guides/getting-started.md)
- Check out [Basic Usage Examples](./examples/basic-usage.md)
- Review the [API Reference](./api/README.md) for detailed information

---

**Happy Gaming! 🎮**
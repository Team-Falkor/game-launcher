<div align="center">
  <img src="https://raw.githubusercontent.com/Team-Falkor/falkor/refs/heads/master/public/icon.png" alt="Game Launcher" width="128" height="128">
  
  # Game Launcher
  
  **A powerful and flexible Node.js library for launching and managing game processes across different platforms**
  
  [![npm version](https://badge.fury.io/js/@team-falkor%2Fgame-launcher.svg)](https://badge.fury.io/js/@team-falkor%2Fgame-launcher)
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
  [![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
  [![Platform Support](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)]()
  
</div>

---

## ✨ Features

- 🖥️ **Cross-Platform Support** - Works seamlessly on Windows, macOS, and Linux
- 🎮 **Process Management** - Launch, monitor, and control game processes with precision
- ⚡ **Event-Driven Architecture** - Real-time events for complete game lifecycle tracking
- 🎯 **Steam Integration** - Built-in support for Steam games and platform detection
- ⚙️ **Configuration Management** - Flexible, environment-aware configuration system
- 📘 **TypeScript Support** - Full TypeScript definitions and IntelliSense support
- 🛡️ **Error Handling** - Robust error handling and automatic recovery mechanisms
- 📊 **Resource Monitoring** - Track memory, CPU usage, and system resources
- 🔄 **Hot Reloading** - Dynamic configuration updates without restarts
- 🎨 **Extensible Architecture** - Plugin-friendly design for custom implementations

## 🚀 Quick Start

### Installation

```bash
# Using npm
npm install @team-falkor/game-launcher

# Using yarn
yarn add @team-falkor/game-launcher

# Using bun
bun add @team-falkor/game-launcher
```

### Basic Usage

```typescript
import { GameLauncher } from '@team-falkor/game-launcher';

// Create a new launcher instance
const launcher = new GameLauncher({
  verbose: true
});

// Launch a game
const gameId = await launcher.launchGame({
  gameId: 'my-awesome-game',
  executable: '/path/to/game.exe',
  args: ['--windowed', '--resolution=1920x1080']
});

console.log(`🎮 Game launched with ID: ${gameId}`);

// Set up event listeners
launcher.on('launched', (event) => {
  console.log(`✅ Game ${event.gameId} started successfully`);
});

launcher.on('closed', (event) => {
  console.log(`🔴 Game ${event.gameId} closed (exit code: ${event.exitCode})`);
});

launcher.on('error', (event) => {
  console.error(`❌ Game ${event.gameId} encountered an error:`, event.error);
});
```

### Advanced Example

```typescript
import { GameLauncher } from '@team-falkor/game-launcher';

const launcher = new GameLauncher({
  verbose: true,
  maxConcurrentGames: 3
});

// Launch multiple games with different configurations
const games = [
  {
    gameId: 'steam-game',
    executable: 'steam://rungameid/123456',
    timeout: 30000
  },
  {
    gameId: 'local-game',
    executable: './games/local-game.exe',
    args: ['--debug'],
    cwd: './games',
    env: { GAME_MODE: 'development' }
  }
];

for (const game of games) {
  try {
    const gameId = await launcher.launchGame(game);
    console.log(`🚀 Launched ${game.gameId}: ${gameId}`);
  } catch (error) {
    console.error(`💥 Failed to launch ${game.gameId}:`, error.message);
  }
}

// Monitor running games
setInterval(() => {
  const runningGames = launcher.getRunningGames();
  console.log(`📊 Currently running: ${runningGames.length} games`);
}, 5000);
```

## 📚 Documentation

Explore our comprehensive documentation for detailed guides, examples, and API references:

### 🎯 Getting Started
- **[📖 Getting Started Guide](./docs/guides/getting-started.md)** - Complete setup and usage walkthrough
- **[⚙️ Configuration Guide](./docs/guides/configuration.md)** - Configuration options and patterns
- **[🏆 Best Practices](./docs/guides/best-practices.md)** - Recommended patterns and practices

### 🔧 API Reference
- **[📋 API Overview](./docs/api/README.md)** - Complete API documentation
- **[🎮 GameLauncher Class](./docs/api/GameLauncher.md)** - Main launcher class reference
- **[📡 Events System](./docs/api/events.md)** - Event types and handling
- **[📝 Type Definitions](./docs/api/types.md)** - TypeScript interfaces and types
- **[🛠️ Utilities](./docs/api/utilities.md)** - Helper functions and utilities

### 💡 Examples
- **[📁 Examples Overview](./docs/examples/README.md)** - All available examples
- **[🎮 Simple Launcher](./docs/examples/simple-launcher.md)** - Basic game launching
- **[📡 Event Handling](./docs/examples/event-handling.md)** - Advanced event patterns
- **[🎯 Steam Integration](./docs/examples/steam-integration.md)** - Steam platform integration
- **[🎪 Multiple Games](./docs/examples/multiple-games.md)** - Managing multiple games
- **[⏱️ Playtime Tracker](./docs/examples/playtime-tracker.md)** - Track and analyze playtime
- **[📚 Game Library Manager](./docs/examples/game-library-manager.md)** - Comprehensive library management
- **[🌐 Cross-Platform](./docs/examples/cross-platform.md)** - Platform compatibility handling
- **[⚙️ Configuration Management](./docs/examples/configuration-management.md)** - Advanced configuration patterns

## 🎯 Use Cases

### 🎮 Game Launchers
Build custom game launcher applications with modern UI frameworks like Electron, Tauri, or web-based interfaces.

### 📚 Game Management
Organize and launch extensive game collections with metadata, categories, and search functionality.

### 🛠️ Development Tools
Create development and testing tools for game developers, including automated testing and deployment pipelines.

### 🤖 Automation
Automate game testing, performance benchmarking, and continuous integration workflows.

### 📊 Monitoring & Analytics
Track game performance, usage statistics, and system resource consumption for optimization.

### 🔗 Integration
Integrate games into larger applications, Discord bots, streaming platforms, or content management systems.

## 🖥️ Platform Support

| Platform | Status | Features | Notes |
|----------|--------|----------|-------|
| **Windows** | ✅ Full Support | Native process management, Registry integration, UAC handling | Supports .exe, .bat, .cmd files |
| **macOS** | ✅ Full Support | App bundle support, Permission handling, Spotlight integration | Supports .app bundles, .command files |
| **Linux** | ✅ Full Support | AppImage support, Desktop entries, Display server detection | Supports AppImage, .desktop files |

### Platform-Specific Features

- **Windows**: Registry game detection, Windows Store app support, UAC elevation
- **macOS**: Info.plist parsing, Gatekeeper compatibility, Accessibility permissions
- **Linux**: Desktop file parsing, Wayland/X11 detection, Flatpak/Snap support

## 📋 Requirements

### System Requirements
- **Node.js**: 16.0.0 or higher
- **TypeScript**: 4.5+ (for TypeScript projects)
- **Memory**: 512MB RAM minimum
- **Storage**: 50MB for library and dependencies

### Platform Requirements
- **Windows**: Windows 10 or higher
- **macOS**: macOS 10.15 (Catalina) or higher
- **Linux**: Any modern distribution with glibc 2.17+

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Game Launcher Library                    │
├─────────────────────────────────────────────────────────────┤
│  🎮 GameLauncher  │  📡 EventEmitter  │  ⚙️ ConfigManager  │
├─────────────────────────────────────────────────────────────┤
│  🔧 ProcessManager │  🛠️ Utilities     │  📊 Monitoring     │
├─────────────────────────────────────────────────────────────┤
│  🖥️ Platform Layer │  🎯 Steam API     │  📁 File System    │
└─────────────────────────────────────────────────────────────┘
```

## 🤝 Contributing

**We actively welcome and encourage contributions from the community!** Whether you're a seasoned developer or just getting started, there are many ways to help improve the Game Launcher library.

### 🌟 Ways to Contribute

#### 🐛 **Bug Reports & Feature Requests**
- Use our [issue templates](https://github.com/team-falkor/game-launcher/issues/new/choose) for consistent reporting
- Provide detailed reproduction steps and system information
- Include logs, error messages, and expected vs. actual behavior
- Search existing issues before creating new ones

#### 💻 **Code Contributions**
- **Bug fixes** - Help resolve open issues
- **New features** - Implement requested functionality
- **Performance improvements** - Optimize existing code
- **Platform support** - Enhance cross-platform compatibility
- **Test coverage** - Add unit, integration, or end-to-end tests

#### 📝 **Documentation**
- Improve existing documentation clarity
- Add new examples and use cases
- Create tutorials and guides
- Fix typos and formatting issues
- Translate documentation to other languages

#### 🎨 **Community Support**
- Help answer questions in discussions
- Review pull requests
- Share your projects using the library
- Provide feedback on proposed changes

### 🚀 Getting Started

#### **First-time Contributors**
Look for issues labeled `good first issue` or `help wanted` - these are perfect starting points!

#### **Development Setup**
```bash
# Fork the repository on GitHub, then clone your fork
git clone https://github.com/YOUR-USERNAME/game-launcher.git
cd game-launcher

# Install dependencies
npm install

# Create a new branch for your feature/fix
git checkout -b feature/your-feature-name

# Make your changes and test them
npm test
npm run build

# Commit your changes with a descriptive message
git commit -m "feat: add support for new game platform"

# Push to your fork and create a pull request
git push origin feature/your-feature-name
```

### 📋 Contribution Guidelines

#### **Code Standards**
- Follow the existing code style and conventions
- Write clear, self-documenting code with appropriate comments
- Ensure all tests pass and add new tests for your changes
- Update documentation for any API changes

#### **Pull Request Process**
1. **Fork** the repository and create a feature branch
2. **Make** your changes with clear, atomic commits
3. **Test** your changes thoroughly across platforms
4. **Update** documentation and examples if needed
5. **Submit** a pull request with a clear description
6. **Respond** to feedback and iterate as needed

#### **Commit Message Format**
We use [Conventional Commits](https://www.conventionalcommits.org/):
```
type(scope): description

feat(launcher): add Steam game detection
fix(process): resolve memory leak in game monitoring
docs(examples): add cross-platform configuration guide
```

### 🎯 Priority Areas

We're especially looking for help with:
- **🖥️ Platform-specific optimizations** (Windows, macOS, Linux)
- **🎮 Game platform integrations** (Epic Games, GOG, etc.)
- **🧪 Test coverage improvements**
- **📚 Documentation and examples**
- **🌐 Internationalization support**
- **♿ Accessibility features**

### 💬 Questions?

Don't hesitate to ask! We're here to help:
- **💭 Start a [Discussion](https://github.com/team-falkor/game-launcher/discussions)** for general questions
- **🐛 Open an [Issue](https://github.com/team-falkor/game-launcher/issues)** for bugs or feature requests
- **📧 Reach out** to maintainers for guidance on larger contributions

**Thank you for considering contributing to Game Launcher! Every contribution, no matter how small, helps make this library better for everyone.** 🙏

## 📄 License

This project is licensed under the **BSD 3-Clause License** - see the [LICENSE](LICENSE) file for details.


## 📞 Support & Community

### 💬 Get Help
- **📖 Documentation**: [./docs/](./docs/)
- **🐛 Issues**: [GitHub Issues](https://github.com/team-falkor/game-launcher/issues)
- **💭 Discussions**: [GitHub Discussions](https://github.com/team-falkor/game-launcher/discussions)

### 🔗 Links
- **📦 npm Package**: [https://www.npmjs.com/package/@team-falkor/game-launcher](https://www.npmjs.com/package/@team-falkor/game-launcher)
- **📊 GitHub**: [https://github.com/team-falkor/game-launcher](https://github.com/team-falkor/game-launcher)

---

<div align="center">
  
  **Built with ❤️ for the gaming community**
  
  *Empowering developers to create amazing game management experiences*
  
</div>

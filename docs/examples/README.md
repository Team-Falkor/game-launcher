# Examples

This directory contains practical examples demonstrating how to use the Game Launcher library in real-world scenarios.

## 📋 Available Examples

### Basic Examples
- [**Simple Game Launcher**](simple-launcher.md) - Basic game launching and monitoring
- [**Event Handling**](event-handling.md) - Working with game events
- [**Multiple Games**](multiple-games.md) - Managing multiple games simultaneously

### Advanced Examples
- [**Steam Integration**](steam-integration.md) - Launching Steam games
- [**Game Library Manager**](game-library-manager.md) - Full-featured game library
- [**Playtime Tracker**](playtime-tracker.md) - Track and analyze gaming sessions

### Platform-Specific Examples
- [**Windows Games**](windows-games.md) - Windows-specific implementations
- [**Linux Games**](linux-games.md) - Linux gaming with Wine and native games
- [**macOS Games**](macos-games.md) - macOS game management

## 🚀 Quick Start

Each example includes:
- **Complete source code** with detailed comments
- **Installation instructions** for dependencies
- **Usage examples** with sample inputs/outputs
- **Configuration options** and customization tips
- **Error handling** and troubleshooting

## 📁 File Structure

```
examples/
├── README.md                 # This file
├── simple-launcher.md        # Basic launcher example
├── event-handling.md         # Event system examples
├── multiple-games.md         # Multi-game management
├── steam-integration.md      # Steam game launcher
├── game-library-manager.md   # Complete library manager
├── playtime-tracker.md       # Session tracking
├── windows-games.md          # Windows-specific examples
├── linux-games.md            # Linux gaming examples
└── macos-games.md            # macOS examples
```

## 🎯 Example Categories

### 🟢 Beginner Examples
Perfect for getting started with the library:
- Simple Game Launcher
- Event Handling
- Basic Configuration

### 🟡 Intermediate Examples
For developers with some experience:
- Multiple Games Management
- Steam Integration
- Playtime Tracking
- Platform-Specific Implementations

### 🔴 Advanced Examples
For complex use cases and production applications:
- Game Library Manager
- Steam Integration
- Playtime Tracking

## 💡 Usage Tips

1. **Start Simple**: Begin with the Simple Game Launcher example
2. **Copy and Modify**: Use examples as templates for your projects
3. **Read Comments**: Each example includes detailed explanations
4. **Test Locally**: Try examples with your own games first
5. **Customize**: Adapt examples to your specific needs

## 🔧 Prerequisites

Before running the examples, ensure you have:

- **Node.js** 16.0.0 or higher
- **npm**, **yarn**, or **bun** package manager
- **Game Launcher library** installed
- **Platform-specific requirements** (see individual examples)

### Installation

```bash
# Install the Game Launcher library
npm install game-launcher

# For TypeScript projects
npm install -D typescript @types/node

# For specific examples, additional dependencies may be required
# (see individual example documentation)
```

## 🎮 Testing with Sample Games

Many examples can be tested with simple applications:

### Windows
```typescript
// Test with Notepad
const gameId = await launcher.launchGame({
  gameId: 'notepad-test',
  executable: 'notepad.exe'
});
```

### Linux/macOS
```typescript
// Test with a simple command
const gameId = await launcher.launchGame({
  gameId: 'sleep-test',
  executable: '/bin/sleep',
  args: ['10'] // Sleep for 10 seconds
});
```

## 📚 Learning Path

Recommended order for exploring examples:

1. **[Simple Game Launcher](simple-launcher.md)** - Learn the basics
2. **[Event Handling](event-handling.md)** - Understand the event system
3. **[Multiple Games](multiple-games.md)** - Handle multiple processes
4. **[Platform-Specific Examples](#platform-specific-examples)** - Your platform
5. **[Advanced Examples](#advanced-examples)** - Complex use cases
6. **[Integration Examples](#integration-examples)** - Real applications

## 🤝 Contributing Examples

We welcome community contributions! To add a new example:

1. **Follow the Template**: Use existing examples as templates
2. **Include Documentation**: Add clear explanations and comments
3. **Test Thoroughly**: Ensure examples work on target platforms
4. **Add to Index**: Update this README with your example

### Example Template Structure

```markdown
# Example Title

## Overview
Brief description of what this example demonstrates.

## Prerequisites
List any specific requirements.

## Installation
Step-by-step installation instructions.

## Code
Complete, commented source code.

## Usage
How to run and use the example.

## Customization
How to adapt the example for different needs.

## Troubleshooting
Common issues and solutions.
```

## 🔗 Related Resources

- **[API Documentation](../api/README.md)** - Complete API reference
- **[Getting Started Guide](../guides/getting-started.md)** - Basic usage guide
- **[Configuration Guide](../guides/configuration.md)** - Configuration options
- **[Best Practices](../guides/best-practices.md)** - Recommended patterns

## 📞 Support

If you have questions about any example:

1. **Check the Documentation** - Most questions are answered in the guides
2. **Review Similar Examples** - Look for patterns in related examples
3. **Open an Issue** - For bugs or missing examples
4. **Join Discussions** - For general questions and ideas

---

**Happy Coding! 🎮**

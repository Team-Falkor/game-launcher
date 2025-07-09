# Admin Privileges Example

This example demonstrates how to launch games with administrator privileges using the `runAsAdmin` option.

## 🔐 Basic Admin Launch

```typescript
import { GameLauncher } from '@team-falkor/game-launcher';

const launcher = new GameLauncher();

// Launch a game with administrator privileges
const gameId = await launcher.launchGame({
  gameId: 'admin-game',
  executable: 'C:\\Program Files\\MyGame\\game.exe',
  runAsAdmin: true // This will prompt for admin privileges
});

console.log(`Game launched with admin privileges: ${gameId}`);
```

## 🎮 Complete Admin Example

```typescript
import { GameLauncher } from '@team-falkor/game-launcher';

const launcher = new GameLauncher({
  maxConcurrentGames: 3,
  enableProcessMonitoring: true
});

// Launch game with full configuration and admin privileges
const gameId = await launcher.launchGame({
  gameId: 'privileged-game',
  executable: 'C:\\Games\\SpecialGame\\launcher.exe',
  args: ['--admin-mode', '--debug'],
  workingDirectory: 'C:\\Games\\SpecialGame',
  environment: {
    GAME_MODE: 'admin',
    DEBUG_LEVEL: '2'
  },
  runAsAdmin: true,
  captureOutput: true,
  metadata: {
    requiresAdmin: true,
    gameType: 'system-level'
  }
});

// Monitor the admin process
launcher.on('launched', (event) => {
  console.log(`Admin game launched: ${event.gameId} (PID: ${event.pid})`);
});

launcher.on('error', (event) => {
  if (event.phase === 'launch') {
    console.error(`Failed to launch admin game: ${event.error.message}`);
  }
});
```

## 🔧 Platform-Specific Behavior

### Windows
- Uses User Account Control (UAC) prompt
- Requires user to click "Yes" in the UAC dialog
- Game runs with elevated privileges

### macOS
- Uses native authentication dialog
- Requires user password or Touch ID
- Game runs with sudo privileges

### Linux
- Uses pkexec or kdesudo for authentication
- Requires user password
- Game runs with root privileges

## ⚠️ Important Considerations

### Security
- Only use `runAsAdmin` when absolutely necessary
- Admin processes have full system access
- Be cautious with file operations and system modifications

### Process Management
- Admin processes may behave differently than regular processes
- Some monitoring features may be limited
- Process termination might require additional privileges

### User Experience
- Users will see an authentication prompt
- The prompt appearance varies by operating system
- Users can cancel the authentication, causing launch to fail

## 🚫 Error Handling

```typescript
try {
  const gameId = await launcher.launchGame({
    gameId: 'admin-required-game',
    executable: 'C:\\System\\AdminTool.exe',
    runAsAdmin: true
  });
  
  console.log('Successfully launched with admin privileges');
} catch (error) {
  if (error.message.includes('User did not grant permission')) {
    console.log('User cancelled the admin prompt');
  } else if (error.message.includes('Authentication failed')) {
    console.log('Invalid credentials provided');
  } else {
    console.error('Failed to launch admin process:', error.message);
  }
}
```

## 🎯 Use Cases

### System-Level Games
```typescript
// Games that need to access protected system resources
const systemGameId = await launcher.launchGame({
  gameId: 'system-level-game',
  executable: 'C:\\Games\\SystemGame\\game.exe',
  runAsAdmin: true,
  metadata: {
    reason: 'Requires access to system drivers'
  }
});
```

### Game Modding Tools
```typescript
// Modding tools that need to modify game files in protected directories
const modToolId = await launcher.launchGame({
  gameId: 'mod-tool',
  executable: 'C:\\Tools\\GameModder\\modder.exe',
  args: ['--target', 'C:\\Program Files\\Game'],
  runAsAdmin: true,
  metadata: {
    tool: 'modding',
    targetGame: 'protected-game'
  }
});
```

### Legacy Games
```typescript
// Older games that require admin privileges to run properly
const legacyGameId = await launcher.launchGame({
  gameId: 'legacy-game',
  executable: 'C:\\OldGames\\Classic\\game.exe',
  runAsAdmin: true,
  environment: {
    COMPATIBILITY_MODE: 'windows-xp'
  },
  metadata: {
    era: 'legacy',
    compatibilityRequired: true
  }
});
```

## 📝 Best Practices

1. **Minimize Usage**: Only use `runAsAdmin` when the game truly requires elevated privileges
2. **User Communication**: Inform users why admin privileges are needed
3. **Error Handling**: Always handle authentication failures gracefully
4. **Security Audit**: Regularly review which games require admin access
5. **Documentation**: Document why each game needs admin privileges

## 🔍 Troubleshooting

### Common Issues

**Authentication Prompt Not Appearing**
- Ensure the executable path is correct
- Check that the user has admin rights on the system
- Verify the executable is not already running

**Game Fails to Launch After Authentication**
- Check executable permissions
- Verify working directory exists and is accessible
- Review environment variables for conflicts

**Process Monitoring Issues**
- Admin processes may have limited monitoring capabilities
- Some system information might not be available
- Process termination might require additional steps
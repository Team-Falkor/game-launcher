# Playtime Tracker

This example demonstrates how to track and analyze game playtime using the Game Launcher library, including session management, statistics, and reporting.

## Overview

The Playtime Tracker example covers:
- Session-based playtime tracking
- Persistent data storage
- Statistical analysis and reporting
- User profiles and achievements
- Time-based insights and trends
- Export and visualization capabilities

## Prerequisites

- Node.js 16.0.0 or higher
- Game Launcher library installed
- Basic understanding of data persistence
- Optional: Database for advanced storage

## Code

### Complete Playtime Tracker

```typescript
import { GameLauncher, GameStatus } from '@team-falkor/game-launcher';
import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Playtime Tracker
 * Comprehensive game session and playtime tracking system
 */
class PlaytimeTracker extends EventEmitter {
  private launcher: GameLauncher;
  private sessions: Map<string, GameSession> = new Map();
  private profiles: Map<string, UserProfile> = new Map();
  private config: TrackerConfig;
  private dataFile: string;
  private autoSaveInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<TrackerConfig> = {}) {
    super();
    
    this.config = {
      dataDirectory: './playtime-data',
      autoSave: true,
      autoSaveInterval: 30000, // 30 seconds
      sessionTimeout: 300000, // 5 minutes
      trackIdleTime: true,
      idleThreshold: 60000, // 1 minute
      enableAchievements: true,
      enableStatistics: true,
      defaultProfile: 'default',
      ...config
    };
    
    this.dataFile = path.join(this.config.dataDirectory, 'playtime-data.json');
    
    this.launcher = new GameLauncher({
      verbose: true
    });
    
    this.setupEventHandlers();
    this.initializeTracker();
  }

  /**
   * Initialize the tracker
   */
  private async initializeTracker(): Promise<void> {
    try {
      // Ensure data directory exists
      await fs.mkdir(this.config.dataDirectory, { recursive: true });
      
      // Load existing data
      await this.loadData();
      
      // Start auto-save if enabled
      if (this.config.autoSave) {
        this.startAutoSave();
      }
      
      console.log('📊 Playtime Tracker initialized');
      
    } catch (error) {
      console.error('Failed to initialize playtime tracker:', error);
      throw error;
    }
  }

  /**
   * Launch a game with playtime tracking
   */
  async launchGame(
    gameId: string,
    executable: string,
    options: LaunchOptions = {},
    profileId: string = this.config.defaultProfile
  ): Promise<string> {
    console.log(`🎮 Launching ${gameId} for profile ${profileId}`);
    
    try {
      // Ensure profile exists
      this.ensureProfile(profileId);
      
      // Create session
      const session = this.createSession(gameId, profileId, options);
      
      // Launch the game
      const launchedGameId = await this.launcher.launchGame({
        gameId,
        executable,
        args: options.args || [],
        cwd: options.cwd,
        env: options.env
      });
      
      // Update session with actual game ID
      session.actualGameId = launchedGameId;
      this.sessions.set(launchedGameId, session);
      
      // Start tracking
      this.startSessionTracking(session);
      
      console.log(`✅ Game ${gameId} launched with tracking`);
      return launchedGameId;
      
    } catch (error) {
      console.error(`❌ Failed to launch ${gameId}:`, error);
      throw error;
    }
  }

  /**
   * Create a new game session
   */
  private createSession(gameId: string, profileId: string, options: LaunchOptions): GameSession {
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const session: GameSession = {
      sessionId,
      gameId,
      profileId,
      startTime: Date.now(),
      endTime: null,
      totalPlaytime: 0,
      activePlaytime: 0,
      idleTime: 0,
      status: 'starting',
      events: [],
      achievements: [],
      metadata: {
        executable: options.executable || '',
        args: options.args || [],
        cwd: options.cwd || '',
        launchOptions: options
      },
      lastActivity: Date.now(),
      idlePeriods: [],
      pausedTime: 0,
      resumedTime: 0
    };
    
    // Add session event
    this.addSessionEvent(session, 'session_created', {
      sessionId,
      gameId,
      profileId
    });
    
    return session;
  }

  /**
   * Start tracking a session
   */
  private startSessionTracking(session: GameSession): void {
    console.log(`📈 Starting tracking for session ${session.sessionId}`);
    
    // Start activity monitoring if idle tracking is enabled
    if (this.config.trackIdleTime) {
      this.startIdleTracking(session);
    }
    
    // Emit session started event
    this.emit('sessionStarted', session);
  }

  /**
   * Start idle time tracking for a session
   */
  private startIdleTracking(session: GameSession): void {
    const checkInterval = setInterval(() => {
      const now = Date.now();
      const timeSinceActivity = now - session.lastActivity;
      
      if (timeSinceActivity > this.config.idleThreshold) {
        // Player is idle
        if (session.status === 'active') {
          session.status = 'idle';
          session.idlePeriods.push({
            startTime: session.lastActivity + this.config.idleThreshold,
            endTime: null
          });
          
          this.addSessionEvent(session, 'idle_started', {
            idleStartTime: session.lastActivity + this.config.idleThreshold
          });
          
          this.emit('playerIdle', session);
        }
      } else {
        // Player is active
        if (session.status === 'idle') {
          session.status = 'active';
          
          // Close current idle period
          const currentIdlePeriod = session.idlePeriods[session.idlePeriods.length - 1];
          if (currentIdlePeriod && !currentIdlePeriod.endTime) {
            currentIdlePeriod.endTime = now;
            session.idleTime += currentIdlePeriod.endTime - currentIdlePeriod.startTime;
          }
          
          this.addSessionEvent(session, 'idle_ended', {
            idleEndTime: now,
            idleDuration: currentIdlePeriod ? now - currentIdlePeriod.startTime : 0
          });
          
          this.emit('playerActive', session);
        }
      }
      
      // Update playtime
      this.updateSessionPlaytime(session);
      
    }, 5000); // Check every 5 seconds
    
    // Store interval reference for cleanup
    session.metadata.trackingInterval = checkInterval;
  }

  /**
   * Update session playtime
   */
  private updateSessionPlaytime(session: GameSession): void {
    const now = Date.now();
    session.totalPlaytime = now - session.startTime;
    
    // Calculate active playtime (total - idle - paused)
    session.activePlaytime = session.totalPlaytime - session.idleTime - session.pausedTime;
    
    // Update last activity if not idle
    if (session.status === 'active') {
      session.lastActivity = now;
    }
  }

  /**
   * Pause session tracking
   */
  pauseSession(gameId: string): boolean {
    const session = this.sessions.get(gameId);
    if (!session || session.status === 'paused') {
      return false;
    }
    
    session.status = 'paused';
    session.pausedTime = Date.now();
    
    this.addSessionEvent(session, 'session_paused', {
      pausedAt: session.pausedTime
    });
    
    console.log(`⏸️ Session paused: ${session.sessionId}`);
    this.emit('sessionPaused', session);
    
    return true;
  }

  /**
   * Resume session tracking
   */
  resumeSession(gameId: string): boolean {
    const session = this.sessions.get(gameId);
    if (!session || session.status !== 'paused') {
      return false;
    }
    
    const now = Date.now();
    session.resumedTime = now;
    session.pausedTime += now - session.pausedTime;
    session.status = 'active';
    session.lastActivity = now;
    
    this.addSessionEvent(session, 'session_resumed', {
      resumedAt: now,
      pauseDuration: now - session.pausedTime
    });
    
    console.log(`▶️ Session resumed: ${session.sessionId}`);
    this.emit('sessionResumed', session);
    
    return true;
  }

  /**
   * End a session
   */
  private endSession(gameId: string, exitCode?: number, runtime?: number): void {
    const session = this.sessions.get(gameId);
    if (!session) {
      return;
    }
    
    console.log(`🏁 Ending session: ${session.sessionId}`);
    
    const now = Date.now();
    session.endTime = now;
    session.status = 'ended';
    
    // Final playtime update
    this.updateSessionPlaytime(session);
    
    // Close any open idle period
    const lastIdlePeriod = session.idlePeriods[session.idlePeriods.length - 1];
    if (lastIdlePeriod && !lastIdlePeriod.endTime) {
      lastIdlePeriod.endTime = now;
      session.idleTime += lastIdlePeriod.endTime - lastIdlePeriod.startTime;
    }
    
    // Clean up tracking interval
    if (session.metadata.trackingInterval) {
      clearInterval(session.metadata.trackingInterval);
    }
    
    // Add final session event
    this.addSessionEvent(session, 'session_ended', {
      endTime: now,
      totalPlaytime: session.totalPlaytime,
      activePlaytime: session.activePlaytime,
      idleTime: session.idleTime,
      exitCode,
      runtime
    });
    
    // Update profile statistics
    this.updateProfileStats(session);
    
    // Check for achievements
    if (this.config.enableAchievements) {
      this.checkAchievements(session);
    }
    
    // Remove from active sessions
    this.sessions.delete(gameId);
    
    // Emit session ended event
    this.emit('sessionEnded', session);
    
    console.log(`📊 Session completed: ${this.formatDuration(session.totalPlaytime)} total, ${this.formatDuration(session.activePlaytime)} active`);
  }

  /**
   * Update profile statistics
   */
  private updateProfileStats(session: GameSession): void {
    const profile = this.profiles.get(session.profileId);
    if (!profile) {
      return;
    }
    
    // Update game-specific stats
    if (!profile.gameStats.has(session.gameId)) {
      profile.gameStats.set(session.gameId, {
        gameId: session.gameId,
        totalSessions: 0,
        totalPlaytime: 0,
        activePlaytime: 0,
        idleTime: 0,
        averageSessionLength: 0,
        longestSession: 0,
        shortestSession: Infinity,
        lastPlayed: 0,
        firstPlayed: 0
      });
    }
    
    const gameStats = profile.gameStats.get(session.gameId)!;
    
    // Update stats
    gameStats.totalSessions++;
    gameStats.totalPlaytime += session.totalPlaytime;
    gameStats.activePlaytime += session.activePlaytime;
    gameStats.idleTime += session.idleTime;
    gameStats.lastPlayed = session.endTime!;
    
    if (gameStats.firstPlayed === 0) {
      gameStats.firstPlayed = session.startTime;
    }
    
    gameStats.longestSession = Math.max(gameStats.longestSession, session.totalPlaytime);
    gameStats.shortestSession = Math.min(gameStats.shortestSession, session.totalPlaytime);
    gameStats.averageSessionLength = gameStats.totalPlaytime / gameStats.totalSessions;
    
    // Update profile totals
    profile.totalPlaytime += session.totalPlaytime;
    profile.totalSessions++;
    profile.lastActivity = session.endTime!;
    
    // Add session to history
    profile.sessionHistory.push({
      sessionId: session.sessionId,
      gameId: session.gameId,
      startTime: session.startTime,
      endTime: session.endTime!,
      totalPlaytime: session.totalPlaytime,
      activePlaytime: session.activePlaytime
    });
    
    // Keep only last 1000 sessions
    if (profile.sessionHistory.length > 1000) {
      profile.sessionHistory = profile.sessionHistory.slice(-1000);
    }
  }

  /**
   * Check for achievements
   */
  private checkAchievements(session: GameSession): void {
    const profile = this.profiles.get(session.profileId);
    if (!profile) {
      return;
    }
    
    const gameStats = profile.gameStats.get(session.gameId);
    if (!gameStats) {
      return;
    }
    
    const achievements: Achievement[] = [];
    
    // First time playing
    if (gameStats.totalSessions === 1) {
      achievements.push({
        id: 'first_time',
        name: 'First Time',
        description: `First time playing ${session.gameId}`,
        unlockedAt: Date.now(),
        gameId: session.gameId
      });
    }
    
    // Playtime milestones
    const playtimeHours = gameStats.totalPlaytime / (1000 * 60 * 60);
    const milestones = [1, 5, 10, 25, 50, 100, 250, 500, 1000];
    
    for (const milestone of milestones) {
      const achievementId = `playtime_${milestone}h`;
      if (playtimeHours >= milestone && !profile.achievements.some(a => a.id === achievementId)) {
        achievements.push({
          id: achievementId,
          name: `${milestone} Hour${milestone > 1 ? 's' : ''}`,
          description: `Played ${session.gameId} for ${milestone} hour${milestone > 1 ? 's' : ''}`,
          unlockedAt: Date.now(),
          gameId: session.gameId
        });
      }
    }
    
    // Session count milestones
    const sessionMilestones = [10, 25, 50, 100, 250, 500, 1000];
    
    for (const milestone of sessionMilestones) {
      const achievementId = `sessions_${milestone}`;
      if (gameStats.totalSessions >= milestone && !profile.achievements.some(a => a.id === achievementId)) {
        achievements.push({
          id: achievementId,
          name: `${milestone} Sessions`,
          description: `Played ${session.gameId} ${milestone} times`,
          unlockedAt: Date.now(),
          gameId: session.gameId
        });
      }
    }
    
    // Long session achievement
    const sessionHours = session.totalPlaytime / (1000 * 60 * 60);
    if (sessionHours >= 8 && !profile.achievements.some(a => a.id === 'marathon_session')) {
      achievements.push({
        id: 'marathon_session',
        name: 'Marathon Session',
        description: 'Played for 8+ hours in a single session',
        unlockedAt: Date.now(),
        gameId: session.gameId
      });
    }
    
    // Add achievements to profile and session
    achievements.forEach(achievement => {
      profile.achievements.push(achievement);
      session.achievements.push(achievement);
      
      console.log(`🏆 Achievement unlocked: ${achievement.name}`);
      this.emit('achievementUnlocked', { achievement, session, profile });
    });
  }

  /**
   * Add an event to a session
   */
  private addSessionEvent(session: GameSession, type: string, data: any): void {
    const event: SessionEvent = {
      type,
      timestamp: Date.now(),
      data
    };
    
    session.events.push(event);
    
    // Keep only last 100 events per session
    if (session.events.length > 100) {
      session.events = session.events.slice(-100);
    }
  }

  /**
   * Ensure a profile exists
   */
  private ensureProfile(profileId: string): void {
    if (!this.profiles.has(profileId)) {
      const profile: UserProfile = {
        profileId,
        createdAt: Date.now(),
        lastActivity: Date.now(),
        totalPlaytime: 0,
        totalSessions: 0,
        gameStats: new Map(),
        achievements: [],
        sessionHistory: [],
        preferences: {
          trackIdleTime: this.config.trackIdleTime,
          idleThreshold: this.config.idleThreshold
        }
      };
      
      this.profiles.set(profileId, profile);
      console.log(`👤 Created new profile: ${profileId}`);
    }
  }

  /**
   * Get profile information
   */
  getProfile(profileId: string): UserProfile | null {
    return this.profiles.get(profileId) || null;
  }

  /**
   * Get all profiles
   */
  getAllProfiles(): UserProfile[] {
    return Array.from(this.profiles.values());
  }

  /**
   * Get active sessions
   */
  getActiveSessions(): GameSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Get session by ID
   */
  getSession(gameId: string): GameSession | null {
    return this.sessions.get(gameId) || null;
  }

  /**
   * Generate playtime report
   */
  generateReport(profileId?: string, gameId?: string, timeRange?: TimeRange): PlaytimeReport {
    console.log('📊 Generating playtime report...');
    
    const profiles = profileId ? [this.profiles.get(profileId)].filter(Boolean) : Array.from(this.profiles.values());
    const report: PlaytimeReport = {
      generatedAt: Date.now(),
      timeRange: timeRange || { start: 0, end: Date.now() },
      profiles: [],
      summary: {
        totalProfiles: profiles.length,
        totalPlaytime: 0,
        totalSessions: 0,
        totalGames: 0,
        averageSessionLength: 0,
        mostPlayedGame: null,
        achievements: 0
      }
    };
    
    let totalPlaytime = 0;
    let totalSessions = 0;
    const gamePlaytimes = new Map<string, number>();
    let totalAchievements = 0;
    
    for (const profile of profiles) {
      const profileReport: ProfileReport = {
        profileId: profile.profileId,
        totalPlaytime: 0,
        totalSessions: 0,
        games: [],
        achievements: profile.achievements.length,
        topGames: [],
        recentActivity: []
      };
      
      // Filter sessions by time range
      const filteredSessions = profile.sessionHistory.filter(session => {
        if (timeRange) {
          return session.startTime >= timeRange.start && session.endTime <= timeRange.end;
        }
        return true;
      });
      
      // Filter by game if specified
      const relevantSessions = gameId ? 
        filteredSessions.filter(session => session.gameId === gameId) : 
        filteredSessions;
      
      profileReport.totalSessions = relevantSessions.length;
      profileReport.totalPlaytime = relevantSessions.reduce((sum, session) => sum + session.totalPlaytime, 0);
      
      // Game statistics
      const gameStats = new Map<string, { playtime: number; sessions: number }>();
      
      for (const session of relevantSessions) {
        if (!gameStats.has(session.gameId)) {
          gameStats.set(session.gameId, { playtime: 0, sessions: 0 });
        }
        
        const stats = gameStats.get(session.gameId)!;
        stats.playtime += session.totalPlaytime;
        stats.sessions++;
        
        // Update global game playtimes
        gamePlaytimes.set(session.gameId, (gamePlaytimes.get(session.gameId) || 0) + session.totalPlaytime);
      }
      
      // Convert to game reports
      profileReport.games = Array.from(gameStats.entries()).map(([gameId, stats]) => ({
        gameId,
        totalPlaytime: stats.playtime,
        totalSessions: stats.sessions,
        averageSessionLength: stats.playtime / stats.sessions
      }));
      
      // Sort games by playtime
      profileReport.games.sort((a, b) => b.totalPlaytime - a.totalPlaytime);
      profileReport.topGames = profileReport.games.slice(0, 5);
      
      // Recent activity (last 10 sessions)
      profileReport.recentActivity = relevantSessions
        .sort((a, b) => b.startTime - a.startTime)
        .slice(0, 10)
        .map(session => ({
          gameId: session.gameId,
          startTime: session.startTime,
          duration: session.totalPlaytime
        }));
      
      totalPlaytime += profileReport.totalPlaytime;
      totalSessions += profileReport.totalSessions;
      totalAchievements += profileReport.achievements;
      
      report.profiles.push(profileReport);
    }
    
    // Summary statistics
    report.summary.totalPlaytime = totalPlaytime;
    report.summary.totalSessions = totalSessions;
    report.summary.totalGames = gamePlaytimes.size;
    report.summary.averageSessionLength = totalSessions > 0 ? totalPlaytime / totalSessions : 0;
    report.summary.achievements = totalAchievements;
    
    // Most played game
    if (gamePlaytimes.size > 0) {
      const mostPlayed = Array.from(gamePlaytimes.entries())
        .sort((a, b) => b[1] - a[1])[0];
      report.summary.mostPlayedGame = {
        gameId: mostPlayed[0],
        totalPlaytime: mostPlayed[1]
      };
    }
    
    return report;
  }

  /**
   * Export data to JSON
   */
  async exportData(filePath?: string): Promise<string> {
    const exportPath = filePath || path.join(this.config.dataDirectory, `export-${Date.now()}.json`);
    
    const exportData = {
      version: '1.0.0',
      exportedAt: Date.now(),
      profiles: Array.from(this.profiles.entries()).map(([id, profile]) => ({
        ...profile,
        gameStats: Array.from(profile.gameStats.entries())
      })),
      activeSessions: Array.from(this.sessions.values())
    };
    
    await fs.writeFile(exportPath, JSON.stringify(exportData, null, 2));
    console.log(`📤 Data exported to: ${exportPath}`);
    
    return exportPath;
  }

  /**
   * Import data from JSON
   */
  async importData(filePath: string): Promise<void> {
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      const importData = JSON.parse(data);
      
      // Clear existing data
      this.profiles.clear();
      this.sessions.clear();
      
      // Import profiles
      for (const profileData of importData.profiles) {
        const profile: UserProfile = {
          ...profileData,
          gameStats: new Map(profileData.gameStats)
        };
        this.profiles.set(profile.profileId, profile);
      }
      
      // Import active sessions
      for (const sessionData of importData.activeSessions || []) {
        this.sessions.set(sessionData.actualGameId || sessionData.gameId, sessionData);
      }
      
      console.log(`📥 Data imported from: ${filePath}`);
      this.emit('dataImported', { filePath, profiles: this.profiles.size });
      
    } catch (error) {
      console.error('Failed to import data:', error);
      throw error;
    }
  }

  /**
   * Load data from file
   */
  private async loadData(): Promise<void> {
    try {
      const data = await fs.readFile(this.dataFile, 'utf-8');
      const parsedData = JSON.parse(data);
      
      // Load profiles
      for (const profileData of parsedData.profiles || []) {
        const profile: UserProfile = {
          ...profileData,
          gameStats: new Map(profileData.gameStats || [])
        };
        this.profiles.set(profile.profileId, profile);
      }
      
      console.log(`📂 Loaded ${this.profiles.size} profiles from storage`);
      
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log('📂 No existing data file found, starting fresh');
      } else {
        console.error('Failed to load data:', error);
      }
    }
  }

  /**
   * Save data to file
   */
  private async saveData(): Promise<void> {
    try {
      const saveData = {
        version: '1.0.0',
        savedAt: Date.now(),
        profiles: Array.from(this.profiles.entries()).map(([id, profile]) => ({
          ...profile,
          gameStats: Array.from(profile.gameStats.entries())
        }))
      };
      
      await fs.writeFile(this.dataFile, JSON.stringify(saveData, null, 2));
      
    } catch (error) {
      console.error('Failed to save data:', error);
    }
  }

  /**
   * Start auto-save
   */
  private startAutoSave(): void {
    this.autoSaveInterval = setInterval(() => {
      this.saveData().catch(error => {
        console.error('Auto-save failed:', error);
      });
    }, this.config.autoSaveInterval);
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    this.launcher.on('launched', (event) => {
      const session = this.sessions.get(event.gameId);
      if (session) {
        session.status = 'active';
        session.lastActivity = Date.now();
        
        this.addSessionEvent(session, 'game_launched', {
          gameId: event.gameId,
          pid: event.pid
        });
        
        console.log(`🎮 Game launched: ${event.gameId}`);
      }
    });
    
    this.launcher.on('closed', (event) => {
      this.endSession(event.gameId, event.exitCode, event.runtime);
    });
    
    this.launcher.on('error', (event) => {
      const session = this.sessions.get(event.gameId);
      if (session) {
        this.addSessionEvent(session, 'game_error', {
          error: event.error.message,
          timestamp: Date.now()
        });
      }
    });
    
    this.launcher.on('output', (event) => {
      const session = this.sessions.get(event.gameId);
      if (session) {
        session.lastActivity = Date.now();
        
        // Only log significant output events
        if (event.data.length > 10) {
          this.addSessionEvent(session, 'game_output', {
            length: event.data.length,
            timestamp: Date.now()
          });
        }
      }
    });
  }

  /**
   * Format duration in milliseconds
   */
  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
      return `${days}d ${hours % 24}h ${minutes % 60}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Clean up and save data
   */
  async destroy(): Promise<void> {
    console.log('🧹 Cleaning up Playtime Tracker...');
    
    // End all active sessions
    for (const [gameId, session] of this.sessions) {
      this.endSession(gameId);
    }
    
    // Stop auto-save
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
    }
    
    // Final save
    await this.saveData();
    
    // Clean up launcher
    this.launcher.destroy();
    
    // Remove all listeners
    this.removeAllListeners();
    
    console.log('✅ Playtime Tracker cleaned up');
  }
}

// Type definitions
interface TrackerConfig {
  dataDirectory: string;
  autoSave: boolean;
  autoSaveInterval: number;
  sessionTimeout: number;
  trackIdleTime: boolean;
  idleThreshold: number;
  enableAchievements: boolean;
  enableStatistics: boolean;
  defaultProfile: string;
}

interface LaunchOptions {
  executable?: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
}

interface GameSession {
  sessionId: string;
  gameId: string;
  profileId: string;
  actualGameId?: string;
  startTime: number;
  endTime: number | null;
  totalPlaytime: number;
  activePlaytime: number;
  idleTime: number;
  status: 'starting' | 'active' | 'idle' | 'paused' | 'ended';
  events: SessionEvent[];
  achievements: Achievement[];
  metadata: {
    executable: string;
    args: string[];
    cwd: string;
    launchOptions: LaunchOptions;
    trackingInterval?: NodeJS.Timeout;
  };
  lastActivity: number;
  idlePeriods: IdlePeriod[];
  pausedTime: number;
  resumedTime: number;
}

interface SessionEvent {
  type: string;
  timestamp: number;
  data: any;
}

interface IdlePeriod {
  startTime: number;
  endTime: number | null;
}

interface UserProfile {
  profileId: string;
  createdAt: number;
  lastActivity: number;
  totalPlaytime: number;
  totalSessions: number;
  gameStats: Map<string, GameStats>;
  achievements: Achievement[];
  sessionHistory: SessionSummary[];
  preferences: {
    trackIdleTime: boolean;
    idleThreshold: number;
  };
}

interface GameStats {
  gameId: string;
  totalSessions: number;
  totalPlaytime: number;
  activePlaytime: number;
  idleTime: number;
  averageSessionLength: number;
  longestSession: number;
  shortestSession: number;
  lastPlayed: number;
  firstPlayed: number;
}

interface Achievement {
  id: string;
  name: string;
  description: string;
  unlockedAt: number;
  gameId: string;
}

interface SessionSummary {
  sessionId: string;
  gameId: string;
  startTime: number;
  endTime: number;
  totalPlaytime: number;
  activePlaytime: number;
}

interface TimeRange {
  start: number;
  end: number;
}

interface PlaytimeReport {
  generatedAt: number;
  timeRange: TimeRange;
  profiles: ProfileReport[];
  summary: {
    totalProfiles: number;
    totalPlaytime: number;
    totalSessions: number;
    totalGames: number;
    averageSessionLength: number;
    mostPlayedGame: { gameId: string; totalPlaytime: number } | null;
    achievements: number;
  };
}

interface ProfileReport {
  profileId: string;
  totalPlaytime: number;
  totalSessions: number;
  games: GameReport[];
  achievements: number;
  topGames: GameReport[];
  recentActivity: ActivitySummary[];
}

interface GameReport {
  gameId: string;
  totalPlaytime: number;
  totalSessions: number;
  averageSessionLength: number;
}

interface ActivitySummary {
  gameId: string;
  startTime: number;
  duration: number;
}

/**
 * Example usage of Playtime Tracker
 */
async function playtimeTrackerExample() {
  const tracker = new PlaytimeTracker({
    dataDirectory: './playtime-data',
    autoSave: true,
    trackIdleTime: true,
    enableAchievements: true
  });
  
  try {
    // Set up event listeners
    tracker.on('sessionStarted', (session) => {
      console.log(`🎯 Session started: ${session.gameId} for ${session.profileId}`);
    });
    
    tracker.on('sessionEnded', (session) => {
      console.log(`🏁 Session ended: ${session.gameId} (${tracker.formatDuration(session.totalPlaytime)})`);
    });
    
    tracker.on('achievementUnlocked', (event) => {
      console.log(`🏆 Achievement: ${event.achievement.name} - ${event.achievement.description}`);
    });
    
    tracker.on('playerIdle', (session) => {
      console.log(`😴 Player went idle: ${session.gameId}`);
    });
    
    tracker.on('playerActive', (session) => {
      console.log(`🎮 Player became active: ${session.gameId}`);
    });
    
    console.log('🚀 Starting playtime tracking example...');
    
    // Launch a game with tracking
    const gameId = await tracker.launchGame(
      'test-game',
      getTestExecutable(),
      { args: [] },
      'player1'
    );
    
    console.log(`✅ Game launched with tracking: ${gameId}`);
    
    // Simulate some activity
    console.log('⏳ Simulating gameplay...');
    await new Promise(resolve => setTimeout(resolve, 10000)); // 10 seconds
    
    // Pause tracking
    console.log('⏸️ Pausing session...');
    tracker.pauseSession(gameId);
    await new Promise(resolve => setTimeout(resolve, 3000)); // 3 seconds paused
    
    // Resume tracking
    console.log('▶️ Resuming session...');
    tracker.resumeSession(gameId);
    await new Promise(resolve => setTimeout(resolve, 5000)); // 5 more seconds
    
    // Get current session info
    const session = tracker.getSession(gameId);
    if (session) {
      console.log('📊 Current session info:');
      console.log(`   Total playtime: ${tracker.formatDuration(session.totalPlaytime)}`);
      console.log(`   Active playtime: ${tracker.formatDuration(session.activePlaytime)}`);
      console.log(`   Status: ${session.status}`);
    }
    
    // Close the game (this will end the session)
    console.log('🔴 Closing game...');
    await tracker.launcher.closeGame(gameId);
    
    // Wait for session to end
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Get profile information
    const profile = tracker.getProfile('player1');
    if (profile) {
      console.log('\n👤 Profile Summary:');
      console.log(`   Total playtime: ${tracker.formatDuration(profile.totalPlaytime)}`);
      console.log(`   Total sessions: ${profile.totalSessions}`);
      console.log(`   Achievements: ${profile.achievements.length}`);
      
      if (profile.achievements.length > 0) {
        console.log('   Recent achievements:');
        profile.achievements.slice(-3).forEach(achievement => {
          console.log(`     🏆 ${achievement.name}: ${achievement.description}`);
        });
      }
    }
    
    // Generate a report
    console.log('\n📈 Generating playtime report...');
    const report = tracker.generateReport('player1');
    
    console.log('📊 Playtime Report:');
    console.log(`   Total playtime: ${tracker.formatDuration(report.summary.totalPlaytime)}`);
    console.log(`   Total sessions: ${report.summary.totalSessions}`);
    console.log(`   Average session: ${tracker.formatDuration(report.summary.averageSessionLength)}`);
    
    if (report.summary.mostPlayedGame) {
      console.log(`   Most played: ${report.summary.mostPlayedGame.gameId} (${tracker.formatDuration(report.summary.mostPlayedGame.totalPlaytime)})`);
    }
    
    // Export data
    console.log('\n📤 Exporting data...');
    const exportPath = await tracker.exportData();
    console.log(`✅ Data exported to: ${exportPath}`);
    
  } catch (error) {
    console.error('💥 Playtime tracking example failed:', error);
  } finally {
    await tracker.destroy();
  }
}

function getTestExecutable(): string {
  switch (process.platform) {
    case 'win32':
      return 'notepad.exe';
    case 'darwin':
      return '/System/Applications/TextEdit.app/Contents/MacOS/TextEdit';
    default:
      return '/bin/sleep';
  }
}

// Run the example
if (require.main === module) {
  playtimeTrackerExample()
    .then(() => {
      console.log('✨ Playtime tracking example completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Example failed:', error);
      process.exit(1);
    });
}

export { PlaytimeTracker, playtimeTrackerExample };
```

## Usage Examples

### Basic Playtime Tracking

```typescript
import { PlaytimeTracker } from './playtime-tracker';

async function basicTracking() {
  const tracker = new PlaytimeTracker();
  
  // Launch a game with tracking
  const gameId = await tracker.launchGame(
    'my-game',
    '/path/to/game.exe',
    { args: ['--windowed'] },
    'player1'
  );
  
  // Game will be automatically tracked until it closes
  console.log(`Tracking game: ${gameId}`);
}
```

### Multiple Profiles

```typescript
// Track different users
const gameId1 = await tracker.launchGame('game1', 'game1.exe', {}, 'alice');
const gameId2 = await tracker.launchGame('game2', 'game2.exe', {}, 'bob');

// Get profile statistics
const aliceProfile = tracker.getProfile('alice');
const bobProfile = tracker.getProfile('bob');
```

### Session Management

```typescript
// Pause and resume tracking
tracker.pauseSession(gameId);
// ... do something else ...
tracker.resumeSession(gameId);

// Get current session info
const session = tracker.getSession(gameId);
console.log(`Active playtime: ${session.activePlaytime}ms`);
```

### Achievement System

```typescript
// Listen for achievements
tracker.on('achievementUnlocked', (event) => {
  console.log(`🏆 ${event.achievement.name}`);
  console.log(`   ${event.achievement.description}`);
  
  // Could trigger notifications, save to database, etc.
});
```

### Reporting and Analytics

```typescript
// Generate comprehensive reports
const report = tracker.generateReport('player1');

// Time-based reports
const lastWeek = {
  start: Date.now() - (7 * 24 * 60 * 60 * 1000),
  end: Date.now()
};
const weeklyReport = tracker.generateReport('player1', undefined, lastWeek);

// Game-specific reports
const gameReport = tracker.generateReport('player1', 'specific-game');
```

## Features

### 1. Session Tracking
- **Automatic**: Sessions start when games launch and end when they close
- **Manual Control**: Pause and resume tracking as needed
- **Idle Detection**: Automatically detect when players are inactive
- **Event Logging**: Comprehensive event history for each session

### 2. Profile Management
- **Multiple Users**: Support for multiple player profiles
- **Statistics**: Detailed per-game and overall statistics
- **History**: Complete session history with filtering
- **Preferences**: Per-profile tracking preferences

### 3. Achievement System
- **Automatic**: Achievements unlock based on playtime and session milestones
- **Customizable**: Easy to add new achievement types
- **Persistent**: Achievements are saved across sessions
- **Events**: Real-time achievement notifications

### 4. Data Persistence
- **Auto-save**: Automatic periodic saving
- **Export/Import**: JSON-based data exchange
- **Backup**: Easy data backup and restore
- **Migration**: Version-aware data format

### 5. Reporting
- **Comprehensive**: Detailed playtime analysis
- **Flexible**: Filter by profile, game, or time range
- **Statistics**: Average session length, most played games, etc.
- **Export**: Generate reports for external analysis

## Advanced Usage

### Custom Achievement System

```typescript
class CustomTracker extends PlaytimeTracker {
  private customAchievements: Map<string, CustomAchievement> = new Map();
  
  addCustomAchievement(achievement: CustomAchievement): void {
    this.customAchievements.set(achievement.id, achievement);
  }
  
  protected checkAchievements(session: GameSession): void {
    super.checkAchievements(session);
    
    // Check custom achievements
    for (const [id, achievement] of this.customAchievements) {
      if (achievement.condition(session, this.getProfile(session.profileId)!)) {
        this.unlockAchievement(session, achievement);
      }
    }
  }
}

interface CustomAchievement {
  id: string;
  name: string;
  description: string;
  condition: (session: GameSession, profile: UserProfile) => boolean;
}

// Usage
const tracker = new CustomTracker();

tracker.addCustomAchievement({
  id: 'night_owl',
  name: 'Night Owl',
  description: 'Play after midnight',
  condition: (session) => {
    const hour = new Date(session.startTime).getHours();
    return hour >= 0 && hour < 6;
  }
});
```

### Database Integration

```typescript
class DatabaseTracker extends PlaytimeTracker {
  private db: Database;
  
  constructor(config: TrackerConfig, database: Database) {
    super(config);
    this.db = database;
  }
  
  protected async saveData(): Promise<void> {
    // Save to database instead of file
    for (const [profileId, profile] of this.profiles) {
      await this.db.saveProfile(profile);
    }
  }
  
  protected async loadData(): Promise<void> {
    // Load from database
    const profiles = await this.db.loadProfiles();
    for (const profile of profiles) {
      this.profiles.set(profile.profileId, profile);
    }
  }
}
```

### Real-time Dashboard

```typescript
class PlaytimeDashboard {
  private tracker: PlaytimeTracker;
  private server: WebSocketServer;
  
  constructor(tracker: PlaytimeTracker) {
    this.tracker = tracker;
    this.setupWebSocket();
    this.setupEventForwarding();
  }
  
  private setupEventForwarding(): void {
    this.tracker.on('sessionStarted', (session) => {
      this.broadcast('sessionStarted', session);
    });
    
    this.tracker.on('achievementUnlocked', (event) => {
      this.broadcast('achievement', event.achievement);
    });
    
    // Update dashboard every 5 seconds
    setInterval(() => {
      const stats = this.generateDashboardData();
      this.broadcast('statsUpdate', stats);
    }, 5000);
  }
  
  private generateDashboardData() {
    const activeSessions = this.tracker.getActiveSessions();
    const profiles = this.tracker.getAllProfiles();
    
    return {
      activeSessions: activeSessions.length,
      totalProfiles: profiles.length,
      totalPlaytime: profiles.reduce((sum, p) => sum + p.totalPlaytime, 0),
      recentAchievements: this.getRecentAchievements()
    };
  }
}
```

### Analytics and Insights

```typescript
class PlaytimeAnalytics {
  static analyzePlayPatterns(profile: UserProfile): PlayPattern {
    const sessions = profile.sessionHistory;
    
    // Analyze play times
    const hourCounts = new Array(24).fill(0);
    const dayCounts = new Array(7).fill(0);
    
    sessions.forEach(session => {
      const date = new Date(session.startTime);
      hourCounts[date.getHours()]++;
      dayCounts[date.getDay()]++;
    });
    
    // Find peak hours and days
    const peakHour = hourCounts.indexOf(Math.max(...hourCounts));
    const peakDay = dayCounts.indexOf(Math.max(...dayCounts));
    
    // Calculate session length trends
    const recentSessions = sessions.slice(-30); // Last 30 sessions
    const avgRecentLength = recentSessions.reduce((sum, s) => sum + s.totalPlaytime, 0) / recentSessions.length;
    
    return {
      peakHour,
      peakDay,
      averageRecentSessionLength: avgRecentLength,
      playFrequency: this.calculatePlayFrequency(sessions),
      gamePreferences: this.analyzeGamePreferences(sessions)
    };
  }
  
  static generateInsights(profile: UserProfile): string[] {
    const insights: string[] = [];
    const patterns = this.analyzePlayPatterns(profile);
    
    // Generate insights based on patterns
    if (patterns.peakHour >= 22 || patterns.peakHour <= 6) {
      insights.push('You tend to play late at night or early morning');
    }
    
    if (patterns.playFrequency > 0.8) {
      insights.push('You play very regularly');
    } else if (patterns.playFrequency < 0.3) {
      insights.push('You play occasionally');
    }
    
    return insights;
  }
}

interface PlayPattern {
  peakHour: number;
  peakDay: number;
  averageRecentSessionLength: number;
  playFrequency: number;
  gamePreferences: { gameId: string; preference: number }[];
}
```

## Configuration Options

### Basic Configuration

```typescript
const tracker = new PlaytimeTracker({
  dataDirectory: './my-playtime-data',
  autoSave: true,
  autoSaveInterval: 60000, // 1 minute
  trackIdleTime: true,
  idleThreshold: 120000, // 2 minutes
  enableAchievements: true,
  defaultProfile: 'main'
});
```

### Advanced Configuration

```typescript
const tracker = new PlaytimeTracker({
  dataDirectory: process.env.PLAYTIME_DATA_DIR || './playtime-data',
  autoSave: true,
  autoSaveInterval: 30000,
  sessionTimeout: 600000, // 10 minutes
  trackIdleTime: true,
  idleThreshold: 180000, // 3 minutes
  enableAchievements: true,
  enableStatistics: true,
  defaultProfile: process.env.USER || 'default'
});
```

## Best Practices

### 1. Data Management

```typescript
// Regular backups
setInterval(async () => {
  const backupPath = `./backups/playtime-${Date.now()}.json`;
  await tracker.exportData(backupPath);
}, 24 * 60 * 60 * 1000); // Daily backup
```

### 2. Error Handling

```typescript
tracker.on('error', (error) => {
  console.error('Tracker error:', error);
  // Log to file, send to monitoring service, etc.
});
```

### 3. Performance

```typescript
// Limit session history size
const tracker = new PlaytimeTracker({
  // ... other config
  maxSessionHistory: 500 // Keep only last 500 sessions per profile
});
```

### 4. Privacy

```typescript
// Anonymize data for analytics
function anonymizeProfile(profile: UserProfile): AnonymizedProfile {
  return {
    id: hashProfileId(profile.profileId),
    totalPlaytime: profile.totalPlaytime,
    gameStats: anonymizeGameStats(profile.gameStats)
    // Remove personally identifiable information
  };
}
```

## Troubleshooting

### Common Issues

1. **Sessions Not Ending**
   - Check if game processes are properly detected
   - Verify event handlers are set up correctly
   - Look for zombie processes

2. **Idle Detection Not Working**
   - Adjust `idleThreshold` setting
   - Check if game is generating output
   - Verify activity detection logic

3. **Data Not Saving**
   - Check file permissions
   - Verify data directory exists
   - Look for disk space issues

4. **Memory Usage**
   - Limit session history size
   - Clean up old data periodically
   - Monitor event listener count

## Next Steps

After mastering playtime tracking:

1. **[Game Library Manager](game-library-manager.md)** - Complete game management
2. **[Best Practices](../guides/best-practices.md)** - Production patterns
3. **[Configuration Guide](../guides/configuration.md)** - Advanced setup

---

**Track your gaming journey! 📊🎮**
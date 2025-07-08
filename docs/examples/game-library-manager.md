# Game Library Manager

This example demonstrates how to build a comprehensive game library management system using the Game Launcher library, including game discovery, metadata management, and library organization.

## Overview

The Game Library Manager example covers:
- Automatic game discovery and scanning
- Game metadata management and storage
- Library organization and categorization
- Game installation and update tracking
- Search and filtering capabilities
- Integration with external game databases
- Backup and synchronization features

## Prerequisites

- Node.js 16.0.0 or higher
- Game Launcher library installed
- Basic understanding of file system operations
- Optional: External game database APIs (IGDB, Steam, etc.)

## Code

### Complete Game Library Manager

```typescript
import { GameLauncher } from 'game-launcher';
import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

/**
 * Game Library Manager
 * Comprehensive game library management and organization system
 */
class GameLibraryManager extends EventEmitter {
  private launcher: GameLauncher;
  private library: Map<string, GameEntry> = new Map();
  private categories: Map<string, Category> = new Map();
  private collections: Map<string, Collection> = new Map();
  private config: LibraryConfig;
  private dataFile: string;
  private scanInProgress: boolean = false;
  private metadataCache: Map<string, GameMetadata> = new Map();

  constructor(config: Partial<LibraryConfig> = {}) {
    super();
    
    this.config = {
      libraryPath: './game-library.json',
      scanDirectories: [],
      autoScan: true,
      scanInterval: 3600000, // 1 hour
      enableMetadata: true,
      metadataProviders: ['local', 'igdb'],
      enableThumbnails: true,
      thumbnailDirectory: './thumbnails',
      enableBackups: true,
      backupDirectory: './backups',
      maxBackups: 10,
      enableSync: false,
      syncEndpoint: '',
      ...config
    };
    
    this.dataFile = this.config.libraryPath;
    
    this.launcher = new GameLauncher({
      verbose: true
    });
    
    this.initializeLibrary();
  }

  /**
   * Initialize the library manager
   */
  private async initializeLibrary(): Promise<void> {
    try {
      // Load existing library data
      await this.loadLibrary();
      
      // Initialize default categories
      this.initializeDefaultCategories();
      
      // Create necessary directories
      await this.createDirectories();
      
      // Start auto-scan if enabled
      if (this.config.autoScan) {
        this.startAutoScan();
      }
      
      console.log('📚 Game Library Manager initialized');
      console.log(`   Games in library: ${this.library.size}`);
      console.log(`   Categories: ${this.categories.size}`);
      console.log(`   Collections: ${this.collections.size}`);
      
    } catch (error) {
      console.error('Failed to initialize library manager:', error);
      throw error;
    }
  }

  /**
   * Add a game directory to scan
   */
  addScanDirectory(directory: string): void {
    if (!this.config.scanDirectories.includes(directory)) {
      this.config.scanDirectories.push(directory);
      console.log(`📁 Added scan directory: ${directory}`);
    }
  }

  /**
   * Remove a scan directory
   */
  removeScanDirectory(directory: string): void {
    const index = this.config.scanDirectories.indexOf(directory);
    if (index !== -1) {
      this.config.scanDirectories.splice(index, 1);
      console.log(`📁 Removed scan directory: ${directory}`);
    }
  }

  /**
   * Scan for games in configured directories
   */
  async scanForGames(): Promise<ScanResult> {
    if (this.scanInProgress) {
      throw new Error('Scan already in progress');
    }
    
    console.log('🔍 Starting game library scan...');
    this.scanInProgress = true;
    
    const result: ScanResult = {
      startTime: Date.now(),
      endTime: 0,
      directoriesScanned: 0,
      gamesFound: 0,
      gamesAdded: 0,
      gamesUpdated: 0,
      errors: []
    };
    
    try {
      this.emit('scanStarted', result);
      
      for (const directory of this.config.scanDirectories) {
        try {
          console.log(`📂 Scanning directory: ${directory}`);
          const directoryResult = await this.scanDirectory(directory);
          
          result.directoriesScanned++;
          result.gamesFound += directoryResult.gamesFound;
          result.gamesAdded += directoryResult.gamesAdded;
          result.gamesUpdated += directoryResult.gamesUpdated;
          
          this.emit('directoryScanned', {
            directory,
            ...directoryResult
          });
          
        } catch (error) {
          console.error(`❌ Error scanning directory ${directory}:`, error);
          result.errors.push({
            directory,
            error: error.message
          });
        }
      }
      
      result.endTime = Date.now();
      
      // Save library after scan
      await this.saveLibrary();
      
      console.log('✅ Library scan completed');
      console.log(`   Directories scanned: ${result.directoriesScanned}`);
      console.log(`   Games found: ${result.gamesFound}`);
      console.log(`   Games added: ${result.gamesAdded}`);
      console.log(`   Games updated: ${result.gamesUpdated}`);
      
      this.emit('scanCompleted', result);
      
      return result;
      
    } finally {
      this.scanInProgress = false;
    }
  }

  /**
   * Scan a specific directory for games
   */
  private async scanDirectory(directory: string): Promise<DirectoryScanResult> {
    const result: DirectoryScanResult = {
      gamesFound: 0,
      gamesAdded: 0,
      gamesUpdated: 0
    };
    
    try {
      const entries = await fs.readdir(directory, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(directory, entry.name);
        
        if (entry.isFile() && this.isGameExecutable(entry.name)) {
          result.gamesFound++;
          
          const gameId = this.generateGameId(fullPath);
          const existingGame = this.library.get(gameId);
          
          if (existingGame) {
            // Update existing game
            const updated = await this.updateGameEntry(existingGame, fullPath);
            if (updated) {
              result.gamesUpdated++;
            }
          } else {
            // Add new game
            await this.addGameEntry(fullPath);
            result.gamesAdded++;
          }
        } else if (entry.isDirectory()) {
          // Recursively scan subdirectories
          const subResult = await this.scanDirectory(fullPath);
          result.gamesFound += subResult.gamesFound;
          result.gamesAdded += subResult.gamesAdded;
          result.gamesUpdated += subResult.gamesUpdated;
        }
      }
      
    } catch (error) {
      console.error(`Error scanning directory ${directory}:`, error);
      throw error;
    }
    
    return result;
  }

  /**
   * Check if a file is a game executable
   */
  private isGameExecutable(filename: string): boolean {
    const gameExtensions = ['.exe', '.app', '.sh', '.bat', '.cmd'];
    const ext = path.extname(filename).toLowerCase();
    
    // Check extension
    if (!gameExtensions.includes(ext)) {
      return false;
    }
    
    // Filter out common non-game executables
    const excludePatterns = [
      /uninstall/i,
      /setup/i,
      /installer/i,
      /updater/i,
      /launcher/i,
      /config/i,
      /settings/i
    ];
    
    return !excludePatterns.some(pattern => pattern.test(filename));
  }

  /**
   * Generate a unique game ID
   */
  private generateGameId(filePath: string): string {
    return crypto.createHash('md5').update(filePath).digest('hex');
  }

  /**
   * Add a new game entry
   */
  private async addGameEntry(filePath: string): Promise<GameEntry> {
    const gameId = this.generateGameId(filePath);
    const stats = await fs.stat(filePath);
    
    const gameEntry: GameEntry = {
      id: gameId,
      name: this.extractGameName(filePath),
      executable: filePath,
      directory: path.dirname(filePath),
      addedAt: Date.now(),
      lastModified: stats.mtime.getTime(),
      lastPlayed: 0,
      playCount: 0,
      totalPlaytime: 0,
      size: stats.size,
      version: '',
      categories: ['Uncategorized'],
      tags: [],
      favorite: false,
      hidden: false,
      metadata: null,
      thumbnail: null,
      notes: '',
      customFields: new Map()
    };
    
    this.library.set(gameId, gameEntry);
    
    // Load metadata if enabled
    if (this.config.enableMetadata) {
      this.loadGameMetadata(gameEntry).catch(error => {
        console.warn(`Failed to load metadata for ${gameEntry.name}:`, error.message);
      });
    }
    
    console.log(`➕ Added game: ${gameEntry.name}`);
    this.emit('gameAdded', gameEntry);
    
    return gameEntry;
  }

  /**
   * Update an existing game entry
   */
  private async updateGameEntry(gameEntry: GameEntry, filePath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(filePath);
      const lastModified = stats.mtime.getTime();
      
      if (lastModified !== gameEntry.lastModified) {
        gameEntry.lastModified = lastModified;
        gameEntry.size = stats.size;
        
        console.log(`🔄 Updated game: ${gameEntry.name}`);
        this.emit('gameUpdated', gameEntry);
        
        return true;
      }
      
      return false;
      
    } catch (error) {
      console.error(`Error updating game entry ${gameEntry.name}:`, error);
      return false;
    }
  }

  /**
   * Extract game name from file path
   */
  private extractGameName(filePath: string): string {
    const filename = path.basename(filePath, path.extname(filePath));
    
    // Clean up common patterns
    return filename
      .replace(/[_-]/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase())
      .trim();
  }

  /**
   * Load game metadata from various sources
   */
  private async loadGameMetadata(gameEntry: GameEntry): Promise<void> {
    try {
      let metadata: GameMetadata | null = null;
      
      // Check cache first
      const cacheKey = `${gameEntry.name.toLowerCase()}`;
      if (this.metadataCache.has(cacheKey)) {
        metadata = this.metadataCache.get(cacheKey)!;
      } else {
        // Try different metadata providers
        for (const provider of this.config.metadataProviders) {
          try {
            metadata = await this.fetchMetadata(gameEntry.name, provider);
            if (metadata) {
              this.metadataCache.set(cacheKey, metadata);
              break;
            }
          } catch (error) {
            console.warn(`Metadata provider ${provider} failed:`, error.message);
          }
        }
      }
      
      if (metadata) {
        gameEntry.metadata = metadata;
        
        // Update game name if metadata provides a better one
        if (metadata.title && metadata.title !== gameEntry.name) {
          console.log(`📝 Updated game name: ${gameEntry.name} -> ${metadata.title}`);
          gameEntry.name = metadata.title;
        }
        
        // Auto-categorize based on metadata
        if (metadata.genres && metadata.genres.length > 0) {
          gameEntry.categories = metadata.genres;
        }
        
        // Download thumbnail if enabled
        if (this.config.enableThumbnails && metadata.thumbnail) {
          this.downloadThumbnail(gameEntry, metadata.thumbnail).catch(error => {
            console.warn(`Failed to download thumbnail for ${gameEntry.name}:`, error.message);
          });
        }
        
        this.emit('metadataLoaded', { gameEntry, metadata });
      }
      
    } catch (error) {
      console.error(`Error loading metadata for ${gameEntry.name}:`, error);
    }
  }

  /**
   * Fetch metadata from a specific provider
   */
  private async fetchMetadata(gameName: string, provider: string): Promise<GameMetadata | null> {
    switch (provider) {
      case 'local':
        return this.fetchLocalMetadata(gameName);
      
      case 'igdb':
        return this.fetchIGDBMetadata(gameName);
      
      case 'steam':
        return this.fetchSteamMetadata(gameName);
      
      default:
        throw new Error(`Unknown metadata provider: ${provider}`);
    }
  }

  /**
   * Fetch metadata from local sources
   */
  private async fetchLocalMetadata(gameName: string): Promise<GameMetadata | null> {
    // This would look for local metadata files, registry entries, etc.
    // For now, return null as this is a simplified implementation
    return null;
  }

  /**
   * Fetch metadata from IGDB (Internet Game Database)
   */
  private async fetchIGDBMetadata(gameName: string): Promise<GameMetadata | null> {
    // This would integrate with IGDB API
    // For demonstration, return mock data
    return {
      title: gameName,
      description: `A great game called ${gameName}`,
      developer: 'Unknown Developer',
      publisher: 'Unknown Publisher',
      releaseDate: '2023-01-01',
      genres: ['Action', 'Adventure'],
      rating: 8.5,
      thumbnail: null,
      screenshots: [],
      website: '',
      metacriticScore: 85
    };
  }

  /**
   * Fetch metadata from Steam
   */
  private async fetchSteamMetadata(gameName: string): Promise<GameMetadata | null> {
    // This would integrate with Steam API
    // For demonstration, return null
    return null;
  }

  /**
   * Download and save game thumbnail
   */
  private async downloadThumbnail(gameEntry: GameEntry, thumbnailUrl: string): Promise<void> {
    try {
      // This would download the thumbnail from the URL
      // For demonstration, we'll just set a placeholder path
      const thumbnailPath = path.join(
        this.config.thumbnailDirectory,
        `${gameEntry.id}.jpg`
      );
      
      gameEntry.thumbnail = thumbnailPath;
      
      console.log(`🖼️ Downloaded thumbnail for ${gameEntry.name}`);
      
    } catch (error) {
      console.error(`Failed to download thumbnail for ${gameEntry.name}:`, error);
    }
  }

  /**
   * Launch a game from the library
   */
  async launchGame(gameId: string, options: LaunchOptions = {}): Promise<string> {
    const gameEntry = this.library.get(gameId);
    if (!gameEntry) {
      throw new Error(`Game not found: ${gameId}`);
    }
    
    console.log(`🚀 Launching game: ${gameEntry.name}`);
    
    try {
      // Update play statistics
      gameEntry.lastPlayed = Date.now();
      gameEntry.playCount++;
      
      // Launch the game
      const launchedGameId = await this.launcher.launchGame({
        gameId: gameEntry.id,
        executable: gameEntry.executable,
        args: options.args || [],
        cwd: options.cwd || gameEntry.directory,
        env: options.env
      });
      
      // Track playtime
      this.trackPlaytime(gameEntry, launchedGameId);
      
      this.emit('gameLaunched', { gameEntry, launchedGameId });
      
      return launchedGameId;
      
    } catch (error) {
      console.error(`Failed to launch ${gameEntry.name}:`, error);
      throw error;
    }
  }

  /**
   * Track playtime for a game
   */
  private trackPlaytime(gameEntry: GameEntry, launchedGameId: string): void {
    const startTime = Date.now();
    
    const onGameClosed = (event: any) => {
      if (event.gameId === launchedGameId) {
        const playtime = event.runtime || (Date.now() - startTime);
        gameEntry.totalPlaytime += playtime;
        
        console.log(`⏱️ Game session ended: ${gameEntry.name} (${this.formatDuration(playtime)})`);
        
        this.launcher.off('closed', onGameClosed);
        this.emit('playtimeUpdated', { gameEntry, sessionPlaytime: playtime });
        
        // Save library after playtime update
        this.saveLibrary().catch(error => {
          console.error('Failed to save library after playtime update:', error);
        });
      }
    };
    
    this.launcher.on('closed', onGameClosed);
  }

  /**
   * Get all games in the library
   */
  getAllGames(): GameEntry[] {
    return Array.from(this.library.values());
  }

  /**
   * Get a specific game by ID
   */
  getGame(gameId: string): GameEntry | null {
    return this.library.get(gameId) || null;
  }

  /**
   * Search games by various criteria
   */
  searchGames(query: SearchQuery): GameEntry[] {
    const games = Array.from(this.library.values());
    
    return games.filter(game => {
      // Text search
      if (query.text) {
        const searchText = query.text.toLowerCase();
        const gameText = (
          game.name + ' ' +
          game.categories.join(' ') + ' ' +
          game.tags.join(' ') + ' ' +
          (game.metadata?.developer || '') + ' ' +
          (game.metadata?.publisher || '')
        ).toLowerCase();
        
        if (!gameText.includes(searchText)) {
          return false;
        }
      }
      
      // Category filter
      if (query.categories && query.categories.length > 0) {
        if (!query.categories.some(cat => game.categories.includes(cat))) {
          return false;
        }
      }
      
      // Tag filter
      if (query.tags && query.tags.length > 0) {
        if (!query.tags.some(tag => game.tags.includes(tag))) {
          return false;
        }
      }
      
      // Favorite filter
      if (query.favoritesOnly && !game.favorite) {
        return false;
      }
      
      // Hidden filter
      if (!query.includeHidden && game.hidden) {
        return false;
      }
      
      // Playtime filter
      if (query.minPlaytime && game.totalPlaytime < query.minPlaytime) {
        return false;
      }
      
      if (query.maxPlaytime && game.totalPlaytime > query.maxPlaytime) {
        return false;
      }
      
      return true;
    });
  }

  /**
   * Sort games by various criteria
   */
  sortGames(games: GameEntry[], sortBy: SortCriteria, ascending: boolean = true): GameEntry[] {
    const sorted = [...games].sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        
        case 'lastPlayed':
          comparison = a.lastPlayed - b.lastPlayed;
          break;
        
        case 'playCount':
          comparison = a.playCount - b.playCount;
          break;
        
        case 'totalPlaytime':
          comparison = a.totalPlaytime - b.totalPlaytime;
          break;
        
        case 'addedAt':
          comparison = a.addedAt - b.addedAt;
          break;
        
        case 'size':
          comparison = a.size - b.size;
          break;
        
        case 'rating':
          const ratingA = a.metadata?.rating || 0;
          const ratingB = b.metadata?.rating || 0;
          comparison = ratingA - ratingB;
          break;
        
        default:
          comparison = 0;
      }
      
      return ascending ? comparison : -comparison;
    });
    
    return sorted;
  }

  /**
   * Create a new category
   */
  createCategory(name: string, description: string = '', color: string = '#007acc'): Category {
    const category: Category = {
      id: this.generateCategoryId(name),
      name,
      description,
      color,
      createdAt: Date.now(),
      gameCount: 0
    };
    
    this.categories.set(category.id, category);
    
    console.log(`📁 Created category: ${name}`);
    this.emit('categoryCreated', category);
    
    return category;
  }

  /**
   * Create a new collection
   */
  createCollection(name: string, description: string = ''): Collection {
    const collection: Collection = {
      id: this.generateCollectionId(name),
      name,
      description,
      createdAt: Date.now(),
      gameIds: [],
      tags: []
    };
    
    this.collections.set(collection.id, collection);
    
    console.log(`📚 Created collection: ${name}`);
    this.emit('collectionCreated', collection);
    
    return collection;
  }

  /**
   * Add game to collection
   */
  addGameToCollection(gameId: string, collectionId: string): boolean {
    const game = this.library.get(gameId);
    const collection = this.collections.get(collectionId);
    
    if (!game || !collection) {
      return false;
    }
    
    if (!collection.gameIds.includes(gameId)) {
      collection.gameIds.push(gameId);
      
      console.log(`➕ Added ${game.name} to collection ${collection.name}`);
      this.emit('gameAddedToCollection', { game, collection });
      
      return true;
    }
    
    return false;
  }

  /**
   * Generate library statistics
   */
  generateStatistics(): LibraryStatistics {
    const games = Array.from(this.library.values());
    
    const stats: LibraryStatistics = {
      totalGames: games.length,
      totalPlaytime: games.reduce((sum, game) => sum + game.totalPlaytime, 0),
      totalSessions: games.reduce((sum, game) => sum + game.playCount, 0),
      averagePlaytime: 0,
      mostPlayedGame: null,
      recentlyAdded: [],
      recentlyPlayed: [],
      categoryBreakdown: new Map(),
      sizeBreakdown: {
        totalSize: games.reduce((sum, game) => sum + game.size, 0),
        averageSize: 0,
        largestGame: null,
        smallestGame: null
      }
    };
    
    // Calculate averages
    if (games.length > 0) {
      stats.averagePlaytime = stats.totalPlaytime / games.length;
      stats.sizeBreakdown.averageSize = stats.sizeBreakdown.totalSize / games.length;
    }
    
    // Find most played game
    const mostPlayed = games.reduce((max, game) => 
      game.totalPlaytime > max.totalPlaytime ? game : max, games[0]);
    if (mostPlayed) {
      stats.mostPlayedGame = {
        name: mostPlayed.name,
        playtime: mostPlayed.totalPlaytime
      };
    }
    
    // Recently added games (last 30 days)
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    stats.recentlyAdded = games
      .filter(game => game.addedAt > thirtyDaysAgo)
      .sort((a, b) => b.addedAt - a.addedAt)
      .slice(0, 10)
      .map(game => ({ name: game.name, addedAt: game.addedAt }));
    
    // Recently played games
    stats.recentlyPlayed = games
      .filter(game => game.lastPlayed > 0)
      .sort((a, b) => b.lastPlayed - a.lastPlayed)
      .slice(0, 10)
      .map(game => ({ name: game.name, lastPlayed: game.lastPlayed }));
    
    // Category breakdown
    for (const game of games) {
      for (const category of game.categories) {
        stats.categoryBreakdown.set(
          category,
          (stats.categoryBreakdown.get(category) || 0) + 1
        );
      }
    }
    
    // Size breakdown
    const sortedBySize = [...games].sort((a, b) => b.size - a.size);
    if (sortedBySize.length > 0) {
      stats.sizeBreakdown.largestGame = {
        name: sortedBySize[0].name,
        size: sortedBySize[0].size
      };
      stats.sizeBreakdown.smallestGame = {
        name: sortedBySize[sortedBySize.length - 1].name,
        size: sortedBySize[sortedBySize.length - 1].size
      };
    }
    
    return stats;
  }

  /**
   * Export library data
   */
  async exportLibrary(filePath?: string): Promise<string> {
    const exportPath = filePath || path.join(
      this.config.backupDirectory,
      `library-export-${Date.now()}.json`
    );
    
    const exportData = {
      version: '1.0.0',
      exportedAt: Date.now(),
      library: Array.from(this.library.entries()),
      categories: Array.from(this.categories.entries()),
      collections: Array.from(this.collections.entries()),
      config: this.config
    };
    
    await fs.writeFile(exportPath, JSON.stringify(exportData, null, 2));
    
    console.log(`📤 Library exported to: ${exportPath}`);
    this.emit('libraryExported', { filePath: exportPath });
    
    return exportPath;
  }

  /**
   * Import library data
   */
  async importLibrary(filePath: string, merge: boolean = false): Promise<void> {
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      const importData = JSON.parse(data);
      
      if (!merge) {
        // Clear existing data
        this.library.clear();
        this.categories.clear();
        this.collections.clear();
      }
      
      // Import library
      for (const [id, game] of importData.library) {
        this.library.set(id, game);
      }
      
      // Import categories
      for (const [id, category] of importData.categories) {
        this.categories.set(id, category);
      }
      
      // Import collections
      for (const [id, collection] of importData.collections) {
        this.collections.set(id, collection);
      }
      
      console.log(`📥 Library imported from: ${filePath}`);
      console.log(`   Games: ${this.library.size}`);
      console.log(`   Categories: ${this.categories.size}`);
      console.log(`   Collections: ${this.collections.size}`);
      
      this.emit('libraryImported', { filePath, merge });
      
    } catch (error) {
      console.error('Failed to import library:', error);
      throw error;
    }
  }

  /**
   * Initialize default categories
   */
  private initializeDefaultCategories(): void {
    const defaultCategories = [
      { name: 'Action', color: '#ff4444' },
      { name: 'Adventure', color: '#44ff44' },
      { name: 'RPG', color: '#4444ff' },
      { name: 'Strategy', color: '#ffff44' },
      { name: 'Simulation', color: '#ff44ff' },
      { name: 'Sports', color: '#44ffff' },
      { name: 'Racing', color: '#ff8844' },
      { name: 'Puzzle', color: '#8844ff' },
      { name: 'Indie', color: '#44ff88' },
      { name: 'Uncategorized', color: '#888888' }
    ];
    
    for (const cat of defaultCategories) {
      if (!Array.from(this.categories.values()).some(c => c.name === cat.name)) {
        this.createCategory(cat.name, '', cat.color);
      }
    }
  }

  /**
   * Create necessary directories
   */
  private async createDirectories(): Promise<void> {
    const directories = [
      this.config.thumbnailDirectory,
      this.config.backupDirectory
    ];
    
    for (const dir of directories) {
      try {
        await fs.mkdir(dir, { recursive: true });
      } catch (error) {
        console.warn(`Failed to create directory ${dir}:`, error.message);
      }
    }
  }

  /**
   * Start automatic scanning
   */
  private startAutoScan(): void {
    setInterval(() => {
      if (!this.scanInProgress) {
        this.scanForGames().catch(error => {
          console.error('Auto-scan failed:', error);
        });
      }
    }, this.config.scanInterval);
    
    console.log(`🔄 Auto-scan enabled (interval: ${this.config.scanInterval}ms)`);
  }

  /**
   * Generate category ID
   */
  private generateCategoryId(name: string): string {
    return name.toLowerCase().replace(/\s+/g, '-');
  }

  /**
   * Generate collection ID
   */
  private generateCollectionId(name: string): string {
    return `collection-${Date.now()}-${name.toLowerCase().replace(/\s+/g, '-')}`;
  }

  /**
   * Load library from file
   */
  private async loadLibrary(): Promise<void> {
    try {
      const data = await fs.readFile(this.dataFile, 'utf-8');
      const parsedData = JSON.parse(data);
      
      // Load library
      if (parsedData.library) {
        for (const [id, game] of parsedData.library) {
          this.library.set(id, game);
        }
      }
      
      // Load categories
      if (parsedData.categories) {
        for (const [id, category] of parsedData.categories) {
          this.categories.set(id, category);
        }
      }
      
      // Load collections
      if (parsedData.collections) {
        for (const [id, collection] of parsedData.collections) {
          this.collections.set(id, collection);
        }
      }
      
      console.log(`📂 Loaded library from ${this.dataFile}`);
      
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log('📂 No existing library file found, starting fresh');
      } else {
        console.error('Failed to load library:', error);
      }
    }
  }

  /**
   * Save library to file
   */
  private async saveLibrary(): Promise<void> {
    try {
      const saveData = {
        version: '1.0.0',
        savedAt: Date.now(),
        library: Array.from(this.library.entries()),
        categories: Array.from(this.categories.entries()),
        collections: Array.from(this.collections.entries())
      };
      
      await fs.writeFile(this.dataFile, JSON.stringify(saveData, null, 2));
      
    } catch (error) {
      console.error('Failed to save library:', error);
    }
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
   * Clean up and save
   */
  async destroy(): Promise<void> {
    console.log('🧹 Cleaning up Game Library Manager...');
    
    // Save library
    await this.saveLibrary();
    
    // Clean up launcher
    this.launcher.destroy();
    
    // Remove all listeners
    this.removeAllListeners();
    
    console.log('✅ Game Library Manager cleaned up');
  }
}

// Type definitions
interface LibraryConfig {
  libraryPath: string;
  scanDirectories: string[];
  autoScan: boolean;
  scanInterval: number;
  enableMetadata: boolean;
  metadataProviders: string[];
  enableThumbnails: boolean;
  thumbnailDirectory: string;
  enableBackups: boolean;
  backupDirectory: string;
  maxBackups: number;
  enableSync: boolean;
  syncEndpoint: string;
}

interface GameEntry {
  id: string;
  name: string;
  executable: string;
  directory: string;
  addedAt: number;
  lastModified: number;
  lastPlayed: number;
  playCount: number;
  totalPlaytime: number;
  size: number;
  version: string;
  categories: string[];
  tags: string[];
  favorite: boolean;
  hidden: boolean;
  metadata: GameMetadata | null;
  thumbnail: string | null;
  notes: string;
  customFields: Map<string, any>;
}

interface GameMetadata {
  title: string;
  description: string;
  developer: string;
  publisher: string;
  releaseDate: string;
  genres: string[];
  rating: number;
  thumbnail: string | null;
  screenshots: string[];
  website: string;
  metacriticScore: number;
}

interface Category {
  id: string;
  name: string;
  description: string;
  color: string;
  createdAt: number;
  gameCount: number;
}

interface Collection {
  id: string;
  name: string;
  description: string;
  createdAt: number;
  gameIds: string[];
  tags: string[];
}

interface LaunchOptions {
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
}

interface SearchQuery {
  text?: string;
  categories?: string[];
  tags?: string[];
  favoritesOnly?: boolean;
  includeHidden?: boolean;
  minPlaytime?: number;
  maxPlaytime?: number;
}

type SortCriteria = 'name' | 'lastPlayed' | 'playCount' | 'totalPlaytime' | 'addedAt' | 'size' | 'rating';

interface ScanResult {
  startTime: number;
  endTime: number;
  directoriesScanned: number;
  gamesFound: number;
  gamesAdded: number;
  gamesUpdated: number;
  errors: { directory: string; error: string }[];
}

interface DirectoryScanResult {
  gamesFound: number;
  gamesAdded: number;
  gamesUpdated: number;
}

interface LibraryStatistics {
  totalGames: number;
  totalPlaytime: number;
  totalSessions: number;
  averagePlaytime: number;
  mostPlayedGame: { name: string; playtime: number } | null;
  recentlyAdded: { name: string; addedAt: number }[];
  recentlyPlayed: { name: string; lastPlayed: number }[];
  categoryBreakdown: Map<string, number>;
  sizeBreakdown: {
    totalSize: number;
    averageSize: number;
    largestGame: { name: string; size: number } | null;
    smallestGame: { name: string; size: number } | null;
  };
}

/**
 * Example usage of Game Library Manager
 */
async function gameLibraryExample() {
  const libraryManager = new GameLibraryManager({
    libraryPath: './my-game-library.json',
    scanDirectories: [
      'C:\\Games',
      'C:\\Program Files (x86)\\Steam\\steamapps\\common',
      'D:\\Games'
    ],
    autoScan: true,
    enableMetadata: true,
    enableThumbnails: true
  });
  
  try {
    // Set up event listeners
    libraryManager.on('gameAdded', (game) => {
      console.log(`🎯 New game added: ${game.name}`);
    });
    
    libraryManager.on('scanCompleted', (result) => {
      console.log(`📊 Scan completed: ${result.gamesAdded} new games, ${result.gamesUpdated} updated`);
    });
    
    libraryManager.on('gameLaunched', (event) => {
      console.log(`🚀 Launched: ${event.gameEntry.name}`);
    });
    
    console.log('🚀 Starting game library example...');
    
    // Add scan directories
    libraryManager.addScanDirectory('./test-games');
    
    // Perform initial scan
    console.log('🔍 Scanning for games...');
    const scanResult = await libraryManager.scanForGames();
    
    console.log('📊 Scan Results:');
    console.log(`   Directories scanned: ${scanResult.directoriesScanned}`);
    console.log(`   Games found: ${scanResult.gamesFound}`);
    console.log(`   Games added: ${scanResult.gamesAdded}`);
    
    // Get all games
    const allGames = libraryManager.getAllGames();
    console.log(`\n📚 Library contains ${allGames.length} games:`);
    
    allGames.slice(0, 5).forEach(game => {
      console.log(`   ${game.name} (${game.categories.join(', ')})`);
    });
    
    // Search for games
    console.log('\n🔍 Searching for action games...');
    const actionGames = libraryManager.searchGames({
      categories: ['Action']
    });
    console.log(`Found ${actionGames.length} action games`);
    
    // Create a collection
    const favoriteCollection = libraryManager.createCollection(
      'Favorites',
      'My favorite games'
    );
    
    // Add games to collection
    if (allGames.length > 0) {
      libraryManager.addGameToCollection(allGames[0].id, favoriteCollection.id);
    }
    
    // Generate statistics
    console.log('\n📈 Library Statistics:');
    const stats = libraryManager.generateStatistics();
    console.log(`   Total games: ${stats.totalGames}`);
    console.log(`   Total playtime: ${libraryManager.formatDuration(stats.totalPlaytime)}`);
    console.log(`   Total sessions: ${stats.totalSessions}`);
    
    if (stats.mostPlayedGame) {
      console.log(`   Most played: ${stats.mostPlayedGame.name} (${libraryManager.formatDuration(stats.mostPlayedGame.playtime)})`);
    }
    
    // Category breakdown
    console.log('\n📁 Category Breakdown:');
    for (const [category, count] of stats.categoryBreakdown) {
      console.log(`   ${category}: ${count} games`);
    }
    
    // Launch a game if available
    if (allGames.length > 0) {
      const gameToLaunch = allGames[0];
      console.log(`\n🚀 Launching ${gameToLaunch.name}...`);
      
      try {
        const launchedGameId = await libraryManager.launchGame(gameToLaunch.id);
        console.log(`✅ Game launched: ${launchedGameId}`);
        
        // Wait a bit then close
        setTimeout(async () => {
          try {
            await libraryManager.launcher.closeGame(launchedGameId);
            console.log('🔴 Game closed');
          } catch (error) {
            console.warn('Failed to close game:', error.message);
          }
        }, 5000);
        
      } catch (error) {
        console.warn(`Failed to launch ${gameToLaunch.name}:`, error.message);
      }
    }
    
    // Export library
    console.log('\n📤 Exporting library...');
    const exportPath = await libraryManager.exportLibrary();
    console.log(`✅ Library exported to: ${exportPath}`);
    
  } catch (error) {
    console.error('💥 Game library example failed:', error);
  } finally {
    // Clean up after a delay
    setTimeout(async () => {
      await libraryManager.destroy();
    }, 10000);
  }
}

// Run the example
if (require.main === module) {
  gameLibraryExample()
    .then(() => {
      console.log('✨ Game library example completed!');
    })
    .catch((error) => {
      console.error('💥 Example failed:', error);
      process.exit(1);
    });
}

export { GameLibraryManager, gameLibraryExample };
```

## Usage Examples

### Basic Library Setup

```typescript
import { GameLibraryManager } from './game-library-manager';

const library = new GameLibraryManager({
  libraryPath: './my-games.json',
  scanDirectories: [
    'C:\\Games',
    'C:\\Program Files\\Steam\\steamapps\\common'
  ],
  autoScan: true
});

// Scan for games
const result = await library.scanForGames();
console.log(`Found ${result.gamesAdded} new games`);
```

### Game Search and Filtering

```typescript
// Search by text
const games = library.searchGames({
  text: 'minecraft'
});

// Filter by category
const actionGames = library.searchGames({
  categories: ['Action', 'Adventure']
});

// Filter favorites only
const favorites = library.searchGames({
  favoritesOnly: true
});

// Complex search
const complexSearch = library.searchGames({
  text: 'strategy',
  categories: ['Strategy'],
  minPlaytime: 3600000, // 1 hour
  includeHidden: false
});
```

### Game Organization

```typescript
// Create categories
const indieCategory = library.createCategory('Indie', 'Independent games', '#44ff88');
const retroCategory = library.createCategory('Retro', 'Classic games', '#ff8844');

// Create collections
const currentlyPlaying = library.createCollection(
  'Currently Playing',
  'Games I\'m actively playing'
);

const completed = library.createCollection(
  'Completed',
  'Games I\'ve finished'
);

// Add games to collections
library.addGameToCollection(gameId, currentlyPlaying.id);
```

### Launching Games

```typescript
// Simple launch
const gameId = await library.launchGame('game-id');

// Launch with options
const gameId = await library.launchGame('game-id', {
  args: ['--windowed', '--resolution=1920x1080'],
  env: { GAME_MODE: 'debug' }
});
```

### Statistics and Reporting

```typescript
// Generate comprehensive statistics
const stats = library.generateStatistics();

console.log(`Total games: ${stats.totalGames}`);
console.log(`Total playtime: ${formatDuration(stats.totalPlaytime)}`);
console.log(`Most played: ${stats.mostPlayedGame?.name}`);

// Category breakdown
for (const [category, count] of stats.categoryBreakdown) {
  console.log(`${category}: ${count} games`);
}
```

## Features

### 1. Automatic Game Discovery
- **Directory Scanning**: Recursively scan configured directories
- **Smart Detection**: Identify game executables vs. utilities
- **Auto-Update**: Detect changes and update library
- **Duplicate Prevention**: Avoid duplicate entries

### 2. Metadata Management
- **Multiple Sources**: Local files, IGDB, Steam API
- **Rich Information**: Descriptions, ratings, screenshots
- **Thumbnail Support**: Automatic thumbnail downloading
- **Caching**: Efficient metadata caching

### 3. Organization Tools
- **Categories**: Genre-based organization
- **Collections**: Custom game groupings
- **Tags**: Flexible labeling system
- **Favorites**: Mark preferred games

### 4. Search and Filtering
- **Text Search**: Search names, developers, publishers
- **Category Filtering**: Filter by game genres
- **Advanced Filters**: Playtime, size, rating filters
- **Sorting**: Multiple sort criteria

### 5. Statistics and Analytics
- **Playtime Tracking**: Automatic session tracking
- **Usage Statistics**: Play counts, session lengths
- **Library Insights**: Size breakdown, category distribution
- **Trends**: Recently added, recently played

## Advanced Usage

### Custom Metadata Providers

```typescript
class CustomLibraryManager extends GameLibraryManager {
  protected async fetchMetadata(gameName: string, provider: string): Promise<GameMetadata | null> {
    if (provider === 'custom') {
      // Implement custom metadata fetching
      return await this.fetchCustomMetadata(gameName);
    }
    
    return super.fetchMetadata(gameName, provider);
  }
  
  private async fetchCustomMetadata(gameName: string): Promise<GameMetadata | null> {
    // Custom implementation
    return null;
  }
}
```

### Database Integration

```typescript
class DatabaseLibraryManager extends GameLibraryManager {
  private db: Database;
  
  constructor(config: LibraryConfig, database: Database) {
    super(config);
    this.db = database;
  }
  
  protected async saveLibrary(): Promise<void> {
    // Save to database instead of file
    for (const [id, game] of this.library) {
      await this.db.saveGame(game);
    }
  }
  
  protected async loadLibrary(): Promise<void> {
    // Load from database
    const games = await this.db.loadGames();
    for (const game of games) {
      this.library.set(game.id, game);
    }
  }
}
```

### Cloud Synchronization

```typescript
class CloudSyncLibraryManager extends GameLibraryManager {
  private syncService: CloudSyncService;
  
  async syncWithCloud(): Promise<void> {
    console.log('☁️ Syncing library with cloud...');
    
    try {
      // Upload local changes
      const localChanges = this.getLocalChanges();
      await this.syncService.uploadChanges(localChanges);
      
      // Download remote changes
      const remoteChanges = await this.syncService.downloadChanges();
      this.applyRemoteChanges(remoteChanges);
      
      console.log('✅ Cloud sync completed');
      
    } catch (error) {
      console.error('❌ Cloud sync failed:', error);
      throw error;
    }
  }
}
```

### Game Installation Tracking

```typescript
class InstallationTracker extends GameLibraryManager {
  private installations: Map<string, Installation> = new Map();
  
  async trackInstallation(gameId: string, installer: string): Promise<string> {
    const installation: Installation = {
      id: `install-${Date.now()}`,
      gameId,
      installer,
      startTime: Date.now(),
      status: 'installing',
      progress: 0
    };
    
    this.installations.set(installation.id, installation);
    
    // Monitor installation progress
    this.monitorInstallation(installation);
    
    return installation.id;
  }
  
  private monitorInstallation(installation: Installation): void {
    const interval = setInterval(async () => {
      try {
        const progress = await this.getInstallationProgress(installation.installer);
        installation.progress = progress;
        
        if (progress >= 100) {
          installation.status = 'completed';
          installation.endTime = Date.now();
          clearInterval(interval);
          
          // Rescan to pick up the new game
          await this.scanForGames();
        }
        
        this.emit('installationProgress', installation);
        
      } catch (error) {
        installation.status = 'failed';
        installation.error = error.message;
        clearInterval(interval);
        
        this.emit('installationFailed', installation);
      }
    }, 1000);
  }
}

interface Installation {
  id: string;
  gameId: string;
  installer: string;
  startTime: number;
  endTime?: number;
  status: 'installing' | 'completed' | 'failed';
  progress: number;
  error?: string;
}
```

### Library Analytics Dashboard

```typescript
class LibraryAnalytics {
  static generateDashboardData(library: GameLibraryManager): DashboardData {
    const games = library.getAllGames();
    const stats = library.generateStatistics();
    
    return {
      overview: {
        totalGames: stats.totalGames,
        totalPlaytime: stats.totalPlaytime,
        averagePlaytime: stats.averagePlaytime,
        totalSize: stats.sizeBreakdown.totalSize
      },
      trends: {
        recentlyAdded: stats.recentlyAdded,
        recentlyPlayed: stats.recentlyPlayed,
        playingTrends: this.calculatePlayingTrends(games)
      },
      categories: Array.from(stats.categoryBreakdown.entries()),
      topGames: this.getTopGames(games),
      insights: this.generateInsights(games, stats)
    };
  }
  
  static generateInsights(games: GameEntry[], stats: LibraryStatistics): string[] {
    const insights: string[] = [];
    
    // Library size insights
    if (stats.totalGames > 100) {
      insights.push('You have a large game library! Consider organizing with collections.');
    }
    
    // Playtime insights
    const avgSessionLength = stats.totalPlaytime / stats.totalSessions;
    if (avgSessionLength > 2 * 60 * 60 * 1000) { // 2 hours
      insights.push('You tend to have long gaming sessions.');
    }
    
    // Category insights
    const topCategory = Array.from(stats.categoryBreakdown.entries())
      .sort((a, b) => b[1] - a[1])[0];
    if (topCategory) {
      insights.push(`You have a preference for ${topCategory[0]} games.`);
    }
    
    return insights;
  }
}

interface DashboardData {
  overview: {
    totalGames: number;
    totalPlaytime: number;
    averagePlaytime: number;
    totalSize: number;
  };
  trends: {
    recentlyAdded: { name: string; addedAt: number }[];
    recentlyPlayed: { name: string; lastPlayed: number }[];
    playingTrends: any[];
  };
  categories: [string, number][];
  topGames: GameEntry[];
  insights: string[];
}
```

## Configuration Options

### Basic Configuration

```typescript
const library = new GameLibraryManager({
  libraryPath: './games.json',
  scanDirectories: ['C:\\Games'],
  autoScan: true,
  enableMetadata: true
});
```

### Advanced Configuration

```typescript
const library = new GameLibraryManager({
  libraryPath: './library/games.json',
  scanDirectories: [
    'C:\\Games',
    'C:\\Program Files (x86)\\Steam\\steamapps\\common',
    'D:\\Epic Games',
    'E:\\GOG Games'
  ],
  autoScan: true,
  scanInterval: 1800000, // 30 minutes
  enableMetadata: true,
  metadataProviders: ['local', 'igdb', 'steam'],
  enableThumbnails: true,
  thumbnailDirectory: './library/thumbnails',
  enableBackups: true,
  backupDirectory: './library/backups',
  maxBackups: 5,
  enableSync: true,
  syncEndpoint: 'https://api.mygamelibrary.com/sync'
});
```

## Best Practices

### 1. Directory Organization

```typescript
// Organize scan directories by platform
const library = new GameLibraryManager({
  scanDirectories: [
    'C:\\Games\\Steam',
    'C:\\Games\\Epic',
    'C:\\Games\\GOG',
    'C:\\Games\\Indie',
    'D:\\Retro Games'
  ]
});
```

### 2. Metadata Caching

```typescript
// Implement efficient metadata caching
class CachedLibraryManager extends GameLibraryManager {
  private metadataCache = new Map<string, { data: GameMetadata; timestamp: number }>();
  private cacheTimeout = 24 * 60 * 60 * 1000; // 24 hours
  
  protected async fetchMetadata(gameName: string, provider: string): Promise<GameMetadata | null> {
    const cacheKey = `${gameName}-${provider}`;
    const cached = this.metadataCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    
    const metadata = await super.fetchMetadata(gameName, provider);
    if (metadata) {
      this.metadataCache.set(cacheKey, {
        data: metadata,
        timestamp: Date.now()
      });
    }
    
    return metadata;
  }
}
```

### 3. Performance Optimization

```typescript
// Batch operations for better performance
class OptimizedLibraryManager extends GameLibraryManager {
  async batchUpdateGames(gameIds: string[]): Promise<void> {
    const batchSize = 10;
    
    for (let i = 0; i < gameIds.length; i += batchSize) {
      const batch = gameIds.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (gameId) => {
        const game = this.library.get(gameId);
        if (game) {
          await this.updateGameEntry(game, game.executable);
        }
      }));
      
      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
}
```

### 4. Error Handling

```typescript
// Robust error handling
class RobustLibraryManager extends GameLibraryManager {
  async scanForGames(): Promise<ScanResult> {
    try {
      return await super.scanForGames();
    } catch (error) {
      console.error('Scan failed, attempting recovery:', error);
      
      // Attempt to recover from partial scan
      await this.recoverFromFailedScan();
      
      throw error;
    }
  }
  
  private async recoverFromFailedScan(): Promise<void> {
    // Save current state
    await this.saveLibrary();
    
    // Clear problematic data
    this.clearCorruptedEntries();
    
    console.log('Recovery completed');
  }
}
```

## Troubleshooting

### Common Issues

1. **Games Not Detected**
   - Check scan directory paths
   - Verify file permissions
   - Review executable detection patterns

2. **Metadata Loading Fails**
   - Check internet connection
   - Verify API credentials
   - Review rate limiting

3. **Performance Issues**
   - Reduce scan frequency
   - Implement batch processing
   - Use metadata caching

4. **Library Corruption**
   - Enable automatic backups
   - Implement data validation
   - Use atomic file operations

### Debug Mode

```typescript
const library = new GameLibraryManager({
  // ... other config
  verbose: true,
  debugMode: true
});

// Enable detailed logging
library.on('debug', (message) => {
  console.log(`[DEBUG] ${message}`);
});
```

## Next Steps

- **[Steam Integration](steam-integration.md)** - Integrate with Steam library
- **[Multiple Games](multiple-games.md)** - Launch multiple games simultaneously
- **[Playtime Tracker](playtime-tracker.md)** - Advanced playtime tracking
- **[API Documentation](../api/README.md)** - Complete API reference
- **[Best Practices](../guides/best-practices.md)** - Recommended patterns

## Related Examples

- [Simple Launcher](simple-launcher.md) - Basic game launching
- [Event Handling](event-handling.md) - Event system patterns
- [Steam Integration](steam-integration.md) - Steam platform integration

---

*This example demonstrates advanced game library management capabilities. For production use, consider implementing proper error handling, data validation, and security measures.*
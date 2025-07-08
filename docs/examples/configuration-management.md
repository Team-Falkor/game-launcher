# Configuration Management

This example demonstrates advanced configuration management patterns for the Game Launcher library, including environment-based configs, validation, hot reloading, and configuration profiles.

## Overview

The Configuration Management example covers:
- Environment-based configuration
- Configuration validation and schemas
- Hot reloading and dynamic updates
- Configuration profiles and inheritance
- Secure configuration handling
- Configuration versioning
- Multi-environment deployment

## Prerequisites

- Node.js 16.0.0 or higher
- Game Launcher library installed
- Understanding of configuration patterns
- Optional: Configuration management tools

## Code

### Complete Configuration Manager

```typescript
import { GameLauncher, GameLauncherOptions } from '@team-falkor/game-launcher';
import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { watch } from 'fs';

/**
 * Advanced Configuration Manager
 * Handles complex configuration scenarios with validation and hot reloading
 */
class ConfigurationManager extends EventEmitter {
  private configs: Map<string, GameConfiguration> = new Map();
  private schemas: Map<string, ConfigurationSchema> = new Map();
  private watchers: Map<string, fs.FSWatcher> = new Map();
  private profiles: Map<string, ConfigurationProfile> = new Map();
  private activeProfile: string = 'default';
  private configDirectory: string;
  private environment: string;
  private encryptionKey?: string;

  constructor(options: ConfigurationManagerOptions = {}) {
    super();
    
    this.configDirectory = options.configDirectory || this.getDefaultConfigDirectory();
    this.environment = options.environment || process.env.NODE_ENV || 'development';
    this.encryptionKey = options.encryptionKey || process.env.CONFIG_ENCRYPTION_KEY;
    
    console.log(`🔧 Configuration manager initialized for ${this.environment}`);
    console.log(`📁 Config directory: ${this.configDirectory}`);
  }

  /**
   * Get default configuration directory
   */
  private getDefaultConfigDirectory(): string {
    const platform = os.platform();
    
    switch (platform) {
      case 'win32':
        return path.join(os.homedir(), 'AppData', 'Local', 'GameLauncher', 'config');
      case 'darwin':
        return path.join(os.homedir(), 'Library', 'Application Support', 'GameLauncher', 'config');
      default:
        return path.join(os.homedir(), '.config', 'game-launcher');
    }
  }

  /**
   * Initialize configuration system
   */
  async initialize(): Promise<void> {
    try {
      // Ensure config directory exists
      await fs.mkdir(this.configDirectory, { recursive: true });
      
      // Load configuration schemas
      await this.loadSchemas();
      
      // Load configuration profiles
      await this.loadProfiles();
      
      // Load environment-specific configurations
      await this.loadConfigurations();
      
      // Set up file watchers for hot reloading
      await this.setupWatchers();
      
      console.log('✅ Configuration manager initialized successfully');
      this.emit('initialized');
      
    } catch (error) {
      console.error('❌ Failed to initialize configuration manager:', error);
      throw error;
    }
  }

  /**
   * Load configuration schemas
   */
  private async loadSchemas(): Promise<void> {
    const schemasPath = path.join(this.configDirectory, 'schemas');
    
    try {
      await fs.mkdir(schemasPath, { recursive: true });
      
      // Create default schemas if they don't exist
      await this.createDefaultSchemas();
      
      // Load all schema files
      const schemaFiles = await fs.readdir(schemasPath);
      
      for (const file of schemaFiles) {
        if (file.endsWith('.json')) {
          const schemaPath = path.join(schemasPath, file);
          const schemaContent = await fs.readFile(schemaPath, 'utf-8');
          const schema: ConfigurationSchema = JSON.parse(schemaContent);
          
          const schemaName = path.basename(file, '.json');
          this.schemas.set(schemaName, schema);
          
          console.log(`📋 Loaded schema: ${schemaName}`);
        }
      }
      
    } catch (error) {
      console.warn('⚠️ Failed to load schemas:', error.message);
    }
  }

  /**
   * Create default configuration schemas
   */
  private async createDefaultSchemas(): Promise<void> {
    const schemas = {
      'game-launcher': {
        type: 'object',
        properties: {
          verbose: { type: 'boolean', default: false },
          maxConcurrentGames: { type: 'number', minimum: 1, maximum: 10, default: 3 },
          defaultTimeout: { type: 'number', minimum: 1000, default: 30000 },
          logLevel: { 
            type: 'string', 
            enum: ['error', 'warn', 'info', 'debug'], 
            default: 'info' 
          },
          processManager: {
            type: 'object',
            properties: {
              killTimeout: { type: 'number', minimum: 1000, default: 5000 },
              maxRetries: { type: 'number', minimum: 0, default: 3 }
            }
          }
        },
        required: ['verbose']
      },
      'game': {
        type: 'object',
        properties: {
          id: { type: 'string', pattern: '^[a-z0-9-]+$' },
          name: { type: 'string', minLength: 1 },
          executable: { type: 'string', minLength: 1 },
          args: { type: 'array', items: { type: 'string' } },
          cwd: { type: 'string' },
          env: { type: 'object', additionalProperties: { type: 'string' } },
          timeout: { type: 'number', minimum: 1000 },
          retries: { type: 'number', minimum: 0, maximum: 5 }
        },
        required: ['id', 'name', 'executable']
      },
      'profile': {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1 },
          description: { type: 'string' },
          extends: { type: 'string' },
          environment: { type: 'string' },
          settings: { type: 'object' },
          games: { type: 'array', items: { type: 'string' } }
        },
        required: ['name']
      }
    };
    
    for (const [name, schema] of Object.entries(schemas)) {
      const schemaPath = path.join(this.configDirectory, 'schemas', `${name}.json`);
      
      try {
        await fs.access(schemaPath);
      } catch {
        await fs.writeFile(schemaPath, JSON.stringify(schema, null, 2));
        console.log(`📋 Created default schema: ${name}`);
      }
    }
  }

  /**
   * Load configuration profiles
   */
  private async loadProfiles(): Promise<void> {
    const profilesPath = path.join(this.configDirectory, 'profiles');
    
    try {
      await fs.mkdir(profilesPath, { recursive: true });
      
      // Create default profiles if they don't exist
      await this.createDefaultProfiles();
      
      // Load all profile files
      const profileFiles = await fs.readdir(profilesPath);
      
      for (const file of profileFiles) {
        if (file.endsWith('.json')) {
          const profilePath = path.join(profilesPath, file);
          const profileContent = await fs.readFile(profilePath, 'utf-8');
          const profile: ConfigurationProfile = JSON.parse(profileContent);
          
          // Validate profile
          await this.validateConfiguration(profile, 'profile');
          
          this.profiles.set(profile.name, profile);
          console.log(`👤 Loaded profile: ${profile.name}`);
        }
      }
      
    } catch (error) {
      console.warn('⚠️ Failed to load profiles:', error.message);
    }
  }

  /**
   * Create default configuration profiles
   */
  private async createDefaultProfiles(): Promise<void> {
    const profiles: ConfigurationProfile[] = [
      {
        name: 'default',
        description: 'Default configuration profile',
        environment: 'development',
        settings: {
          verbose: false,
          maxConcurrentGames: 3,
          logLevel: 'info'
        },
        games: []
      },
      {
        name: 'development',
        description: 'Development environment profile',
        extends: 'default',
        environment: 'development',
        settings: {
          verbose: true,
          logLevel: 'debug',
          maxConcurrentGames: 1
        },
        games: []
      },
      {
        name: 'production',
        description: 'Production environment profile',
        extends: 'default',
        environment: 'production',
        settings: {
          verbose: false,
          logLevel: 'warn',
          maxConcurrentGames: 5,
          processManager: {
            killTimeout: 10000,
            maxRetries: 5
          }
        },
        games: []
      },
      {
        name: 'gaming',
        description: 'Optimized for gaming performance',
        extends: 'default',
        environment: 'production',
        settings: {
          verbose: false,
          logLevel: 'error',
          maxConcurrentGames: 1,
          processManager: {
            killTimeout: 15000,
            maxRetries: 1
          }
        },
        games: []
      }
    ];
    
    for (const profile of profiles) {
      const profilePath = path.join(this.configDirectory, 'profiles', `${profile.name}.json`);
      
      try {
        await fs.access(profilePath);
      } catch {
        await fs.writeFile(profilePath, JSON.stringify(profile, null, 2));
        console.log(`👤 Created default profile: ${profile.name}`);
      }
    }
  }

  /**
   * Load configurations for current environment
   */
  private async loadConfigurations(): Promise<void> {
    const configPaths = [
      path.join(this.configDirectory, 'config.json'),
      path.join(this.configDirectory, `config.${this.environment}.json`),
      path.join(this.configDirectory, 'games'),
      path.join(this.configDirectory, 'local.json')
    ];
    
    for (const configPath of configPaths) {
      await this.loadConfigurationPath(configPath);
    }
  }

  /**
   * Load configuration from a specific path
   */
  private async loadConfigurationPath(configPath: string): Promise<void> {
    try {
      const stats = await fs.stat(configPath);
      
      if (stats.isDirectory()) {
        // Load all JSON files in directory
        const files = await fs.readdir(configPath);
        
        for (const file of files) {
          if (file.endsWith('.json')) {
            const filePath = path.join(configPath, file);
            await this.loadConfigurationFile(filePath);
          }
        }
      } else if (stats.isFile() && configPath.endsWith('.json')) {
        await this.loadConfigurationFile(configPath);
      }
      
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.warn(`⚠️ Failed to load config from ${configPath}:`, error.message);
      }
    }
  }

  /**
   * Load configuration from a specific file
   */
  private async loadConfigurationFile(filePath: string): Promise<void> {
    try {
      let content = await fs.readFile(filePath, 'utf-8');
      
      // Decrypt if encrypted
      if (content.startsWith('ENCRYPTED:') && this.encryptionKey) {
        content = await this.decryptConfiguration(content);
      }
      
      const config: GameConfiguration = JSON.parse(content);
      const configName = path.basename(filePath, '.json');
      
      // Determine schema type
      const schemaType = this.determineSchemaType(config, configName);
      
      // Validate configuration
      await this.validateConfiguration(config, schemaType);
      
      // Apply environment variable substitution
      const processedConfig = this.processEnvironmentVariables(config);
      
      this.configs.set(configName, processedConfig);
      console.log(`⚙️ Loaded configuration: ${configName}`);
      
      this.emit('configurationLoaded', { name: configName, config: processedConfig });
      
    } catch (error) {
      console.error(`❌ Failed to load configuration file ${filePath}:`, error.message);
      throw error;
    }
  }

  /**
   * Determine schema type for configuration
   */
  private determineSchemaType(config: any, configName: string): string {
    if (config.id && config.executable) {
      return 'game';
    } else if (config.name && (config.extends || config.settings)) {
      return 'profile';
    } else if (configName.includes('launcher') || config.verbose !== undefined) {
      return 'game-launcher';
    }
    
    return 'game-launcher'; // Default schema
  }

  /**
   * Validate configuration against schema
   */
  private async validateConfiguration(config: any, schemaType: string): Promise<void> {
    const schema = this.schemas.get(schemaType);
    if (!schema) {
      console.warn(`⚠️ No schema found for type: ${schemaType}`);
      return;
    }
    
    // Simple validation (in production, use a proper JSON schema validator)
    const errors = this.validateAgainstSchema(config, schema);
    
    if (errors.length > 0) {
      throw new Error(`Configuration validation failed: ${errors.join(', ')}`);
    }
  }

  /**
   * Simple schema validation
   */
  private validateAgainstSchema(data: any, schema: any, path: string = ''): string[] {
    const errors: string[] = [];
    
    if (schema.type === 'object' && schema.properties) {
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        const propPath = path ? `${path}.${key}` : key;
        const value = data[key];
        
        if (schema.required && schema.required.includes(key) && value === undefined) {
          errors.push(`Missing required property: ${propPath}`);
          continue;
        }
        
        if (value !== undefined) {
          errors.push(...this.validateAgainstSchema(value, propSchema, propPath));
        }
      }
    } else if (schema.type && typeof data !== schema.type) {
      errors.push(`Type mismatch at ${path}: expected ${schema.type}, got ${typeof data}`);
    }
    
    if (schema.enum && !schema.enum.includes(data)) {
      errors.push(`Invalid value at ${path}: must be one of ${schema.enum.join(', ')}`);
    }
    
    if (schema.minimum !== undefined && data < schema.minimum) {
      errors.push(`Value at ${path} is below minimum: ${schema.minimum}`);
    }
    
    if (schema.maximum !== undefined && data > schema.maximum) {
      errors.push(`Value at ${path} is above maximum: ${schema.maximum}`);
    }
    
    return errors;
  }

  /**
   * Process environment variable substitution
   */
  private processEnvironmentVariables(config: any): any {
    const processed = JSON.parse(JSON.stringify(config));
    
    const processValue = (value: any): any => {
      if (typeof value === 'string') {
        return value.replace(/\$\{([^}]+)\}/g, (match, envVar) => {
          const [varName, defaultValue] = envVar.split(':-');
          return process.env[varName] || defaultValue || match;
        });
      } else if (Array.isArray(value)) {
        return value.map(processValue);
      } else if (typeof value === 'object' && value !== null) {
        const result: any = {};
        for (const [key, val] of Object.entries(value)) {
          result[key] = processValue(val);
        }
        return result;
      }
      return value;
    };
    
    return processValue(processed);
  }

  /**
   * Setup file watchers for hot reloading
   */
  private async setupWatchers(): Promise<void> {
    const watchPaths = [
      this.configDirectory,
      path.join(this.configDirectory, 'games'),
      path.join(this.configDirectory, 'profiles')
    ];
    
    for (const watchPath of watchPaths) {
      try {
        await fs.access(watchPath);
        
        const watcher = watch(watchPath, { recursive: true }, (eventType, filename) => {
          if (filename && filename.endsWith('.json')) {
            this.handleConfigurationChange(watchPath, filename, eventType);
          }
        });
        
        this.watchers.set(watchPath, watcher);
        console.log(`👁️ Watching for changes: ${watchPath}`);
        
      } catch (error) {
        console.warn(`⚠️ Failed to setup watcher for ${watchPath}:`, error.message);
      }
    }
  }

  /**
   * Handle configuration file changes
   */
  private async handleConfigurationChange(
    watchPath: string,
    filename: string,
    eventType: string
  ): Promise<void> {
    const filePath = path.join(watchPath, filename);
    const configName = path.basename(filename, '.json');
    
    console.log(`🔄 Configuration change detected: ${filename} (${eventType})`);
    
    try {
      if (eventType === 'rename') {
        // File was deleted or renamed
        try {
          await fs.access(filePath);
          // File still exists, it was renamed to this name
          await this.loadConfigurationFile(filePath);
        } catch {
          // File was deleted
          this.configs.delete(configName);
          console.log(`🗑️ Configuration removed: ${configName}`);
          this.emit('configurationRemoved', { name: configName });
        }
      } else if (eventType === 'change') {
        // File was modified
        await this.loadConfigurationFile(filePath);
        console.log(`🔄 Configuration reloaded: ${configName}`);
        this.emit('configurationReloaded', { name: configName });
      }
    } catch (error) {
      console.error(`❌ Failed to handle configuration change for ${filename}:`, error.message);
      this.emit('configurationError', { name: configName, error });
    }
  }

  /**
   * Get configuration with profile inheritance
   */
  getConfiguration(name: string, profileName?: string): GameConfiguration | null {
    const profile = profileName ? this.profiles.get(profileName) : this.profiles.get(this.activeProfile);
    const baseConfig = this.configs.get(name);
    
    if (!baseConfig) {
      return null;
    }
    
    if (!profile) {
      return baseConfig;
    }
    
    // Apply profile inheritance
    let mergedConfig = { ...baseConfig };
    
    if (profile.extends) {
      const parentProfile = this.profiles.get(profile.extends);
      if (parentProfile && parentProfile.settings) {
        mergedConfig = this.mergeConfigurations(mergedConfig, parentProfile.settings);
      }
    }
    
    if (profile.settings) {
      mergedConfig = this.mergeConfigurations(mergedConfig, profile.settings);
    }
    
    return mergedConfig;
  }

  /**
   * Merge configurations with deep merge
   */
  private mergeConfigurations(base: any, override: any): any {
    const result = { ...base };
    
    for (const [key, value] of Object.entries(override)) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        result[key] = this.mergeConfigurations(result[key] || {}, value);
      } else {
        result[key] = value;
      }
    }
    
    return result;
  }

  /**
   * Create a GameLauncher instance with configuration
   */
  createGameLauncher(configName: string = 'config', profileName?: string): GameLauncher {
    const config = this.getConfiguration(configName, profileName);
    
    if (!config) {
      throw new Error(`Configuration not found: ${configName}`);
    }
    
    const launcherOptions: GameLauncherOptions = {
      verbose: config.verbose || false,
      // Add other options as needed
    };
    
    const launcher = new GameLauncher(launcherOptions);
    
    console.log(`🚀 Created GameLauncher with configuration: ${configName}`);
    this.emit('launcherCreated', { configName, profileName, launcher });
    
    return launcher;
  }

  /**
   * Save configuration
   */
  async saveConfiguration(name: string, config: GameConfiguration, encrypt: boolean = false): Promise<void> {
    try {
      // Validate configuration
      const schemaType = this.determineSchemaType(config, name);
      await this.validateConfiguration(config, schemaType);
      
      let content = JSON.stringify(config, null, 2);
      
      // Encrypt if requested
      if (encrypt && this.encryptionKey) {
        content = await this.encryptConfiguration(content);
      }
      
      const configPath = path.join(this.configDirectory, `${name}.json`);
      await fs.writeFile(configPath, content);
      
      this.configs.set(name, config);
      
      console.log(`💾 Configuration saved: ${name}`);
      this.emit('configurationSaved', { name, config });
      
    } catch (error) {
      console.error(`❌ Failed to save configuration ${name}:`, error.message);
      throw error;
    }
  }

  /**
   * Encrypt configuration content
   */
  private async encryptConfiguration(content: string): Promise<string> {
    // Simple encryption (in production, use proper encryption)
    const crypto = require('crypto');
    const cipher = crypto.createCipher('aes192', this.encryptionKey);
    let encrypted = cipher.update(content, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `ENCRYPTED:${encrypted}`;
  }

  /**
   * Decrypt configuration content
   */
  private async decryptConfiguration(encryptedContent: string): Promise<string> {
    const crypto = require('crypto');
    const encrypted = encryptedContent.replace('ENCRYPTED:', '');
    const decipher = crypto.createDecipher('aes192', this.encryptionKey);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  /**
   * Set active profile
   */
  setActiveProfile(profileName: string): void {
    if (!this.profiles.has(profileName)) {
      throw new Error(`Profile not found: ${profileName}`);
    }
    
    const oldProfile = this.activeProfile;
    this.activeProfile = profileName;
    
    console.log(`👤 Active profile changed: ${oldProfile} -> ${profileName}`);
    this.emit('profileChanged', { oldProfile, newProfile: profileName });
  }

  /**
   * Get all available configurations
   */
  getAvailableConfigurations(): string[] {
    return Array.from(this.configs.keys());
  }

  /**
   * Get all available profiles
   */
  getAvailableProfiles(): string[] {
    return Array.from(this.profiles.keys());
  }

  /**
   * Get current environment
   */
  getEnvironment(): string {
    return this.environment;
  }

  /**
   * Get active profile
   */
  getActiveProfile(): string {
    return this.activeProfile;
  }

  /**
   * Export configuration
   */
  async exportConfiguration(name: string, outputPath: string): Promise<void> {
    const config = this.configs.get(name);
    if (!config) {
      throw new Error(`Configuration not found: ${name}`);
    }
    
    const exportData = {
      name,
      environment: this.environment,
      exportedAt: new Date().toISOString(),
      config
    };
    
    await fs.writeFile(outputPath, JSON.stringify(exportData, null, 2));
    console.log(`📤 Configuration exported: ${name} -> ${outputPath}`);
  }

  /**
   * Import configuration
   */
  async importConfiguration(importPath: string): Promise<string> {
    const content = await fs.readFile(importPath, 'utf-8');
    const importData = JSON.parse(content);
    
    if (!importData.name || !importData.config) {
      throw new Error('Invalid configuration export format');
    }
    
    await this.saveConfiguration(importData.name, importData.config);
    
    console.log(`📥 Configuration imported: ${importData.name}`);
    return importData.name;
  }

  /**
   * Clean up resources
   */
  async destroy(): Promise<void> {
    console.log('🧹 Cleaning up configuration manager...');
    
    // Close file watchers
    for (const [path, watcher] of this.watchers) {
      watcher.close();
      console.log(`👁️ Stopped watching: ${path}`);
    }
    
    this.watchers.clear();
    this.configs.clear();
    this.profiles.clear();
    this.schemas.clear();
    
    this.removeAllListeners();
    
    console.log('✅ Configuration manager cleaned up');
  }
}

// Type definitions
interface ConfigurationManagerOptions {
  configDirectory?: string;
  environment?: string;
  encryptionKey?: string;
}

interface GameConfiguration {
  [key: string]: any;
}

interface ConfigurationSchema {
  type: string;
  properties?: Record<string, any>;
  required?: string[];
  [key: string]: any;
}

interface ConfigurationProfile {
  name: string;
  description?: string;
  extends?: string;
  environment?: string;
  settings?: Record<string, any>;
  games?: string[];
}

/**
 * Configuration Factory
 * Provides pre-configured instances for common scenarios
 */
class ConfigurationFactory {
  /**
   * Create development configuration manager
   */
  static createDevelopmentManager(): ConfigurationManager {
    return new ConfigurationManager({
      environment: 'development'
    });
  }

  /**
   * Create production configuration manager
   */
  static createProductionManager(encryptionKey?: string): ConfigurationManager {
    return new ConfigurationManager({
      environment: 'production',
      encryptionKey
    });
  }

  /**
   * Create testing configuration manager
   */
  static createTestingManager(tempDir: string): ConfigurationManager {
    return new ConfigurationManager({
      environment: 'test',
      configDirectory: tempDir
    });
  }
}

/**
 * Configuration Validator
 * Advanced validation utilities
 */
class ConfigurationValidator {
  /**
   * Validate game configuration
   */
  static validateGameConfig(config: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Required fields
    if (!config.id) errors.push('Game ID is required');
    if (!config.name) errors.push('Game name is required');
    if (!config.executable) errors.push('Game executable is required');
    
    // ID format
    if (config.id && !/^[a-z0-9-]+$/.test(config.id)) {
      errors.push('Game ID must contain only lowercase letters, numbers, and hyphens');
    }
    
    // Executable path
    if (config.executable && !path.isAbsolute(config.executable)) {
      warnings.push('Executable path should be absolute for better reliability');
    }
    
    // Arguments
    if (config.args && !Array.isArray(config.args)) {
      errors.push('Game arguments must be an array');
    }
    
    // Environment variables
    if (config.env && typeof config.env !== 'object') {
      errors.push('Environment variables must be an object');
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate launcher configuration
   */
  static validateLauncherConfig(config: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Verbose
    if (config.verbose !== undefined && typeof config.verbose !== 'boolean') {
      errors.push('Verbose must be a boolean');
    }
    
    // Max concurrent games
    if (config.maxConcurrentGames !== undefined) {
      if (typeof config.maxConcurrentGames !== 'number') {
        errors.push('Max concurrent games must be a number');
      } else if (config.maxConcurrentGames < 1 || config.maxConcurrentGames > 10) {
        warnings.push('Max concurrent games should be between 1 and 10');
      }
    }
    
    // Log level
    if (config.logLevel !== undefined) {
      const validLevels = ['error', 'warn', 'info', 'debug'];
      if (!validLevels.includes(config.logLevel)) {
        errors.push(`Log level must be one of: ${validLevels.join(', ')}`);
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Example usage of Configuration Manager
 */
async function configurationExample() {
  const configManager = new ConfigurationManager({
    environment: 'development',
    configDirectory: path.join(process.cwd(), 'config')
  });
  
  try {
    console.log('🚀 Starting configuration management example...');
    
    // Initialize configuration manager
    await configManager.initialize();
    
    // Set up event listeners
    configManager.on('configurationLoaded', (event) => {
      console.log(`📥 Configuration loaded: ${event.name}`);
    });
    
    configManager.on('configurationReloaded', (event) => {
      console.log(`🔄 Configuration reloaded: ${event.name}`);
    });
    
    configManager.on('profileChanged', (event) => {
      console.log(`👤 Profile changed: ${event.oldProfile} -> ${event.newProfile}`);
    });
    
    // Create and save a game configuration
    const gameConfig = {
      id: 'example-game',
      name: 'Example Game',
      executable: process.platform === 'win32' ? 'notepad.exe' : '/usr/bin/gedit',
      args: [],
      env: {
        GAME_MODE: 'example'
      },
      timeout: 30000
    };
    
    await configManager.saveConfiguration('example-game', gameConfig);
    
    // Create and save a launcher configuration
    const launcherConfig = {
      verbose: true,
      maxConcurrentGames: 2,
      logLevel: 'debug',
      processManager: {
        killTimeout: 5000,
        maxRetries: 3
      }
    };
    
    await configManager.saveConfiguration('launcher', launcherConfig);
    
    // List available configurations
    console.log('\n📚 Available configurations:');
    const configs = configManager.getAvailableConfigurations();
    configs.forEach(name => {
      console.log(`   ${name}`);
    });
    
    // List available profiles
    console.log('\n👥 Available profiles:');
    const profiles = configManager.getAvailableProfiles();
    profiles.forEach(name => {
      console.log(`   ${name}`);
    });
    
    // Switch to development profile
    configManager.setActiveProfile('development');
    
    // Get configuration with profile
    const mergedConfig = configManager.getConfiguration('launcher', 'development');
    console.log('\n⚙️ Merged configuration:');
    console.log(JSON.stringify(mergedConfig, null, 2));
    
    // Create GameLauncher with configuration
    const launcher = configManager.createGameLauncher('launcher');
    
    // Demonstrate configuration validation
    console.log('\n✅ Configuration validation:');
    const gameValidation = ConfigurationValidator.validateGameConfig(gameConfig);
    console.log(`Game config valid: ${gameValidation.valid}`);
    if (gameValidation.warnings.length > 0) {
      console.log('Warnings:', gameValidation.warnings);
    }
    
    const launcherValidation = ConfigurationValidator.validateLauncherConfig(launcherConfig);
    console.log(`Launcher config valid: ${launcherValidation.valid}`);
    
    // Export configuration
    const exportPath = path.join(process.cwd(), 'exported-config.json');
    await configManager.exportConfiguration('example-game', exportPath);
    
    // Clean up
    launcher.destroy();
    
  } catch (error) {
    console.error('💥 Configuration example failed:', error);
  } finally {
    // Clean up after a delay
    setTimeout(async () => {
      await configManager.destroy();
    }, 2000);
  }
}

// Run the example
if (require.main === module) {
  configurationExample()
    .then(() => {
      console.log('✨ Configuration management example completed!');
    })
    .catch((error) => {
      console.error('💥 Example failed:', error);
      process.exit(1);
    });
}

export {
  ConfigurationManager,
  ConfigurationFactory,
  ConfigurationValidator,
  configurationExample
};
```

## Usage Examples

### Basic Configuration Setup

```typescript
import { ConfigurationManager } from './configuration-manager';

const configManager = new ConfigurationManager({
  environment: 'development',
  configDirectory: './config'
});

await configManager.initialize();

// Create a game launcher with configuration
const launcher = configManager.createGameLauncher('launcher');
```

### Environment-Based Configuration

```typescript
// config/config.json (base configuration)
{
  "verbose": false,
  "maxConcurrentGames": 3,
  "logLevel": "info"
}

// config/config.development.json (development overrides)
{
  "verbose": true,
  "logLevel": "debug",
  "maxConcurrentGames": 1
}

// config/config.production.json (production overrides)
{
  "verbose": false,
  "logLevel": "warn",
  "maxConcurrentGames": 5
}
```

### Configuration Profiles

```typescript
// profiles/gaming.json
{
  "name": "gaming",
  "description": "Optimized for gaming performance",
  "extends": "default",
  "settings": {
    "verbose": false,
    "maxConcurrentGames": 1,
    "processManager": {
      "killTimeout": 15000
    }
  }
}

// Use the gaming profile
configManager.setActiveProfile('gaming');
const launcher = configManager.createGameLauncher('launcher');
```

### Environment Variable Substitution

```typescript
// Configuration with environment variables
{
  "gameDirectory": "${GAME_DIR:-/usr/games}",
  "logLevel": "${LOG_LEVEL:-info}",
  "maxConcurrentGames": "${MAX_GAMES:-3}"
}

// Environment variables will be substituted automatically
process.env.GAME_DIR = '/opt/games';
process.env.LOG_LEVEL = 'debug';
```

### Hot Reloading

```typescript
// Set up hot reloading listeners
configManager.on('configurationReloaded', (event) => {
  console.log(`Configuration ${event.name} was reloaded`);
  // Restart services or update settings
});

// Configuration files are automatically watched for changes
// Modify config/launcher.json and see it reload automatically
```

### Secure Configuration

```typescript
// Save encrypted configuration
const sensitiveConfig = {
  apiKey: 'secret-api-key',
  databasePassword: 'secret-password'
};

await configManager.saveConfiguration('secrets', sensitiveConfig, true);

// Configuration will be encrypted on disk
// ENCRYPTED:a1b2c3d4e5f6...
```

## Features

### 1. Environment-Based Configuration
- **Multiple Environments**: Support for dev, staging, production
- **Environment Overrides**: Environment-specific configuration files
- **Variable Substitution**: Environment variable interpolation
- **Profile Inheritance**: Hierarchical configuration profiles

### 2. Configuration Validation
- **Schema Validation**: JSON schema-based validation
- **Type Checking**: Runtime type validation
- **Custom Validators**: Extensible validation system
- **Error Reporting**: Detailed validation error messages

### 3. Hot Reloading
- **File Watching**: Automatic configuration file monitoring
- **Live Updates**: Real-time configuration reloading
- **Event Notifications**: Configuration change events
- **Graceful Handling**: Error recovery for invalid configs

### 4. Security Features
- **Encryption**: Optional configuration encryption
- **Secure Storage**: Protected configuration files
- **Access Control**: Environment-based access patterns
- **Secret Management**: Secure handling of sensitive data

### 5. Configuration Profiles
- **Profile Inheritance**: Extend base configurations
- **Environment Profiles**: Environment-specific profiles
- **Dynamic Switching**: Runtime profile changes
- **Profile Validation**: Schema validation for profiles

## Advanced Usage

### Custom Configuration Schema

```typescript
// schemas/custom-game.json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "pattern": "^[a-z0-9-]+$"
    },
    "name": {
      "type": "string",
      "minLength": 1,
      "maxLength": 100
    },
    "executable": {
      "type": "string",
      "minLength": 1
    },
    "platform": {
      "type": "string",
      "enum": ["windows", "macos", "linux"]
    },
    "requirements": {
      "type": "object",
      "properties": {
        "minMemory": { "type": "number", "minimum": 0 },
        "minCpuCores": { "type": "number", "minimum": 1 }
      }
    }
  },
  "required": ["id", "name", "executable"]
}
```

### Configuration Factory Patterns

```typescript
class GameConfigurationFactory {
  static createSteamGame(appId: string, name: string): GameConfiguration {
    return {
      id: `steam-${appId}`,
      name,
      executable: this.getSteamExecutable(),
      args: ['-applaunch', appId],
      platform: this.getCurrentPlatform()
    };
  }
  
  static createEpicGame(gameId: string, name: string): GameConfiguration {
    return {
      id: `epic-${gameId}`,
      name,
      executable: 'com.epicgames.launcher://apps/' + gameId,
      platform: this.getCurrentPlatform()
    };
  }
}
```

### Configuration Migration

```typescript
class ConfigurationMigrator {
  static async migrateToVersion2(config: any): Promise<any> {
    // Migrate from version 1 to version 2
    if (config.version === 1) {
      return {
        ...config,
        version: 2,
        processManager: {
          killTimeout: config.timeout || 5000,
          maxRetries: 3
        }
      };
    }
    return config;
  }
  
  static async migrateConfiguration(
    configManager: ConfigurationManager,
    configName: string
  ): Promise<void> {
    const config = configManager.getConfiguration(configName);
    if (!config) return;
    
    const migrated = await this.migrateToVersion2(config);
    await configManager.saveConfiguration(configName, migrated);
  }
}
```

### Configuration Templates

```typescript
class ConfigurationTemplates {
  static getGameTemplate(): GameConfiguration {
    return {
      id: '',
      name: '',
      executable: '',
      args: [],
      env: {},
      timeout: 30000,
      retries: 3
    };
  }
  
  static getLauncherTemplate(): GameConfiguration {
    return {
      verbose: false,
      maxConcurrentGames: 3,
      logLevel: 'info',
      processManager: {
        killTimeout: 5000,
        maxRetries: 3
      }
    };
  }
}
```

### Configuration Backup and Restore

```typescript
class ConfigurationBackup {
  static async createBackup(
    configManager: ConfigurationManager,
    backupPath: string
  ): Promise<void> {
    const configs = configManager.getAvailableConfigurations();
    const backup = {
      timestamp: new Date().toISOString(),
      environment: configManager.getEnvironment(),
      configurations: {} as Record<string, any>
    };
    
    for (const configName of configs) {
      backup.configurations[configName] = configManager.getConfiguration(configName);
    }
    
    await fs.writeFile(backupPath, JSON.stringify(backup, null, 2));
  }
  
  static async restoreBackup(
    configManager: ConfigurationManager,
    backupPath: string
  ): Promise<void> {
    const backupContent = await fs.readFile(backupPath, 'utf-8');
    const backup = JSON.parse(backupContent);
    
    for (const [name, config] of Object.entries(backup.configurations)) {
      await configManager.saveConfiguration(name, config as GameConfiguration);
    }
  }
}
```

## Configuration Examples

### Development Environment

```json
{
  "verbose": true,
  "logLevel": "debug",
  "maxConcurrentGames": 1,
  "processManager": {
    "killTimeout": 3000,
    "maxRetries": 1
  },
  "gameDirectories": [
    "./dev-games",
    "${HOME}/dev/games"
  ]
}
```

### Production Environment

```json
{
  "verbose": false,
  "logLevel": "warn",
  "maxConcurrentGames": 5,
  "processManager": {
    "killTimeout": 10000,
    "maxRetries": 5
  },
  "monitoring": {
    "enabled": true,
    "metricsInterval": 60000
  }
}
```

### Game Configuration

```json
{
  "id": "my-game",
  "name": "My Awesome Game",
  "executable": "${GAME_DIR}/my-game/game.exe",
  "args": ["--windowed", "--resolution=1920x1080"],
  "env": {
    "GAME_MODE": "${GAME_MODE:-normal}",
    "GRAPHICS_QUALITY": "high"
  },
  "requirements": {
    "minMemory": 4294967296,
    "minCpuCores": 4
  },
  "timeout": 45000,
  "retries": 2
}
```

## Best Practices

### 1. Configuration Organization

```typescript
// Organize configurations by purpose
config/
├── schemas/           # Configuration schemas
├── profiles/          # Configuration profiles
├── games/            # Game configurations
├── config.json       # Base configuration
├── config.dev.json   # Development overrides
└── config.prod.json  # Production overrides
```

### 2. Environment Variables

```typescript
// Use environment variables for sensitive data
{
  "apiKey": "${API_KEY}",
  "databaseUrl": "${DATABASE_URL}",
  "logLevel": "${LOG_LEVEL:-info}"
}
```

### 3. Validation

```typescript
// Always validate configurations
const validation = ConfigurationValidator.validateGameConfig(config);
if (!validation.valid) {
  throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
}
```

### 4. Error Handling

```typescript
// Handle configuration errors gracefully
configManager.on('configurationError', (event) => {
  console.error(`Configuration error in ${event.name}:`, event.error);
  // Fall back to default configuration
  const defaultConfig = getDefaultConfiguration();
  configManager.saveConfiguration(event.name, defaultConfig);
});
```

### 5. Testing

```typescript
// Use separate configuration for testing
const testConfigManager = ConfigurationFactory.createTestingManager(
  path.join(__dirname, 'test-config')
);

// Clean up test configurations
afterEach(async () => {
  await testConfigManager.destroy();
  await fs.rmdir(testConfigPath, { recursive: true });
});
```

## Troubleshooting

### Common Issues

1. **Configuration Not Loading**
   - Check file permissions
   - Verify JSON syntax
   - Check configuration directory path

2. **Validation Errors**
   - Review schema requirements
   - Check data types
   - Verify required fields

3. **Environment Variables Not Substituted**
   - Check variable syntax: `${VAR_NAME}`
   - Verify environment variable is set
   - Use default values: `${VAR_NAME:-default}`

4. **Hot Reloading Not Working**
   - Check file watcher permissions
   - Verify configuration directory exists
   - Check for file system limitations

### Debug Mode

```typescript
// Enable verbose logging
const configManager = new ConfigurationManager({
  environment: 'development'
});

// Listen for debug events
configManager.on('configurationLoaded', (event) => {
  console.log('Loaded:', event.name, event.config);
});

configManager.on('configurationError', (event) => {
  console.error('Error:', event.name, event.error);
});
```

## Next Steps

- **[Best Practices](../guides/best-practices.md)** - Recommended patterns
- **[API Documentation](../api/README.md)** - Complete API reference
- **[Cross-Platform](cross-platform.md)** - Platform compatibility
- **[Game Library Manager](game-library-manager.md)** - Library management

## Related Examples

- [Simple Launcher](simple-launcher.md) - Basic configuration usage
- [Multiple Games](multiple-games.md) - Multi-game configuration
- [Steam Integration](steam-integration.md) - Platform-specific configs

---

*This example demonstrates comprehensive configuration management. For production use, consider using established configuration management tools and security best practices.*
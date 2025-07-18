import path from "node:path";
import { validateGameId } from "@/utils/validation";
import type {
	GameLauncherInterface,
	GameLauncherOptions,
	GameProcessEvents,
	GameProcessInfo,
	ILogger,
	LaunchGameOptions,
	LoggingOptions,
} from "../@types";
import { initializeLogging } from "../logging";
import { ConfigurableLogger } from "../logging/ConfigurableLogger";
import { Logger } from "../logging/Logger";
import { ProtonManager } from "../proton/core/ProtonManager";
import { getPlatform } from "../utils/platform";
import { GameEventEmitter } from "./EventEmitter";
import { Game } from "./Game";
import { ProcessManager } from "./ProcessManager";

export class GameLauncher implements GameLauncherInterface {
	private eventEmitter: GameEventEmitter;
	private processManager: ProcessManager;
	private options: GameLauncherOptions;
	private logger!: ILogger;
	private protonManager: ProtonManager | undefined;

	constructor(options: GameLauncherOptions = {}) {
		this.options = {
			maxConcurrentGames: 10,
			enableProcessMonitoring: true,
			monitoringInterval: 1000,
			...options,
		};

		// Initialize logging system
		this.initializeLogging();

		this.eventEmitter = new GameEventEmitter();

		// Initialize Proton manager on Linux if enabled
		this.initializeProtonManager();

		// Filter out undefined values for ProcessManager options
		const processManagerOptions = {
			...(this.options.monitoringInterval !== undefined && {
				monitoringInterval: this.options.monitoringInterval,
			}),
			...(this.options.enableProcessMonitoring !== undefined && {
				enableResourceMonitoring: this.options.enableProcessMonitoring,
			}),
			// Pass logger to ProcessManager
			logger: this.logger,
		};

		this.processManager = new ProcessManager(
			this.eventEmitter,
			processManagerOptions,
		);

		this.logger.info("GameLauncher initialized", {
			maxConcurrentGames: this.options.maxConcurrentGames,
			enableProcessMonitoring: this.options.enableProcessMonitoring,
			monitoringInterval: this.options.monitoringInterval,
			loggingEnabled: this.options.logging?.enabled ?? true,
			protonEnabled: this.protonManager !== undefined,
		});
	}

	/**
	 * Initialize Proton manager if on Linux and enabled
	 */
	private initializeProtonManager(): void {
		const platform = getPlatform();
		const protonOptions = this.options.proton;

		// Only initialize on Linux
		if (platform !== "linux") {
			this.logger?.debug?.("Proton not available on non-Linux platforms", {
				platform,
			});
			return;
		}

		// Check if Proton is enabled
		if (!protonOptions?.enabled) {
			this.logger?.debug?.("Proton support disabled");
			return;
		}

		try {
			this.protonManager = new ProtonManager();

			// Verify Proton is actually supported
			if (!this.protonManager.isProtonSupported()) {
				this.logger?.warn?.("Proton is not supported on this system");
				this.protonManager = undefined;
				return;
			}

			this.logger?.info?.("ProtonManager initialized", {
				installPath: protonOptions.installPath,
				autoDetect: protonOptions.autoDetect,
				preferredVariant: protonOptions.preferredVariant,
			});
		} catch (error) {
			this.logger?.error?.("Failed to initialize ProtonManager", {
				error: error instanceof Error ? error.message : String(error),
			});
			this.protonManager = undefined;
		}
	}

	/**
	 * Enhanced Steam installation detection (inspired by Heroic Games Launcher)
	 */
	private async detectSteamInstallation(homeDir: string): Promise<string> {
		const fs = await import("node:fs");

		const steamPaths = [
			path.join(homeDir, ".steam", "steam"),
			path.join(homeDir, ".local", "share", "Steam"),
			path.join(
				homeDir,
				".var",
				"app",
				"com.valvesoftware.Steam",
				".local",
				"share",
				"Steam",
			), // Flatpak
			"/usr/share/steam",
			"/opt/steam",
		];

		for (const steamPath of steamPaths) {
			if (fs.existsSync(steamPath)) {
				this.logger.debug("Found Steam installation", { path: steamPath });
				return steamPath;
			}
		}

		this.logger.warn("Steam installation not found, using default path");
		return steamPaths[0] || path.join(homeDir, ".steam", "steam"); // Default fallback
	}

	/**
	 * Detect Steam library paths by parsing libraryfolders.vdf (inspired by Heroic)
	 */
	private async detectSteamLibraryPaths(
		steamInstallPath: string,
	): Promise<string[]> {
		const fs = await import("node:fs");
		const libraryFoldersPath = path.join(
			steamInstallPath,
			"steamapps",
			"libraryfolders.vdf",
		);
		const libraryPaths: string[] = [steamInstallPath];

		try {
			if (fs.existsSync(libraryFoldersPath)) {
				const vdfContent = await fs.promises.readFile(
					libraryFoldersPath,
					"utf-8",
				);

				// Simple VDF parsing to extract library paths
				const pathMatches = vdfContent.match(/"path"\s+"([^"]+)"/g);
				if (pathMatches) {
					for (const match of pathMatches) {
						const pathMatch = match.match(/"path"\s+"([^"]+)"/);
						if (pathMatch?.[1]) {
							const libraryPath = pathMatch[1].replace(/\\\\/g, "/");
							if (
								fs.existsSync(libraryPath) &&
								!libraryPaths.includes(libraryPath)
							) {
								libraryPaths.push(libraryPath);
							}
						}
					}
				}

				this.logger.debug("Detected Steam library paths", {
					paths: libraryPaths,
				});
			}
		} catch (error) {
			this.logger.warn("Failed to parse Steam library folders", {
				error: String(error),
			});
		}

		return libraryPaths;
	}

	/**
	 * Setup comprehensive Proton environment variables (based on Heroic's approach)
	 */
	private async setupProtonEnvironment(params: {
		gameId: string;
		compatDataPath: string;
		steamInstallPath: string;
		steamLibraryPaths: string[];
		protonBuild: {
			installPath: string;
			variant: string;
			version: string;
			source?: string;
		};
		proton?: { winePrefix?: string; customArgs?: string[] };
		environment?: Record<string, string>;
		homeDir: string;
	}): Promise<Record<string, string>> {
		const {
			gameId,
			compatDataPath,
			steamInstallPath,
			steamLibraryPaths,
			protonBuild,
			proton,
			environment,
			homeDir,
		} = params;

		// Create Wine prefix directory if it doesn't exist
		const fs = await import("node:fs");
		const winePrefix = proton?.winePrefix || path.join(compatDataPath, "pfx");

		// Create necessary directories as per Proton documentation
		try {
			// 1. Create Wine prefix directory
			if (!fs.existsSync(winePrefix)) {
				await fs.promises.mkdir(winePrefix, { recursive: true });
				this.logger.debug("Created Wine prefix directory", {
					path: winePrefix,
				});
			}

			// 2. Create Steam compatdata directory (required by Proton for pfx.lock and other internal files)
			const steamCompatDataDir = path.join(
				steamInstallPath,
				"steamapps",
				"compatdata",
			);
			if (!fs.existsSync(steamCompatDataDir)) {
				await fs.promises.mkdir(steamCompatDataDir, { recursive: true });
				this.logger.debug("Created Steam compatdata directory", {
					path: steamCompatDataDir,
				});
			}

			// 3. Create ProtonFixes directory (required by ProtonFixes component)
			const protonFixesDir = path.join(homeDir, ".config", "protonfixes");
			if (!fs.existsSync(protonFixesDir)) {
				await fs.promises.mkdir(protonFixesDir, { recursive: true });
				this.logger.debug("Created ProtonFixes directory", {
					path: protonFixesDir,
				});
			}
		} catch (error) {
			this.logger.warn("Failed to create required Proton directories", {
				error: String(error),
				winePrefix,
			});
		}

		// Build comprehensive environment variables
		const protonEnvironment: Record<string, string> = {
			// Base environment
			...(this.options.defaultEnvironment || {}),
			...(environment || {}),

			// Essential Proton/Steam environment variables
			// STEAM_COMPAT_DATA_PATH should point to the base compatdata directory, not the game-specific one
			STEAM_COMPAT_DATA_PATH: path.join(
				steamInstallPath,
				"steamapps",
				"compatdata",
			),
			STEAM_COMPAT_CLIENT_INSTALL_PATH: steamInstallPath,
			STEAM_COMPAT_INSTALL_PATH: protonBuild.installPath,

			// Wine environment variables
			WINEPREFIX: winePrefix,
			WINEDEBUG: process.env.WINEDEBUG || "-all",

			// Proton-specific environment variables
			PROTON_USE_WINED3D: "1",
			PROTON_NO_D3D11: "0",
			PROTON_NO_D3D12: "0",
			PROTON_FORCE_LARGE_ADDRESS_AWARE: "1",

			// Steam library paths for compatibility
			STEAM_COMPAT_MOUNTS: steamLibraryPaths.join(":"),

			// Additional Wine/Proton variables for better compatibility
			DXVK_HUD: process.env.DXVK_HUD || "",
			VKD3D_CONFIG: process.env.VKD3D_CONFIG || "",

			// Enable logging if debug mode is on (check if debug logging is enabled)
			...(process.env.NODE_ENV === "development" && {
				PROTON_LOG: "1",
				WINEDEBUG: "+all",
			}),
		};

		// Add custom Proton arguments if specified
		if (proton?.customArgs && proton.customArgs.length > 0) {
			protonEnvironment.PROTON_SET_GAME_DRIVE = "1";
		}

		// Set up WINESERVER path for proper Wine server management
		const wineServerPath = path.join(
			protonBuild.installPath,
			"dist",
			"bin",
			"wineserver",
		);
		if (fs.existsSync(wineServerPath)) {
			protonEnvironment.WINESERVER = wineServerPath;
		}

		this.logger.debug("Proton environment setup complete", {
			gameId,
			winePrefix,
			compatDataPath,
			steamLibraryCount: steamLibraryPaths.length,
		});

		return protonEnvironment;
	}

	/**
	 * Find a specific Proton build without scanning all directories (optimized)
	 */
	private async getSpecificProtonBuild(
		variant: string,
		version: string,
		steamInstallPath: string,
		steamLibraryPaths: string[],
	): Promise<
		Array<{
			variant: string;
			version: string;
			installPath: string;
			source: string;
		}>
	> {
		const fs = await import("node:fs");
		const builds: Array<{
			variant: string;
			version: string;
			installPath: string;
			source: string;
		}> = [];

		// First, try ProtonManager cache (fastest)
		if (this.protonManager) {
			try {
				const managerBuilds =
					await this.protonManager.getInstalledProtonBuilds();
				const specificBuild = managerBuilds.find(
					(b) =>
						b.variant === variant &&
						(b.version === version ||
							this.normalizeVersion(b.version, variant) ===
								this.normalizeVersion(version, variant)),
				);
				if (specificBuild) {
					builds.push({ ...specificBuild, source: "proton-manager" });
					return builds;
				}
			} catch (error) {
				this.logger.debug("Failed to get specific build from ProtonManager", {
					error: String(error),
				});
			}
		}

		// Generate possible directory names for the specific version
		const possibleDirNames = this.generatePossibleProtonDirNames(
			variant,
			version,
		);

		// Search in Steam compatibility tools directories
		const compatToolsPaths = [
			path.join(steamInstallPath, "compatibilitytools.d"),
			...steamLibraryPaths.map((p) => path.join(p, "steamapps", "common")),
		];

		for (const compatPath of compatToolsPaths) {
			if (!fs.existsSync(compatPath)) continue;

			for (const dirName of possibleDirNames) {
				const protonDir = path.join(compatPath, dirName);
				const protonPath = path.join(protonDir, "proton");

				if (fs.existsSync(protonPath)) {
					builds.push({
						variant,
						version,
						installPath: protonDir,
						source: "steam-compat-tools",
					});
					this.logger.debug("Found specific Proton build", {
						variant,
						version,
						path: protonDir,
					});
					return builds;
				}
			}
		}

		return builds;
	}

	/**
	 * Generate possible directory names for a Proton variant and version
	 */
	private generatePossibleProtonDirNames(
		variant: string,
		version: string,
	): string[] {
		const names: string[] = [];

		if (variant === "proton-ge") {
			// Common GE-Proton naming patterns
			names.push(`GE-Proton${version}`);
			names.push(`GE-Proton-${version}`);
			names.push(`GE-Proton_${version}`);
			names.push(version); // Sometimes just the version
		} else if (variant === "proton") {
			names.push(`Proton ${version}`);
			names.push(`Proton-${version}`);
			names.push(`Proton_${version}`);
			names.push(version);
		} else if (variant === "proton-experimental") {
			names.push(`Proton-Experimental`);
			names.push(`Proton Experimental`);
			names.push(version);
		} else {
			// Generic fallback
			names.push(version);
		}

		return names;
	}

	/**
	 * Normalize version for comparison
	 */
	private normalizeVersion(version: string, variant: string): string {
		if (variant === "proton-ge") {
			// If version starts with GE-Proton, extract the version part
			if (version.toLowerCase().startsWith("ge-proton")) {
				return version.replace(/^ge-proton/i, "").replace(/^[-_]/, "");
			}
		}
		return version;
	}

	/**
	 * Enhanced Proton build detection across multiple Steam locations (inspired by Heroic)
	 */
	private async getEnhancedProtonBuilds(
		steamInstallPath: string,
		steamLibraryPaths: string[],
	): Promise<
		Array<{
			variant: string;
			version: string;
			installPath: string;
			source: string;
		}>
	> {
		const fs = await import("node:fs");
		const builds: Array<{
			variant: string;
			version: string;
			installPath: string;
			source: string;
		}> = [];

		// Get builds from ProtonManager first
		if (this.protonManager) {
			try {
				const managerBuilds =
					await this.protonManager.getInstalledProtonBuilds();
				builds.push(
					...managerBuilds.map((b) => ({ ...b, source: "proton-manager" })),
				);
			} catch (error) {
				this.logger.warn("Failed to get builds from ProtonManager", {
					error: String(error),
				});
			}
		}

		// Search for Proton installations in Steam compatibility tools directories
		const compatToolsPaths = [
			path.join(steamInstallPath, "compatibilitytools.d"),
			...steamLibraryPaths.map((p) => path.join(p, "steamapps", "common")),
		];

		for (const compatPath of compatToolsPaths) {
			try {
				if (fs.existsSync(compatPath)) {
					const entries = await fs.promises.readdir(compatPath, {
						withFileTypes: true,
					});

					for (const entry of entries) {
						if (entry.isDirectory()) {
							const protonPath = path.join(compatPath, entry.name, "proton");
							if (fs.existsSync(protonPath)) {
								// Determine variant and version from directory name
								const { variant, version } = this.parseProtonDirectoryName(
									entry.name,
								);

								// Check if this build is already in our list
								const existingBuild = builds.find(
									(b) => b.variant === variant && b.version === version,
								);

								if (!existingBuild) {
									builds.push({
										variant,
										version,
										installPath: path.join(compatPath, entry.name),
										source: "steam-compat-tools",
									});
								}
							}
						}
					}
				}
			} catch (error) {
				this.logger.debug("Failed to scan compatibility tools path", {
					path: compatPath,
					error: String(error),
				});
			}
		}

		this.logger.debug("Enhanced Proton build detection complete", {
			totalBuilds: builds.length,
			sources: [...new Set(builds.map((b) => b.source))],
		});

		return builds;
	}

	/**
	 * Parse Proton directory name to extract variant and version
	 */
	private parseProtonDirectoryName(dirName: string): {
		variant: string;
		version: string;
	} {
		// Handle common Proton directory naming patterns
		if (dirName.toLowerCase().includes("ge-proton")) {
			return {
				variant: "proton-ge",
				version:
					dirName.replace(/^GE-Proton/i, "").replace(/^-/, "") || dirName,
			};
		}

		if (dirName.toLowerCase().includes("proton")) {
			if (dirName.toLowerCase().includes("experimental")) {
				return { variant: "proton-experimental", version: dirName };
			}
			return { variant: "proton", version: dirName };
		}

		// Default fallback
		return { variant: "unknown", version: dirName };
	}

	/**
	 * Setup compat data path with proper structure (based on Heroic's approach)
	 */
	private async setupCompatDataPath(
		gameId: string,
		steamInstallPath: string,
		proton: { winePrefix?: string } | undefined,
		homeDir: string,
	): Promise<string> {
		const fs = await import("node:fs");

		// Use custom wine prefix if specified, otherwise use Steam-style compat data
		if (proton?.winePrefix) {
			return proton.winePrefix;
		}

		// Create Steam-style compat data path
		const compatDataPath = path.join(
			steamInstallPath,
			"steamapps",
			"compatdata",
			gameId,
		);

		try {
			// Ensure the directory structure exists
			await fs.promises.mkdir(compatDataPath, { recursive: true });
			this.logger.debug("Setup compat data path", { path: compatDataPath });
		} catch (error) {
			this.logger.warn("Failed to create compat data directory", {
				error: String(error),
				path: compatDataPath,
			});
			// Fallback to home directory if Steam path fails
			const fallbackPath = path.join(
				homeDir,
				".local",
				"share",
				"game-launcher",
				"compatdata",
				gameId,
			);
			await fs.promises.mkdir(fallbackPath, { recursive: true });
			return fallbackPath;
		}

		return compatDataPath;
	}

	/**
	 * Verify Proton executable and setup environment (enhanced error handling)
	 */
	private async verifyAndSetupProtonEnvironment(
		protonPath: string,
		compatDataPath: string,
		gameId: string,
	): Promise<void> {
		const fs = await import("node:fs");

		// Verify Proton executable exists and is executable
		if (!fs.existsSync(protonPath)) {
			throw new Error(`Proton executable not found at ${protonPath}`);
		}

		try {
			// Check if file is executable (Unix-like systems)
			const stats = await fs.promises.stat(protonPath);
			if (process.platform !== "win32" && !(stats.mode & 0o111)) {
				this.logger.warn("Proton executable may not have execute permissions", {
					path: protonPath,
				});
			}
		} catch (error) {
			this.logger.warn("Failed to check Proton executable permissions", {
				error: String(error),
				path: protonPath,
			});
		}

		// Ensure compat data directory structure exists
		try {
			await fs.promises.mkdir(compatDataPath, { recursive: true });

			// Create pfx directory for Wine prefix
			const pfxPath = path.join(compatDataPath, "pfx");
			await fs.promises.mkdir(pfxPath, { recursive: true });

			this.logger.debug("Proton environment verification complete", {
				gameId,
				protonPath,
				compatDataPath,
				pfxPath,
			});
		} catch (error) {
			throw new Error(`Failed to setup Proton environment: ${error}`);
		}
	}

	/**
	 * Build enhanced Proton launch arguments (inspired by Heroic's approach)
	 */
	private async buildProtonLaunchArgs(params: {
		executable: string;
		args: string[];
		proton?: { customArgs?: string[] };
		gameId: string;
		compatDataPath: string;
	}): Promise<string[]> {
		const { executable, args, proton, gameId } = params;

		// Base Proton command
		const protonArgs = ["run"];

		// Note: compatDataPath and gameId are available for future use

		// Add Proton-specific arguments before the executable
		if (proton?.customArgs?.length) {
			// Filter out arguments that should come after the executable
			const preExecArgs = proton.customArgs.filter(
				(arg: string) =>
					!arg.startsWith("--") ||
					arg.includes("wrapper") ||
					arg.includes("no-wine"),
			);
			protonArgs.push(...preExecArgs);
		}

		// Add the executable
		protonArgs.push(executable);

		// Add game arguments
		if (args.length > 0) {
			protonArgs.push(...args);
		}

		// Add post-executable custom arguments
		if (proton?.customArgs && proton.customArgs.length > 0) {
			const postExecArgs = proton.customArgs.filter(
				(arg: string) =>
					arg.startsWith("--") &&
					!arg.includes("wrapper") &&
					!arg.includes("no-wine"),
			);
			protonArgs.push(...postExecArgs);
		}

		this.logger.debug("Built Proton launch arguments", {
			gameId,
			protonArgs: protonArgs.join(" "),
			executable,
			originalArgs: args,
		});

		return protonArgs;
	}

	/**
	 * Initialize the logging system based on configuration
	 */
	private initializeLogging(): void {
		const loggingOptions = this.options.logging;

		// Initialize global logging system first
		if (loggingOptions?.enabled === false) {
			// Initialize with disabled logging
			initializeLogging({
				enableConsole: false,
				enableFile: false,
				enableAudit: false,
			});
			this.logger = this.createNoOpLogger();
			return;
		}

		// If a custom logger is provided, use it
		if (loggingOptions?.customLogger) {
			this.logger = loggingOptions.customLogger;
			return;
		}

		// Use ConfigurableLogger if advanced options are specified
		if (
			loggingOptions &&
			(loggingOptions.format ||
				loggingOptions.outputs ||
				loggingOptions.security)
		) {
			this.logger = new ConfigurableLogger(loggingOptions);
			// Initialize global logging with the same config
			if (loggingOptions.config) {
				initializeLogging(loggingOptions.config);
			}
			return;
		}

		// Use basic Logger with simple config
		const basicConfig = loggingOptions?.config || {
			level: 1, // INFO
			enableConsole: true,
			enableFile: false,
			enableAudit: true,
		};

		// Initialize global logging system
		initializeLogging(basicConfig);
		this.logger = new Logger(basicConfig);
	}

	/**
	 * Create a no-operation logger that doesn't output anything
	 */
	private createNoOpLogger(): ILogger {
		return {
			debug: () => {},
			info: () => {},
			warn: () => {},
			error: () => {},
		};
	}

	/**
	 * Update logging configuration at runtime
	 */
	updateLoggingConfig(loggingOptions: LoggingOptions): void {
		this.options.logging = { ...this.options.logging, ...loggingOptions };
		this.initializeLogging();

		// Update ProcessManager's logger if it supports it
		if (
			"updateLogger" in this.processManager &&
			typeof this.processManager.updateLogger === "function"
		) {
			this.processManager.updateLogger(this.logger);
		}

		this.logger.info("Logging configuration updated", { loggingOptions });
	}

	/**
	 * Get the current logger instance
	 */
	getLogger(): ILogger {
		return this.logger;
	}

	/**
	 * Enable or disable logging at runtime
	 */
	setLoggingEnabled(enabled: boolean): void {
		this.updateLoggingConfig({ enabled });
	}

	/**
	 * Get the ProtonManager instance (Linux only)
	 */
	getProtonManager(): ProtonManager | undefined {
		return this.protonManager;
	}

	/**
	 * Check if Proton is available and enabled
	 */
	isProtonAvailable(): boolean {
		return this.protonManager !== undefined;
	}

	async launchGame(options: LaunchGameOptions): Promise<Game> {
		const {
			gameId,
			executable,
			args = [],
			workingDirectory,
			environment,
		} = options;

		validateGameId(gameId);

		if (this.isGameRunning(gameId)) {
			throw new Error(`Game with ID "${gameId}" is already running`);
		}

		const runningGames = this.getRunningGames();
		const maxGames = this.options.maxConcurrentGames ?? 10;
		if (runningGames.length >= maxGames) {
			throw new Error(`Maximum concurrent games limit reached (${maxGames})`);
		}

		// Determine if Proton should be used
		const useProton = this.shouldUseProton(options, executable);
		this.logger.info("Proton decision:", {
			useProton,
			protonManagerExists: !!this.protonManager,
			protonEnabled: this.options.proton?.enabled,
			executable,
		});
		if (useProton && this.protonManager) {
			return this.launchGameWithProton(options);
		}

		// Filter out undefined values for process options
		const processOptions = {
			...(workingDirectory !== undefined && { workingDirectory }),
			...(this.options.defaultWorkingDirectory !== undefined &&
				workingDirectory === undefined && {
					workingDirectory: this.options.defaultWorkingDirectory,
				}),
			environment: {
				...(this.options.defaultEnvironment || {}),
				...(environment || {}),
			},
			...(options.captureOutput !== undefined && {
				captureOutput: options.captureOutput,
			}),
			...(options.timeout !== undefined && { timeout: options.timeout }),
			...(options.runAsAdmin !== undefined && {
				runAsAdmin: options.runAsAdmin,
			}),
			...(options.metadata !== undefined && { metadata: options.metadata }),
		};

		await this.processManager.startProcess(
			gameId,
			executable,
			args,
			processOptions,
		);
		return new Game(gameId, this.eventEmitter, this.processManager);
	}

	private shouldUseProton(
		options: LaunchGameOptions,
		executable: string,
	): boolean {
		const platform = getPlatform();
		const globalEnabled = this.options.proton?.enabled;
		const launchEnabled = options.proton?.enabled;
		const isExe = executable.toLowerCase().endsWith(".exe");
		this.logger.debug("shouldUseProton checks:", {
			platform,
			globalEnabled,
			launchEnabled,
			isExe,
			executable,
		});
		if (platform !== "linux") return false;
		if (!globalEnabled) return false;
		if (launchEnabled === false) return false;
		if (launchEnabled === true) return true;
		return isExe;
	}

	/**
	 * Launch a game using Proton (Linux only)
	 */
	private async launchGameWithProton(
		options: LaunchGameOptions,
	): Promise<Game> {
		if (!this.protonManager) {
			throw new Error("Proton is not available or not initialized");
		}

		// Double-check Proton support
		if (!this.protonManager.isProtonSupported()) {
			throw new Error("Proton is not supported on this platform");
		}

		const {
			gameId,
			executable,
			args = [],
			workingDirectory,
			environment,
			proton,
		} = options;

		this.logger.info("Launching game with Proton", {
			gameId,
			executable,
			protonVariant: proton?.variant,
			protonVersion: proton?.version,
		});

		try {
			// Get Proton variant and version
			const variant =
				proton?.variant || this.options.proton?.preferredVariant || "proton-ge";
			const version = proton?.version || this.options.proton?.defaultVersion;

			// Get available Proton versions if version not specified
			let selectedVersion = version;
			if (!selectedVersion) {
				const availableVersions =
					await this.protonManager.listAvailableProtonVersions();
				const variantVersions = availableVersions[variant];
				if (!variantVersions || variantVersions.length === 0) {
					throw new Error(`No ${variant} versions available`);
				}
				// Prioritize installed versions
				const installedVersions = variantVersions.filter((v) => v.installed);
				if (installedVersions.length === 0) {
					throw new Error(
						`No installed ${variant} versions found. Please install a ${variant} version first.`,
					);
				}
				selectedVersion = installedVersions[0]?.version;
			}

			// Get home directory for path expansion
			const homeDir = require("node:os").homedir();

			// Enhanced Steam installation detection (inspired by Heroic)
			const steamInstallPath = await this.detectSteamInstallation(homeDir);
			const steamLibraryPaths =
				await this.detectSteamLibraryPaths(steamInstallPath);

			// Enhanced compat data path setup (based on Heroic's approach)
			const compatDataPath = await this.setupCompatDataPath(
				gameId,
				steamInstallPath,
				proton?.winePrefix ? { winePrefix: proton.winePrefix } : undefined,
				homeDir,
			);

			// Expand tilde in executable path
			const expandedExecutable = executable.startsWith("~")
				? executable.replace("~", homeDir)
				: executable;

			// Enhanced Proton launch arguments (inspired by Heroic's approach)
			const protonLaunchParams: {
				executable: string;
				args: string[];
				proton?: { customArgs?: string[] };
				gameId: string;
				compatDataPath: string;
			} = {
				executable: expandedExecutable,
				args,
				gameId,
				compatDataPath,
			};
			if (proton?.customArgs) {
				protonLaunchParams.proton = { customArgs: proton.customArgs };
			}
			const protonArgs = await this.buildProtonLaunchArgs(protonLaunchParams);

			// Enhanced Proton build detection (inspired by Heroic)
			// Optimize: if specific version is provided, try to find it directly first
			let installedBuilds: Array<{
				variant: string;
				version: string;
				installPath: string;
				source: string;
			}>;

			if (selectedVersion) {
				// Try to find the specific version directly without scanning all folders
				installedBuilds = await this.getSpecificProtonBuild(
					variant,
					selectedVersion,
					steamInstallPath,
					steamLibraryPaths,
				);

				// If not found, fall back to full scan
				if (installedBuilds.length === 0) {
					this.logger.debug(
						"Specific Proton version not found directly, performing full scan",
						{
							variant,
							selectedVersion,
						},
					);
					installedBuilds = await this.getEnhancedProtonBuilds(
						steamInstallPath,
						steamLibraryPaths,
					);
				}
			} else {
				// No specific version requested, scan all
				installedBuilds = await this.getEnhancedProtonBuilds(
					steamInstallPath,
					steamLibraryPaths,
				);
			}

			this.logger.debug("Looking for Proton build:", {
				variant,
				selectedVersion,
				availableBuilds: installedBuilds.map((b) => ({
					variant: b.variant,
					version: b.version,
					source: b.source || "unknown",
				})),
			});
			// Find the specific Proton build
			const normalizedSelectedVersion = this.normalizeVersion(
				selectedVersion || "",
				variant,
			);
			const protonBuild = installedBuilds.find((build) => {
				const normalizedBuildVersion = this.normalizeVersion(
					build.version,
					build.variant,
				);
				return (
					build.variant === variant &&
					(build.version === selectedVersion ||
						normalizedBuildVersion === normalizedSelectedVersion)
				);
			});
			if (!protonBuild) {
				throw new Error(
					`Proton ${variant} ${selectedVersion} not found or not installed`,
				);
			}
			const protonPath = path.join(protonBuild.installPath, "proton");

			// Enhanced Proton executable verification and prefix setup
			await this.verifyAndSetupProtonEnvironment(
				protonPath,
				compatDataPath,
				gameId,
			);

			// Enhanced environment variables setup (based on Heroic's approach)
			const protonEnvParams: {
				gameId: string;
				compatDataPath: string;
				steamInstallPath: string;
				steamLibraryPaths: string[];
				protonBuild: {
					installPath: string;
					variant: string;
					version: string;
					source?: string;
				};
				proton?: { winePrefix?: string; customArgs?: string[] };
				environment?: Record<string, string>;
				homeDir: string;
			} = {
				gameId,
				compatDataPath,
				steamInstallPath,
				steamLibraryPaths,
				protonBuild,
				environment: environment || {},
				homeDir,
			};
			if (proton && (proton.winePrefix || proton.customArgs)) {
				protonEnvParams.proton = {
					...(proton.winePrefix && { winePrefix: proton.winePrefix }),
					...(proton.customArgs && { customArgs: proton.customArgs }),
				};
			}
			const protonEnvironment =
				await this.setupProtonEnvironment(protonEnvParams);

			// Filter out undefined values for process options
			const processOptions = {
				...(workingDirectory !== undefined && { workingDirectory }),
				...(this.options.defaultWorkingDirectory !== undefined &&
					workingDirectory === undefined && {
						workingDirectory: this.options.defaultWorkingDirectory,
					}),
				environment: protonEnvironment,
				...(options.captureOutput !== undefined && {
					captureOutput: options.captureOutput,
				}),
				...(options.timeout !== undefined && { timeout: options.timeout }),
				...(options.runAsAdmin !== undefined && {
					runAsAdmin: options.runAsAdmin,
				}),
				...(options.metadata !== undefined && {
					metadata: {
						...options.metadata,
						protonVariant: variant,
						protonVersion: selectedVersion || "unknown",
					},
				}),
			};

			await this.processManager.startProcess(
				gameId,
				protonPath,
				protonArgs,
				processOptions,
			);

			this.logger.info("Game launched successfully with Proton", {
				gameId,
				protonPath,
				variant,
				version: selectedVersion,
			});

			return new Game(gameId, this.eventEmitter, this.processManager);
		} catch (error) {
			// Enhanced error handling for different failure scenarios
			if (error instanceof Error) {
				// Handle privilege escalation specific errors
				if (error.name === "PrivilegeEscalationCancelled") {
					this.logger.warn("Game launch cancelled by user", {
						gameId,
						reason: "User cancelled privilege escalation prompt",
					});
					throw new Error(
						"Game launch cancelled. Administrator privileges are required to run games with Proton.",
					);
				} else if (error.name === "PrivilegeEscalationFailed") {
					this.logger.error("Privilege escalation failed", {
						gameId,
						error: error.message,
						suggestion: "Check system authentication settings",
					});
					throw new Error(
						`Failed to obtain administrator privileges: ${error.message}. Please check your system authentication settings.`,
					);
				} else {
					// General Proton launch errors
					this.logger.error("Failed to launch game with Proton", {
						gameId,
						error: error.message,
						errorType: error.name || "Unknown",
					});
					throw error;
				}
			} else {
				// Handle non-Error objects
				this.logger.error("Failed to launch game with Proton", {
					gameId,
					error: String(error),
				});
				throw new Error(`Failed to launch game with Proton: ${String(error)}`);
			}
		}
	}

	async closeGame(gameId: string, force = false): Promise<boolean> {
		return this.processManager.killProcess(gameId, force);
	}

	isGameRunning(gameId: string): boolean {
		return this.processManager.isProcessRunning(gameId);
	}

	getRunningGames(): string[] {
		const allProcesses = this.processManager.getAllProcesses();
		const runningGames: string[] = [];

		// More efficient iteration without intermediate arrays
		for (const [gameId, info] of allProcesses) {
			if (info.status === "running" || info.status === "detached") {
				runningGames.push(gameId);
			}
		}

		return runningGames;
	}

	getGameInfo(gameId: string): GameProcessInfo | null {
		return this.processManager.getProcessInfo(gameId);
	}

	on<K extends keyof GameProcessEvents>(
		event: K,
		listener: GameProcessEvents[K],
	): this {
		this.eventEmitter.on(event, listener);
		return this;
	}

	off<K extends keyof GameProcessEvents>(
		event: K,
		listener: GameProcessEvents[K],
	): this {
		this.eventEmitter.off(event, listener);
		return this;
	}

	removeAllListeners(event?: keyof GameProcessEvents): this {
		this.eventEmitter.removeAllListeners(event);
		return this;
	}

	async destroy(): Promise<void> {
		this.processManager.destroy();
		this.eventEmitter.removeAllListeners();
	}
}

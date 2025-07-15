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
			
			// Expand tilde in executable path
			const expandedExecutable = executable.startsWith('~') 
				? executable.replace('~', homeDir)
				: executable;
			
			// Launch the game with Proton
			const protonArgs = [
				"run",
				expandedExecutable,
				...(proton?.customArgs || []),
				...args,
			];

			// Get installed Proton builds to find the executable path
			const installedBuilds =
				await this.protonManager.getInstalledProtonBuilds();
			this.logger.debug("Looking for Proton build:", {
				variant,
				selectedVersion,
				availableBuilds: installedBuilds.map((b) => ({
					variant: b.variant,
					version: b.version,
				})),
			});
			// Normalize version for comparison - handle both full names and parsed versions
			const normalizeVersion = (version: string, variant: string): string => {
				if (variant === "proton-ge") {
					// If version starts with GE-Proton, extract the version part
					if (version.toLowerCase().startsWith("ge-proton")) {
						return version.replace(/^ge-proton/i, "").replace(/^-/, "");
					}
				}
				return version;
			};

			const normalizedSelectedVersion = normalizeVersion(
				selectedVersion || "",
				variant,
			);
			const protonBuild = installedBuilds.find((build) => {
				const normalizedBuildVersion = normalizeVersion(
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

			// Set up environment variables for Proton
			const compatDataPath =
				proton?.winePrefix ||
				path.join(
					homeDir,
					".steam",
					"steam",
					"steamapps",
					"compatdata",
					gameId,
				);

			// Verify the Proton executable exists and ensure compat data directory exists
			const fs = await import("node:fs");
			if (!fs.existsSync(protonPath)) {
				throw new Error(`Proton executable not found at ${protonPath}`);
			}

			// Ensure compat data directory exists
			if (!fs.existsSync(path.dirname(compatDataPath))) {
				await fs.promises.mkdir(path.dirname(compatDataPath), {
					recursive: true,
				});
			}
			if (!fs.existsSync(compatDataPath)) {
				await fs.promises.mkdir(compatDataPath, { recursive: true });
			}

			// Detect Steam installation path
			const steamPaths = [
				path.join(homeDir, '.steam', 'steam'),
				path.join(homeDir, '.local', 'share', 'Steam'),
				'/usr/share/steam',
				'/opt/steam'
			];
			const steamInstallPath = steamPaths.find(p => fs.existsSync(p)) || steamPaths[0];
			
			const protonEnvironment = {
				...(this.options.defaultEnvironment || {}),
				...(environment || {}),
				// Essential Proton environment variables
				STEAM_COMPAT_DATA_PATH: compatDataPath,
				STEAM_COMPAT_CLIENT_INSTALL_PATH: steamInstallPath || path.join(homeDir, '.steam', 'steam'),
				// Add Wine prefix if specified
				...(proton?.winePrefix && { WINEPREFIX: proton.winePrefix }),
				// Add common Proton environment variables
				PROTON_USE_WINED3D: "1",
				PROTON_NO_D3D11: "0",
				PROTON_NO_D3D12: "0",
			};

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
				if (error.name === 'PrivilegeEscalationCancelled') {
					this.logger.warn("Game launch cancelled by user", {
						gameId,
						reason: "User cancelled privilege escalation prompt",
					});
					throw new Error("Game launch cancelled. Administrator privileges are required to run games with Proton.");
				} else if (error.name === 'PrivilegeEscalationFailed') {
					this.logger.error("Privilege escalation failed", {
						gameId,
						error: error.message,
						suggestion: "Check system authentication settings",
					});
					throw new Error(`Failed to obtain administrator privileges: ${error.message}. Please check your system authentication settings.`);
				} else {
					// General Proton launch errors
					this.logger.error("Failed to launch game with Proton", {
						gameId,
						error: error.message,
						errorType: error.name || 'Unknown',
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

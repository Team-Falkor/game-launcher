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
import { GameEventEmitter } from "./EventEmitter";
import { Game } from "./Game";
import { ProcessManager } from "./ProcessManager";

export class GameLauncher implements GameLauncherInterface {
	private eventEmitter: GameEventEmitter;
	private processManager: ProcessManager;
	private options: GameLauncherOptions;
	private logger!: ILogger;

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
		});
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

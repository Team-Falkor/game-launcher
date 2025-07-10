import type { GameProcessEvents } from "./events";
import type { LogContext, LogEntry, LoggerConfig } from "./logging";
import type { GameProcessInfo } from "./process";

export interface GameLauncherOptions {
	/** Maximum number of concurrent games */
	maxConcurrentGames?: number | undefined;
	/** Default working directory for games */
	defaultWorkingDirectory?: string | undefined;
	/** Default environment variables */
	defaultEnvironment?: Record<string, string> | undefined;
	/** Enable process monitoring */
	enableProcessMonitoring?: boolean | undefined;
	/** Monitoring interval in milliseconds */
	monitoringInterval?: number | undefined;
	/** Logging configuration */
	logging?: LoggingOptions | undefined;
}

/**
 * Comprehensive logging configuration options
 */
export interface LoggingOptions {
	/** Enable or disable all logging */
	enabled?: boolean | undefined;
	/** Logger configuration */
	config?: Partial<LoggerConfig> | undefined;
	/** Custom logger instance */
	customLogger?:
		| {
				debug(message: string, context?: LogContext): void;
				info(message: string, context?: LogContext): void;
				warn(message: string, context?: LogContext): void;
				error(message: string, context?: LogContext): void;
		  }
		| undefined;
	/** Log format options */
	format?: LogFormatOptions | undefined;
	/** Output destinations */
	outputs?: LogOutputOptions | undefined;
	/** Security audit logging options */
	security?: SecurityLoggingOptions | undefined;
}

/**
 * Log format configuration
 */
export interface LogFormatOptions {
	/** Include timestamp in logs */
	includeTimestamp?: boolean | undefined;
	/** Include log level in logs */
	includeLevel?: boolean | undefined;
	/** Include category/context in logs */
	includeCategory?: boolean | undefined;
	/** Custom timestamp format */
	timestampFormat?: string | undefined;
	/** Use JSON format for structured logging */
	useJsonFormat?: boolean | undefined;
	/** Include stack traces for errors */
	includeStackTrace?: boolean | undefined;
}

/**
 * Log output destination configuration
 */
export interface LogOutputOptions {
	/** Enable console output */
	console?: ConsoleOutputOptions | undefined;
	/** Enable file output */
	file?: FileOutputOptions | undefined;
	/** Enable remote logging */
	remote?: RemoteOutputOptions | undefined;
	/** Custom output handlers */
	custom?: CustomOutputHandler[] | undefined;
}

/**
 * Console output configuration
 */
export interface ConsoleOutputOptions {
	/** Enable console output */
	enabled?: boolean | undefined;
	/** Use colors in console output */
	useColors?: boolean | undefined;
	/** Minimum log level for console */
	minLevel?: string | undefined;
}

/**
 * File output configuration
 */
export interface FileOutputOptions {
	/** Enable file output */
	enabled?: boolean | undefined;
	/** Log file path */
	path?: string | undefined;
	/** Maximum file size in bytes */
	maxSize?: number | undefined;
	/** Maximum number of log files to keep */
	maxFiles?: number | undefined;
	/** File rotation strategy */
	rotation?: "size" | "time" | "daily" | undefined;
	/** Minimum log level for file output */
	minLevel?: string | undefined;
}

/**
 * Remote logging configuration
 */
export interface RemoteOutputOptions {
	/** Enable remote logging */
	enabled?: boolean | undefined;
	/** Remote endpoint URL */
	endpoint?: string | undefined;
	/** API key for authentication */
	apiKey?: string | undefined;
	/** Batch size for remote logging */
	batchSize?: number | undefined;
	/** Flush interval in milliseconds */
	flushInterval?: number | undefined;
}

/**
 * Custom output handler interface
 */
export interface CustomOutputHandler {
	/** Handler name */
	name: string;
	/** Handler function */
	handle: (entry: LogEntry) => void | Promise<void>;
	/** Minimum log level */
	minLevel?: string | undefined;
}

/**
 * Security logging configuration
 */
export interface SecurityLoggingOptions {
	/** Enable security audit logging */
	enabled?: boolean | undefined;
	/** Security audit file path */
	auditFilePath?: string | undefined;
	/** Include sensitive data in logs (use with caution) */
	includeSensitiveData?: boolean | undefined;
	/** Encrypt audit logs */
	encryptLogs?: boolean | undefined;
	/** Encryption key for audit logs */
	encryptionKey?: string | undefined;
	/** Log all security events or only failures */
	logLevel?: "all" | "failures-only" | "critical-only" | undefined;
}

export interface LaunchGameOptions {
	/** Unique identifier for the game */
	gameId: string;
	/** Path to the game executable */
	executable: string;
	/** Command line arguments */
	args?: string[] | undefined;
	/** Working directory */
	workingDirectory?: string | undefined;
	/** Environment variables */
	environment?: Record<string, string> | undefined;
	/** Capture stdout/stderr */
	captureOutput?: boolean | undefined;
	/** Launch timeout in milliseconds */
	timeout?: number | undefined;
	/** Run the game with administrator privileges */
	runAsAdmin?: boolean | undefined;
	/** Additional metadata */
	metadata?: Record<string, string | number | boolean | null> | undefined;
}

export interface GameLauncherInterface {
	launchGame(options: LaunchGameOptions): Promise<string>;
	closeGame(gameId: string, force?: boolean): Promise<boolean>;
	isGameRunning(gameId: string): boolean;
	getRunningGames(): string[];
	getGameInfo(gameId: string): GameProcessInfo | null;
	on<K extends keyof GameProcessEvents>(
		event: K,
		listener: GameProcessEvents[K],
	): this;
	off<K extends keyof GameProcessEvents>(
		event: K,
		listener: GameProcessEvents[K],
	): this;
	removeAllListeners(event?: keyof GameProcessEvents): this;
}

import { existsSync } from "node:fs";
import { appendFile, mkdir, stat } from "node:fs/promises";
import { dirname } from "node:path";
import type {
	ILogger,
	LogContext,
	LogEntry,
	LoggerConfig,
	LogLevel,
} from "@/@types";
import type { LoggingOptions } from "../@types/core/launcher";

/**
 * Enhanced configurable logger with comprehensive output options
 */
export class ConfigurableLogger implements ILogger {
	private config: LoggerConfig;
	private loggingOptions: LoggingOptions;
	private logQueue: LogEntry[] = [];
	private isWriting = false;
	private remoteQueue: LogEntry[] = [];
	private remoteFlushTimer?: NodeJS.Timeout;

	constructor(options: LoggingOptions = {}) {
		this.loggingOptions = {
			enabled: true,
			...options,
		};

		// Set default config if not provided
		const defaultConfig: LoggerConfig = {
			level: 1, // INFO
			enableConsole: true,
			enableFile: false,
			enableAudit: true,
			maxFileSize: 10 * 1024 * 1024, // 10MB
			maxFiles: 5,
		};

		this.config = {
			...defaultConfig,
			...this.loggingOptions.config,
		};

		// Setup remote logging timer if enabled
		if (this.loggingOptions.outputs?.remote?.enabled) {
			this.setupRemoteLogging();
		}

		// Ensure log directories exist
		this.ensureLogDirectories();
	}

	private async ensureLogDirectories(): Promise<void> {
		try {
			if (this.config.logFilePath) {
				const logDir = dirname(this.config.logFilePath);
				if (!existsSync(logDir)) {
					await mkdir(logDir, { recursive: true });
				}
			}

			if (this.config.auditFilePath) {
				const auditDir = dirname(this.config.auditFilePath);
				if (!existsSync(auditDir)) {
					await mkdir(auditDir, { recursive: true });
				}
			}

			if (this.loggingOptions.outputs?.file?.path) {
				const fileDir = dirname(this.loggingOptions.outputs.file.path);
				if (!existsSync(fileDir)) {
					await mkdir(fileDir, { recursive: true });
				}
			}
		} catch (error) {
			console.error("Failed to create log directories:", error);
		}
	}

	private setupRemoteLogging(): void {
		const remoteConfig = this.loggingOptions.outputs?.remote;
		if (!remoteConfig?.enabled || !remoteConfig.flushInterval) return;

		this.remoteFlushTimer = setInterval(() => {
			this.flushRemoteQueue();
		}, remoteConfig.flushInterval);
	}

	debug(message: string, context?: LogContext): void {
		this.log(0, message, context); // DEBUG
	}

	info(message: string, context?: LogContext): void {
		this.log(1, message, context); // INFO
	}

	warn(message: string, context?: LogContext): void {
		this.log(2, message, context); // WARN
	}

	error(message: string, context?: LogContext): void {
		this.log(3, message, context); // ERROR
	}

	private log(level: LogLevel, message: string, context?: LogContext): void {
		// Check if logging is enabled
		if (!this.loggingOptions.enabled) {
			return;
		}

		// Check if level meets minimum threshold
		if (level < this.config.level) {
			return;
		}

		const entry: LogEntry = {
			timestamp: new Date(),
			level,
			message,
			...(context && { context }),
		};

		// Route to different outputs
		this.routeLogEntry(entry);
	}

	private routeLogEntry(entry: LogEntry): void {
		const outputs = this.loggingOptions.outputs;

		// Console output
		if (
			outputs?.console?.enabled &&
			this.shouldLogToOutput(entry, outputs.console.minLevel)
		) {
			this.logToConsole(entry);
		}

		// File output
		if (
			outputs?.file?.enabled &&
			this.shouldLogToOutput(entry, outputs.file.minLevel)
		) {
			this.queueLogEntry(entry);
		}

		// Remote output
		if (outputs?.remote?.enabled) {
			this.queueRemoteEntry(entry);
		}

		// Custom outputs
		if (outputs?.custom) {
			for (const handler of outputs.custom) {
				if (this.shouldLogToOutput(entry, handler.minLevel)) {
					try {
						handler.handle(entry);
					} catch (error) {
						console.error(
							`Error in custom log handler '${handler.name}':`,
							error,
						);
					}
				}
			}
		}
	}

	private shouldLogToOutput(
		entry: LogEntry,
		minLevel?: LogLevel | string,
	): boolean {
		if (minLevel === undefined) return true;

		// Convert string to LogLevel if needed
		let numericLevel: LogLevel;
		if (typeof minLevel === "string") {
			const levelMap: Record<string, LogLevel> = {
				DEBUG: 0,
				INFO: 1,
				WARN: 2,
				ERROR: 3,
			};
			numericLevel = levelMap[minLevel.toUpperCase()] ?? 0;
		} else {
			numericLevel = minLevel;
		}

		return entry.level >= numericLevel;
	}

	private logToConsole(entry: LogEntry): void {
		const format = this.loggingOptions.format;
		const consoleConfig = this.loggingOptions.outputs?.console;

		let logMessage = "";

		// Build formatted message
		if (format?.useJsonFormat) {
			const jsonEntry = {
				...(format.includeTimestamp && {
					timestamp: this.formatTimestamp(entry.timestamp),
				}),
				...(format.includeLevel && { level: this.getLevelName(entry.level) }),
				message: entry.message,
				...(entry.context && { context: entry.context }),
				...(format.includeCategory &&
					entry.context?.category && { category: entry.context.category }),
			};
			logMessage = JSON.stringify(jsonEntry);
		} else {
			const parts: string[] = [];

			if (format?.includeTimestamp) {
				parts.push(`[${this.formatTimestamp(entry.timestamp)}]`);
			}

			if (format?.includeLevel) {
				parts.push(this.getLevelName(entry.level));
			}

			if (format?.includeCategory && entry.context?.category) {
				parts.push(`[${entry.context.category}]`);
			}

			parts.push(entry.message);

			if (entry.context && !format?.includeCategory) {
				parts.push(JSON.stringify(entry.context));
			}

			logMessage = parts.join(" ");
		}

		// Add colors if enabled
		if (consoleConfig?.useColors) {
			logMessage = this.colorizeMessage(logMessage, entry.level);
		}

		// Output to appropriate console method
		switch (entry.level) {
			case 0: // DEBUG
				console.debug(logMessage);
				break;
			case 1: // INFO
				console.info(logMessage);
				break;
			case 2: // WARN
				console.warn(logMessage);
				break;
			case 3: // ERROR
				console.error(logMessage);
				if (
					format?.includeStackTrace &&
					entry.context?.error instanceof Error
				) {
					console.error(entry.context.error.stack);
				}
				break;
		}
	}

	private colorizeMessage(message: string, level: LogLevel): string {
		const colors = {
			reset: "\x1b[0m",
			bright: "\x1b[1m",
			dim: "\x1b[2m",
			red: "\x1b[31m",
			green: "\x1b[32m",
			yellow: "\x1b[33m",
			blue: "\x1b[34m",
			magenta: "\x1b[35m",
			cyan: "\x1b[36m",
			white: "\x1b[37m",
		};

		switch (level) {
			case 0: // DEBUG
				return `${colors.dim}${colors.cyan}${message}${colors.reset}`;
			case 1: // INFO
				return `${colors.green}${message}${colors.reset}`;
			case 2: // WARN
				return `${colors.yellow}${message}${colors.reset}`;
			case 3: // ERROR
				return `${colors.bright}${colors.red}${message}${colors.reset}`;
			default:
				return message;
		}
	}

	private formatTimestamp(timestamp: Date): string {
		const format = this.loggingOptions.format?.timestampFormat;

		switch (format) {
			case "ISO":
				return timestamp.toISOString();
			case "locale":
				return timestamp.toLocaleString();
			case "unix":
				return timestamp.getTime().toString();
			default:
				return timestamp.toISOString();
		}
	}

	private getLevelName(level: LogLevel): string {
		switch (level) {
			case 0:
				return "DEBUG";
			case 1:
				return "INFO";
			case 2:
				return "WARN";
			case 3:
				return "ERROR";
			default:
				return "UNKNOWN";
		}
	}

	private queueLogEntry(entry: LogEntry): void {
		this.logQueue.push(entry);
		this.processLogQueue();
	}

	private queueRemoteEntry(entry: LogEntry): void {
		this.remoteQueue.push(entry);

		const batchSize = this.loggingOptions.outputs?.remote?.batchSize || 100;
		if (this.remoteQueue.length >= batchSize) {
			this.flushRemoteQueue();
		}
	}

	private async processLogQueue(): Promise<void> {
		if (this.isWriting || this.logQueue.length === 0) {
			return;
		}

		this.isWriting = true;

		try {
			const entries = [...this.logQueue];
			this.logQueue = [];

			const format = this.loggingOptions.format;
			const logLines = `${entries
				.map((entry) => {
					if (format?.useJsonFormat) {
						return JSON.stringify({
							...(format.includeTimestamp && {
								timestamp: this.formatTimestamp(entry.timestamp),
							}),
							...(format.includeLevel && {
								level: this.getLevelName(entry.level),
							}),
							message: entry.message,
							...(entry.context && { context: entry.context }),
						});
					} else {
						const parts: string[] = [];

						if (format?.includeTimestamp) {
							parts.push(`[${this.formatTimestamp(entry.timestamp)}]`);
						}

						if (format?.includeLevel) {
							parts.push(this.getLevelName(entry.level));
						}

						parts.push(entry.message);

						if (entry.context) {
							parts.push(JSON.stringify(entry.context));
						}

						return parts.join(" ");
					}
				})
				.join("\n")}\n`;

			const filePath =
				this.loggingOptions.outputs?.file?.path || this.config.logFilePath;
			if (filePath) {
				await this.writeToFile(filePath, logLines);
			}
		} catch (error) {
			console.error("Failed to write log entries:", error);
		} finally {
			this.isWriting = false;

			// Process any entries that were queued while writing
			if (this.logQueue.length > 0) {
				setImmediate(() => this.processLogQueue());
			}
		}
	}

	private async flushRemoteQueue(): Promise<void> {
		if (this.remoteQueue.length === 0) return;

		const remoteConfig = this.loggingOptions.outputs?.remote;
		if (!remoteConfig?.enabled || !remoteConfig.endpoint) return;

		const entries = [...this.remoteQueue];
		this.remoteQueue = [];

		try {
			const payload = {
				logs: entries.map((entry) => ({
					timestamp: entry.timestamp.toISOString(),
					level: this.getLevelName(entry.level),
					message: entry.message,
					context: entry.context,
				})),
			};

			const headers: Record<string, string> = {
				"Content-Type": "application/json",
			};

			if (remoteConfig.apiKey) {
				headers.Authorization = `Bearer ${remoteConfig.apiKey}`;
			}

			// Use fetch if available, otherwise skip remote logging
			if (typeof fetch !== "undefined") {
				await fetch(remoteConfig.endpoint, {
					method: "POST",
					headers,
					body: JSON.stringify(payload),
				});
			}
		} catch (error) {
			console.error("Failed to send logs to remote endpoint:", error);
			// Re-queue entries for retry
			this.remoteQueue.unshift(...entries);
		}
	}

	private async writeToFile(filePath: string, content: string): Promise<void> {
		try {
			const fileConfig = this.loggingOptions.outputs?.file;
			const maxSize =
				fileConfig?.maxSize || this.config.maxFileSize || 10 * 1024 * 1024;

			// Check if file needs rotation
			if (existsSync(filePath)) {
				const stats = await stat(filePath);
				if (stats.size > maxSize) {
					await this.rotateLogFile(filePath);
				}
			}

			await appendFile(filePath, content, "utf8");
		} catch (error) {
			console.error(`Failed to write to log file ${filePath}:`, error);
		}
	}

	private async rotateLogFile(filePath: string): Promise<void> {
		try {
			const fileConfig = this.loggingOptions.outputs?.file;
			const maxFiles = fileConfig?.maxFiles || this.config.maxFiles || 5;

			// Rotate existing files
			for (let i = maxFiles - 1; i >= 1; i--) {
				const oldFile = `${filePath}.${i}`;
				const newFile = `${filePath}.${i + 1}`;

				if (existsSync(oldFile)) {
					if (i === maxFiles - 1) {
						// Delete the oldest file
						await import("node:fs/promises").then((fs) => fs.unlink(oldFile));
					} else {
						await import("node:fs/promises").then((fs) =>
							fs.rename(oldFile, newFile),
						);
					}
				}
			}

			// Move current file to .1
			if (existsSync(filePath)) {
				await import("node:fs/promises").then((fs) =>
					fs.rename(filePath, `${filePath}.1`),
				);
			}
		} catch (error) {
			console.error("Failed to rotate log file:", error);
		}
	}

	/**
	 * Update logging configuration at runtime
	 */
	updateConfig(options: Partial<LoggingOptions>): void {
		this.loggingOptions = {
			...this.loggingOptions,
			...options,
			config: {
				...this.loggingOptions.config,
				...options.config,
			},
			format: {
				...this.loggingOptions.format,
				...options.format,
			},
			outputs: {
				...this.loggingOptions.outputs,
				...options.outputs,
				console: {
					...this.loggingOptions.outputs?.console,
					...options.outputs?.console,
				},
				file: {
					...this.loggingOptions.outputs?.file,
					...options.outputs?.file,
				},
				remote: {
					...this.loggingOptions.outputs?.remote,
					...options.outputs?.remote,
				},
			},
			security: {
				...this.loggingOptions.security,
				...options.security,
			},
		};

		this.config = {
			...this.config,
			...options.config,
		} as LoggerConfig;

		// Restart remote logging if configuration changed
		if (options.outputs?.remote) {
			if (this.remoteFlushTimer) {
				clearInterval(this.remoteFlushTimer);
			}
			if (this.loggingOptions.outputs?.remote?.enabled) {
				this.setupRemoteLogging();
			}
		}

		this.ensureLogDirectories();
	}

	/**
	 * Flush any pending log entries
	 */
	async flush(): Promise<void> {
		// Flush file queue
		while (this.logQueue.length > 0 || this.isWriting) {
			await new Promise((resolve) => setTimeout(resolve, 10));
		}

		// Flush remote queue
		if (this.remoteQueue.length > 0) {
			await this.flushRemoteQueue();
		}
	}

	/**
	 * Disable all logging
	 */
	disable(): void {
		this.loggingOptions.enabled = false;
	}

	/**
	 * Enable logging
	 */
	enable(): void {
		this.loggingOptions.enabled = true;
	}

	/**
	 * Check if logging is enabled
	 */
	isEnabled(): boolean {
		return this.loggingOptions.enabled ?? true;
	}

	/**
	 * Get current logging configuration
	 */
	getConfig(): LoggingOptions {
		return { ...this.loggingOptions };
	}

	/**
	 * Cleanup resources
	 */
	destroy(): void {
		if (this.remoteFlushTimer) {
			clearInterval(this.remoteFlushTimer);
		}

		// Flush any remaining logs
		this.flush().catch((error) => {
			console.error("Error flushing logs during destroy:", error);
		});
	}
}

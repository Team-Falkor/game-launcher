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

/**
 * Structured logger implementation with file rotation and console output
 */
export class Logger implements ILogger {
	private config: LoggerConfig;
	private logQueue: LogEntry[] = [];
	private isWriting = false;

	constructor(config: Partial<LoggerConfig> = {}) {
		this.config = {
			level: 1, // INFO
			enableConsole: true,
			enableFile: false,
			enableAudit: true,
			maxFileSize: 10 * 1024 * 1024, // 10MB
			maxFiles: 5,
			...config,
		};

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
		} catch (error) {
			console.error("Failed to create log directories:", error);
		}
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
		if (level < this.config.level) {
			return; // Skip logs below configured level
		}

		const entry: LogEntry = {
			timestamp: new Date(),
			level,
			message,
			...(context && { context }),
		};

		// Console output
		if (this.config.enableConsole) {
			this.logToConsole(entry);
		}

		// File output
		if (this.config.enableFile && this.config.logFilePath) {
			this.queueLogEntry(entry);
		}
	}

	private logToConsole(entry: LogEntry): void {
		const timestamp = entry.timestamp.toISOString();
		const levelName = this.getLevelName(entry.level);
		const contextStr = entry.context ? ` ${JSON.stringify(entry.context)}` : "";
		const logMessage = `[${timestamp}] ${levelName}: ${entry.message}${contextStr}`;

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
				break;
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

	private async processLogQueue(): Promise<void> {
		if (this.isWriting || this.logQueue.length === 0) {
			return;
		}

		this.isWriting = true;

		try {
			const entries = [...this.logQueue];
			this.logQueue = [];

			const logLines = `${entries
				.map((entry) => {
					const contextStr = entry.context
						? ` ${JSON.stringify(entry.context)}`
						: "";
					return `[${entry.timestamp.toISOString()}] ${this.getLevelName(entry.level)}: ${entry.message}${contextStr}`;
				})
				.join("\n")}\n`;

			if (this.config.logFilePath) {
				await this.writeToFile(this.config.logFilePath, logLines);
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

	private async writeToFile(filePath: string, content: string): Promise<void> {
		try {
			// Check if file needs rotation
			if (existsSync(filePath)) {
				const stats = await stat(filePath);
				if (stats.size > (this.config.maxFileSize || 10 * 1024 * 1024)) {
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
			const maxFiles = this.config.maxFiles || 5;

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
	 * Flush any pending log entries
	 */
	async flush(): Promise<void> {
		while (this.logQueue.length > 0 || this.isWriting) {
			await new Promise((resolve) => setTimeout(resolve, 10));
		}
	}

	/**
	 * Update logger configuration
	 */
	updateConfig(config: Partial<LoggerConfig>): void {
		this.config = { ...this.config, ...config };
		this.ensureLogDirectories();
	}
}

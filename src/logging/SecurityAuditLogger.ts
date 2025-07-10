import { existsSync } from "node:fs";
import { appendFile, mkdir, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { LoggerConfig, SecurityAuditEntry } from "../@types/logging";
import { SecurityEvent } from "../@types/logging";

/**
 * Security audit logger for tracking security-relevant events
 */
export class SecurityAuditLogger {
	private config: LoggerConfig;
	private auditQueue: SecurityAuditEntry[] = [];
	private isWriting = false;

	constructor(config: Partial<LoggerConfig> = {}) {
		this.config = {
			level: 1, // INFO
			enableConsole: true,
			enableFile: false,
			enableAudit: true,
			auditFilePath: resolve(process.cwd(), "logs", "security-audit.log"),
			maxFileSize: 50 * 1024 * 1024, // 50MB for audit logs
			maxFiles: 10, // Keep more audit files
			...config,
		};

		this.ensureAuditDirectory();
	}

	private async ensureAuditDirectory(): Promise<void> {
		try {
			if (this.config.auditFilePath) {
				const auditDir = dirname(this.config.auditFilePath);
				if (!existsSync(auditDir)) {
					await mkdir(auditDir, { recursive: true });
				}
			}
		} catch (error) {
			console.error("Failed to create audit log directory:", error);
		}
	}

	/**
	 * Log a security audit event
	 */
	logSecurityEvent(
		action: SecurityEvent,
		success: boolean,
		details: {
			gameId?: string;
			userId?: string;
			sourceIp?: string;
			executable?: string;
			arguments?: string[];
			workingDirectory?: string;
			environment?: Record<string, string>;
			error?: string;
			blockedValue?: string;
			sanitizedValue?: string;
			[key: string]:
				| string
				| number
				| boolean
				| string[]
				| Record<string, string>
				| null
				| undefined;
		} = {},
	): void {
		const entry: SecurityAuditEntry = {
			timestamp: new Date(),
			level: success ? 1 : 2, // INFO for success, WARN for blocked attempts
			message: this.getSecurityMessage(action, success),
			category: "security",
			action,
			success,
			...(details.gameId !== undefined && { gameId: details.gameId }),
			...(details.userId !== undefined && { userId: details.userId }),
			...(details.sourceIp !== undefined && { sourceIp: details.sourceIp }),
			details: this.sanitizeAuditDetails(details),
		};

		// Always log security events to console if enabled
		if (this.config.enableConsole) {
			this.logToConsole(entry);
		}

		// Queue for file writing
		if (this.config.enableAudit && this.config.auditFilePath) {
			this.queueAuditEntry(entry);
		}
	}

	private getSecurityMessage(action: SecurityEvent, success: boolean): string {
		const status = success ? "SUCCESS" : "BLOCKED";

		switch (action) {
			case SecurityEvent.EXECUTABLE_VALIDATION:
				return `Executable validation ${status}`;
			case SecurityEvent.PATH_SANITIZATION:
				return `Path sanitization ${status}`;
			case SecurityEvent.ARGUMENT_SANITIZATION:
				return `Argument sanitization ${status}`;
			case SecurityEvent.ENVIRONMENT_VALIDATION:
				return `Environment validation ${status}`;
			case SecurityEvent.COMMAND_VALIDATION:
				return `Command validation ${status}`;
			case SecurityEvent.PATH_TRAVERSAL_ATTEMPT:
				return `Path traversal attempt ${status}`;
			case SecurityEvent.INJECTION_ATTEMPT:
				return `Injection attempt ${status}`;
			case SecurityEvent.PRIVILEGE_ESCALATION:
				return `Privilege escalation ${status}`;
			case SecurityEvent.DANGEROUS_ENVIRONMENT_BLOCKED:
				return `Dangerous environment variable ${status}`;
			case SecurityEvent.PROCESS_LAUNCH:
				return `Process launch ${status}`;
			case SecurityEvent.PROCESS_TERMINATION:
				return `Process termination ${status}`;
			case SecurityEvent.ADMIN_EXECUTION:
				return `Admin execution ${status}`;
			case SecurityEvent.PATH_VALIDATION:
				return `Path validation ${status}`;
			case SecurityEvent.PATH_TRAVERSAL:
				return `Path traversal ${status}`;
			default:
				return `Security event ${action} ${status}`;
		}
	}

	private sanitizeAuditDetails(
		details: Record<
			string,
			| string
			| number
			| boolean
			| string[]
			| Record<string, string>
			| null
			| undefined
		>,
	): Record<
		string,
		| string
		| number
		| boolean
		| string[]
		| Record<string, string>
		| null
		| undefined
	> {
		const sanitized: Record<
			string,
			| string
			| number
			| boolean
			| string[]
			| Record<string, string>
			| null
			| undefined
		> = {};

		for (const [key, value] of Object.entries(details)) {
			if (value === undefined || value === null) {
				continue;
			}

			// Sanitize sensitive information
			if (key === "environment" && typeof value === "object") {
				// Only log environment variable names, not values, for security
				sanitized[key] = Object.keys(value);
			} else if (key === "arguments" && Array.isArray(value)) {
				// Truncate long arguments and mask potential sensitive data
				sanitized[key] = value.map((arg) =>
					typeof arg === "string" && arg.length > 100
						? `${arg.substring(0, 100)}...`
						: arg,
				);
			} else if (typeof value === "string" && value.length > 500) {
				// Truncate very long strings
				sanitized[key] = `${value.substring(0, 500)}...`;
			} else {
				sanitized[key] = value;
			}
		}

		return sanitized;
	}

	private logToConsole(entry: SecurityAuditEntry): void {
		const timestamp = entry.timestamp.toISOString();
		const levelName = entry.level === 1 ? "INFO" : "WARN";
		const gameIdStr = entry.gameId ? ` [${entry.gameId}]` : "";
		const detailsStr = entry.details ? ` ${JSON.stringify(entry.details)}` : "";

		const logMessage = `[${timestamp}] ${levelName} SECURITY${gameIdStr}: ${entry.message}${detailsStr}`;

		if (entry.level === 1) {
			console.info(logMessage);
		} else {
			console.warn(logMessage);
		}
	}

	private queueAuditEntry(entry: SecurityAuditEntry): void {
		this.auditQueue.push(entry);
		this.processAuditQueue();
	}

	private async processAuditQueue(): Promise<void> {
		if (this.isWriting || this.auditQueue.length === 0) {
			return;
		}

		this.isWriting = true;

		try {
			const entries = [...this.auditQueue];
			this.auditQueue = [];

			const auditLines = `${entries
				.map((entry) => {
					const auditRecord = {
						timestamp: entry.timestamp.toISOString(),
						level: entry.level === 1 ? "INFO" : "WARN",
						action: entry.action,
						success: entry.success,
						gameId: entry.gameId,
						userId: entry.userId,
						sourceIp: entry.sourceIp,
						message: entry.message,
						details: entry.details,
					};

					return JSON.stringify(auditRecord);
				})
				.join("\n")}\n`;

			if (this.config.auditFilePath) {
				await this.writeToAuditFile(this.config.auditFilePath, auditLines);
			}
		} catch (error) {
			console.error("Failed to write audit entries:", error);
		} finally {
			this.isWriting = false;

			// Process any entries that were queued while writing
			if (this.auditQueue.length > 0) {
				setImmediate(() => this.processAuditQueue());
			}
		}
	}

	private async writeToAuditFile(
		filePath: string,
		content: string,
	): Promise<void> {
		try {
			// Check if file needs rotation
			if (existsSync(filePath)) {
				const stats = await stat(filePath);
				if (stats.size > (this.config.maxFileSize || 50 * 1024 * 1024)) {
					await this.rotateAuditFile(filePath);
				}
			}

			await appendFile(filePath, content, "utf8");
		} catch (error) {
			console.error(`Failed to write to audit file ${filePath}:`, error);
		}
	}

	private async rotateAuditFile(filePath: string): Promise<void> {
		try {
			const maxFiles = this.config.maxFiles || 10;

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
			console.error("Failed to rotate audit file:", error);
		}
	}

	/**
	 * Flush any pending audit entries
	 */
	async flush(): Promise<void> {
		while (this.auditQueue.length > 0 || this.isWriting) {
			await new Promise((resolve) => setTimeout(resolve, 10));
		}
	}

	/**
	 * Update audit logger configuration
	 */
	updateConfig(config: Partial<LoggerConfig>): void {
		this.config = { ...this.config, ...config };
		this.ensureAuditDirectory();
	}
}

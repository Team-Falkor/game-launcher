import { resolve } from "node:path";
import type { LoggerConfig, SecurityEvent } from "@/@types";
import { Logger } from "./Logger";
import { SecurityAuditLogger } from "./SecurityAuditLogger";

export * from "./Logger";
export * from "./SecurityAuditLogger";

/**
 * Default logger configuration
 */
const defaultConfig: LoggerConfig = {
	level: 1, // INFO
	enableConsole: true,
	enableFile: true,
	enableAudit: true,
	logFilePath: resolve(process.cwd(), "logs", "game-launcher.log"),
	auditFilePath: resolve(process.cwd(), "logs", "security-audit.log"),
	maxFileSize: 10 * 1024 * 1024, // 10MB
	maxFiles: 5,
};

/**
 * Singleton logger instances
 */
let loggerInstance: Logger | null = null;
let auditLoggerInstance: SecurityAuditLogger | null = null;
let isLoggingGloballyDisabled = false;

/**
 * Get the singleton logger instance
 */
export function getLogger(config?: Partial<LoggerConfig>): Logger {
	if (!loggerInstance) {
		loggerInstance = new Logger({ ...defaultConfig, ...config });
	} else if (config) {
		loggerInstance.updateConfig(config);
	}
	return loggerInstance;
}

/**
 * No-op security audit logger for when logging is disabled
 */
class NoOpSecurityAuditLogger
	implements
		Pick<SecurityAuditLogger, "logSecurityEvent" | "flush" | "updateConfig">
{
	logSecurityEvent(
		_action: SecurityEvent,
		_success: boolean,
		_details?: {
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
		},
	): void {
		// No-op
	}

	async flush(): Promise<void> {
		// No-op
	}

	updateConfig(_config: Partial<LoggerConfig>): void {
		// No-op
	}
}

/**
 * Get the singleton security audit logger instance
 */
export function getSecurityAuditLogger(
	config?: Partial<LoggerConfig>,
): SecurityAuditLogger {
	// If logging is globally disabled, return no-op logger
	if (isLoggingGloballyDisabled) {
		return new NoOpSecurityAuditLogger() as SecurityAuditLogger;
	}

	if (!auditLoggerInstance) {
		auditLoggerInstance = new SecurityAuditLogger({
			...defaultConfig,
			...config,
		});
	} else if (config) {
		auditLoggerInstance.updateConfig(config);
	}
	return auditLoggerInstance;
}

/**
 * Initialize logging system with custom configuration
 */
export function initializeLogging(config: Partial<LoggerConfig> = {}): {
	logger: Logger;
	auditLogger: SecurityAuditLogger;
} {
	const mergedConfig = { ...defaultConfig, ...config };

	// Set global logging state
	isLoggingGloballyDisabled =
		mergedConfig.enableConsole === false &&
		mergedConfig.enableFile === false &&
		mergedConfig.enableAudit === false;

	// Reset singleton instances to ensure they use the new configuration
	loggerInstance = null;
	auditLoggerInstance = null;

	loggerInstance = new Logger(mergedConfig);
	auditLoggerInstance = isLoggingGloballyDisabled
		? (new NoOpSecurityAuditLogger() as SecurityAuditLogger)
		: new SecurityAuditLogger(mergedConfig);

	return {
		logger: loggerInstance,
		auditLogger: auditLoggerInstance,
	};
}

/**
 * Flush all pending log entries
 */
export async function flushLogs(): Promise<void> {
	const promises: Promise<void>[] = [];

	if (loggerInstance) {
		promises.push(loggerInstance.flush());
	}

	if (auditLoggerInstance) {
		promises.push(auditLoggerInstance.flush());
	}

	await Promise.all(promises);
}

/**
 * Shutdown logging system gracefully
 */
export async function shutdownLogging(): Promise<void> {
	await flushLogs();
	loggerInstance = null;
	auditLoggerInstance = null;
}

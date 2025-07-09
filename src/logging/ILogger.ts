import type { SecurityEvent } from "./SecurityAuditLogger";

/**
 * Log context type for structured logging data
 */
export interface LogContext {
	[key: string]: string | number | boolean | object | null | undefined;
}

/**
 * Logger interface for structured logging
 */
export interface ILogger {
	debug(message: string, context?: LogContext): void;
	info(message: string, context?: LogContext): void;
	warn(message: string, context?: LogContext): void;
	error(message: string, context?: LogContext): void;
}

/**
 * Log levels enumeration
 */
export enum LogLevel {
	DEBUG = 0,
	INFO = 1,
	WARN = 2,
	ERROR = 3,
}

// Re-export SecurityEvent from SecurityAuditLogger to avoid circular imports
export { SecurityEvent } from "./SecurityAuditLogger";

/**
 * Log entry structure
 */
export interface LogEntry {
	timestamp: Date;
	level: LogLevel;
	message: string;
	context?: LogContext;
	category?: string;
}

/**
 * Security audit log entry structure
 */
export interface SecurityAuditEntry extends LogEntry {
	category: "security";
	action: SecurityEvent;
	success: boolean;
	gameId?: string;
	userId?: string;
	sourceIp?: string;
	details: {
		[key: string]:
			| string
			| number
			| boolean
			| string[]
			| Record<string, string>
			| null
			| undefined;
		gameId?: string;
		userId?: string;
		sourceIp?: string;
		executable?: string;
		arguments?: string[];
		workingDirectory?: string | undefined;
		environment?: Record<string, string>;
		error?: string;
		blockedValue?: string;
		sanitizedValue?: string;
	};
}

/**
 * Logger configuration
 */
export interface LoggerConfig {
	level: LogLevel;
	enableConsole: boolean;
	enableFile: boolean;
	enableAudit: boolean;
	logFilePath?: string;
	auditFilePath?: string;
	maxFileSize?: number;
	maxFiles?: number;
}

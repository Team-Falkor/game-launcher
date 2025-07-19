/**
 * Logging-related type definitions for the Game Launcher
 */

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

/**
 * Security audit events enumeration
 */
export enum SecurityEvent {
	EXECUTABLE_VALIDATION = "executable_validation",
	PATH_SANITIZATION = "path_sanitization",
	ARGUMENT_SANITIZATION = "argument_sanitization",
	ENVIRONMENT_VALIDATION = "environment_validation",
	COMMAND_VALIDATION = "command_validation",
	PATH_TRAVERSAL_ATTEMPT = "path_traversal_attempt",
	INJECTION_ATTEMPT = "injection_attempt",
	PRIVILEGE_ESCALATION = "privilege_escalation",
	DANGEROUS_ENVIRONMENT_BLOCKED = "dangerous_environment_blocked",
	PROCESS_LAUNCH = "process_launch",
	PROCESS_TERMINATION = "process_termination",
	ADMIN_EXECUTION = "admin_execution",
	PATH_VALIDATION = "path_validation",
	PATH_TRAVERSAL = "path_traversal",
}

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

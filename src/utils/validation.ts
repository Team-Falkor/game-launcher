import { access, constants } from "node:fs/promises";
import { resolve, normalize, isAbsolute, sep } from "node:path";
import { platform } from "node:os";

export async function validateExecutable(executable: string): Promise<void> {
	if (!executable || typeof executable !== "string") {
		throw new Error("Executable path must be a non-empty string");
	}
	
	if (executable.trim().length === 0) {
		throw new Error("Executable path cannot be empty or whitespace only");
	}
	
	try {
		const resolvedPath = resolve(executable);
		await access(resolvedPath, constants.F_OK | constants.X_OK);
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		throw new Error(`Executable not found or not executable: ${executable} (${errorMessage})`);
	}
}

// Cache regex for better performance
const GAME_ID_REGEX = /^[a-zA-Z0-9_-]+$/;

/**
 * Security validation and sanitization utilities
 */
export class SecurityValidator {
	/**
	 * Sanitizes and validates executable paths to prevent path traversal attacks
	 */
	static sanitizeExecutablePath(path: string): string {
		if (!path || typeof path !== "string") {
			throw new Error("Executable path must be a non-empty string");
		}

		// Remove null bytes and other dangerous characters
		const sanitized = path.replace(/[\x00-\x1f\x7f-\x9f]/g, "");
		
		// Normalize path to prevent traversal
		const normalized = normalize(sanitized);
		
		// Check for path traversal attempts
		if (normalized.includes("..") || normalized.includes("~")) {
			throw new Error("Path traversal detected in executable path");
		}
		
		// Validate path length
		if (normalized.length > 4096) {
			throw new Error("Executable path too long");
		}
		
		// Platform-specific validation
		if (platform() === "win32") {
			// Windows: Check for reserved names and invalid characters
			const reservedNames = ["CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9"];
			const fileName = normalized.split(sep).pop()?.toUpperCase();
			if (fileName) {
				const baseName = fileName.split(".")[0];
				if (baseName && reservedNames.includes(baseName)) {
					throw new Error("Reserved filename detected");
				}
			}
			
			// Check for invalid Windows characters
			if (/[<>:"|?*]/.test(normalized)) {
				throw new Error("Invalid characters in Windows path");
			}
		}
		
		return normalized;
	}

	/**
	 * Sanitizes command line arguments to prevent injection attacks
	 */
	static sanitizeArguments(args: string[]): string[] {
		if (!Array.isArray(args)) {
			throw new Error("Arguments must be an array");
		}
		
		return args.map(arg => {
			if (typeof arg !== "string") {
				throw new Error("All arguments must be strings");
			}
			
			// Remove null bytes and control characters
			const sanitized = arg.replace(/[\x00-\x1f\x7f-\x9f]/g, "");
			
			// Check for command injection patterns
			const dangerousPatterns = [
				/[;&|`$(){}\[\]]/,  // Shell metacharacters
				/\\x[0-9a-fA-F]{2}/, // Hex escape sequences
				/\\[0-7]{1,3}/,     // Octal escape sequences
			];
			
			for (const pattern of dangerousPatterns) {
				if (pattern.test(sanitized)) {
					throw new Error(`Dangerous pattern detected in argument: ${arg}`);
				}
			}
			
			// Validate argument length
			if (sanitized.length > 8192) {
				throw new Error("Argument too long");
			}
			
			return sanitized;
		});
	}

	/**
	 * Validates and sanitizes environment variables
	 */
	static validateEnvironment(env: Record<string, string>): Record<string, string> {
		if (!env || typeof env !== "object") {
			throw new Error("Environment must be an object");
		}
		
		const sanitized: Record<string, string> = {};
		
		// Dangerous environment variables that should be filtered
		const dangerousVars = new Set([
			"LD_PRELOAD", "LD_LIBRARY_PATH", "DYLD_INSERT_LIBRARIES",
			"DYLD_LIBRARY_PATH", "PYTHONPATH", "NODE_PATH",
			"PERL5LIB", "RUBYLIB", "CLASSPATH"
		]);
		
		for (const [key, value] of Object.entries(env)) {
			// Validate key
			if (typeof key !== "string" || typeof value !== "string") {
				throw new Error("Environment variable keys and values must be strings");
			}
			
			// Check for dangerous variables
			if (dangerousVars.has(key.toUpperCase())) {
				continue; // Skip dangerous variables
			}
			
			// Validate key format
			if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
				throw new Error(`Invalid environment variable name: ${key}`);
			}
			
			// Remove null bytes and control characters from value
			const sanitizedValue = value.replace(/[\x00-\x1f\x7f-\x9f]/g, "");
			
			// Validate lengths
			if (key.length > 255) {
				throw new Error("Environment variable name too long");
			}
			if (sanitizedValue.length > 32768) {
				throw new Error("Environment variable value too long");
			}
			
			sanitized[key] = sanitizedValue;
		}
		
		return sanitized;
	}
}

/**
 * Command sanitization utilities
 */
export class CommandSanitizer {
	/**
	 * Escapes shell arguments for safe execution
	 */
	static escapeShellArg(arg: string): string {
		if (typeof arg !== "string") {
			throw new Error("Argument must be a string");
		}
		
		if (platform() === "win32") {
			// Windows: Escape double quotes and backslashes
			return `"${arg.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
		} else {
			// Unix: Use single quotes and escape single quotes
			return `'${arg.replace(/'/g, "'\\''")}';`
		}
	}

	/**
	 * Validates command for execution safety
	 */
	static validateCommand(command: string): void {
		if (!command || typeof command !== "string") {
			throw new Error("Command must be a non-empty string");
		}
		
		// Check for shell injection patterns
		const dangerousPatterns = [
			/[;&|`$(){}]/,        // Shell metacharacters
			/\s(sudo|su)\s/,     // Privilege escalation
			/\s(rm|del)\s/,      // File deletion
			/\s(wget|curl)\s/,   // Network access
			/\s(nc|netcat)\s/,   // Network tools
		];
		
		for (const pattern of dangerousPatterns) {
			if (pattern.test(command)) {
				throw new Error(`Dangerous command pattern detected: ${command}`);
			}
		}
	}
}

/**
 * Path validation utilities
 */
export class PathValidator {
	/**
	 * Validates executable path for security
	 */
	static validateExecutablePath(path: string): void {
		if (!path || typeof path !== "string") {
			throw new Error("Path must be a non-empty string");
		}
		
		// Use SecurityValidator for sanitization and validation
		SecurityValidator.sanitizeExecutablePath(path);
		
		// Additional executable-specific checks
		if (!isAbsolute(path)) {
			throw new Error("Executable path must be absolute");
		}
		
		// Check for executable extensions on Windows
		if (platform() === "win32") {
			const validExtensions = [".exe", ".bat", ".cmd", ".com"];
			const hasValidExtension = validExtensions.some(ext => 
				path.toLowerCase().endsWith(ext)
			);
			if (!hasValidExtension) {
				throw new Error("Windows executable must have valid extension (.exe, .bat, .cmd, .com)");
			}
		}
	}

	/**
	 * Validates working directory path
	 */
	static validateWorkingDirectory(dir: string): void {
		if (!dir || typeof dir !== "string") {
			throw new Error("Working directory must be a non-empty string");
		}
		
		// Normalize and check for traversal
		const normalized = normalize(dir);
		
		if (normalized.includes("..")) {
			throw new Error("Path traversal detected in working directory");
		}
		
		if (!isAbsolute(normalized)) {
			throw new Error("Working directory must be absolute");
		}
		
		if (normalized.length > 4096) {
			throw new Error("Working directory path too long");
		}
	}
}

export function validateGameId(gameId: string): void {
	if (!gameId || typeof gameId !== "string") {
		throw new Error("Game ID must be a non-empty string");
	}

	// Check length first as it's faster than regex
	if (gameId.length === 0) {
		throw new Error("Game ID cannot be empty");
	}
	
	if (gameId.length > 255) {
		throw new Error("Game ID must be less than 255 characters");
	}

	if (!GAME_ID_REGEX.test(gameId)) {
		throw new Error(
			"Game ID can only contain alphanumeric characters, hyphens, and underscores",
		);
	}
}

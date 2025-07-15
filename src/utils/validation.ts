import { access, constants } from "node:fs/promises";
import { platform, homedir } from "node:os";
import { isAbsolute, normalize, resolve, sep } from "node:path";
import { SecurityEvent } from "@/@types";
import { getSecurityAuditLogger } from "../logging";

/**
 * Helper function to remove control characters without using regex ranges
 */
function removeControlCharacters(input: string): string {
	return input
		.split("")
		.filter((char) => {
			const code = char.charCodeAt(0);
			// Remove null bytes (0x00) and control characters (0x01-0x1F, 0x7F-0x9F)
			return !(code <= 0x1f || (code >= 0x7f && code <= 0x9f));
		})
		.join("");
}

/**
 * Expands tilde (~) to home directory path
 */
function expandTildePath(path: string): string {
	if (path.startsWith('~/') || path === '~') {
		return path.replace(/^~/, homedir());
	}
	return path;
}

export async function validateExecutable(executable: string): Promise<void> {
	const auditLogger = getSecurityAuditLogger();

	if (!executable || typeof executable !== "string") {
		auditLogger.logSecurityEvent(SecurityEvent.EXECUTABLE_VALIDATION, false, {
			executable,
			error: "Executable path must be a non-empty string",
		});
		throw new Error("Executable path must be a non-empty string");
	}

	if (executable.trim().length === 0) {
		auditLogger.logSecurityEvent(SecurityEvent.EXECUTABLE_VALIDATION, false, {
			executable,
			error: "Executable path cannot be empty or whitespace only",
		});
		throw new Error("Executable path cannot be empty or whitespace only");
	}

	// Expand tilde to home directory if present
	const expandedPath = expandTildePath(executable);

	// Perform file system validation
	try {
		const resolvedPath = resolve(expandedPath);
		
		// First check if file exists
		await access(resolvedPath, constants.F_OK);
		
		// For cross-platform compatibility (e.g., .exe files on Linux with Proton),
		// only check execute permissions on native executables
		const isWindowsExeOnLinux = platform() !== 'win32' && resolvedPath.toLowerCase().endsWith('.exe');
		
		if (!isWindowsExeOnLinux) {
			// Check execute permissions for native executables
			await access(resolvedPath, constants.X_OK);
		}
		
		auditLogger.logSecurityEvent(SecurityEvent.EXECUTABLE_VALIDATION, true, {
			executable: resolvedPath,
			crossPlatform: isWindowsExeOnLinux,
		});
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		auditLogger.logSecurityEvent(SecurityEvent.EXECUTABLE_VALIDATION, false, {
			executable,
			error: errorMessage,
		});
		throw new Error(
			`Executable not found or not executable: ${executable} (${errorMessage})`,
		);
	}
}

// Cache regex for better performance
const GAME_ID_REGEX = /^[a-zA-Z0-9_-]+$/;

/**
 * Security validation and sanitization utilities
 */
export namespace SecurityValidator {
	/**
	 * Sanitizes and validates executable paths to prevent path traversal attacks
	 */
	export function sanitizeExecutablePath(path: string): string {
		const auditLogger = getSecurityAuditLogger();

		if (!path || typeof path !== "string") {
			auditLogger.logSecurityEvent(SecurityEvent.PATH_SANITIZATION, false, {
				originalPath: path,
				error: "Executable path must be a non-empty string",
			});
			throw new Error("Executable path must be a non-empty string");
		}



		// Remove null bytes and other dangerous characters
		const sanitized = removeControlCharacters(path);

		// Normalize path to prevent traversal
		const normalized = normalize(sanitized);

		// Expand tilde to home directory if present
		const expandedPath = expandTildePath(normalized);
		const finalNormalized = normalize(expandedPath);

		// Check for path traversal attempts (after tilde expansion)
		if (finalNormalized.includes("..")) {
			auditLogger.logSecurityEvent(
				SecurityEvent.PATH_TRAVERSAL_ATTEMPT,
				false,
				{
					originalPath: path,
					normalizedPath: finalNormalized,
					error: "Path traversal detected in executable path",
				},
			);
			throw new Error("Path traversal detected in executable path");
		}

		// Validate path length
		if (finalNormalized.length > 4096) {
			auditLogger.logSecurityEvent(SecurityEvent.PATH_SANITIZATION, false, {
				originalPath: path,
				normalizedPath: finalNormalized,
				error: "Executable path too long",
			});
			throw new Error("Executable path too long");
		}

		// Platform-specific validation
		if (platform() === "win32") {
			// Windows: Check for reserved names and invalid characters
			const reservedNames = [
				"CON",
				"PRN",
				"AUX",
				"NUL",
				"COM1",
				"COM2",
				"COM3",
				"COM4",
				"COM5",
				"COM6",
				"COM7",
				"COM8",
				"COM9",
				"LPT1",
				"LPT2",
				"LPT3",
				"LPT4",
				"LPT5",
				"LPT6",
				"LPT7",
				"LPT8",
				"LPT9",
			];
			const fileName = finalNormalized.split(sep).pop()?.toUpperCase();
			if (fileName) {
				const baseName = fileName.split(".")[0];
				if (baseName && reservedNames.includes(baseName)) {
					auditLogger.logSecurityEvent(SecurityEvent.PATH_SANITIZATION, false, {
						originalPath: path,
						normalizedPath: finalNormalized,
						reservedName: baseName,
						error: "Reserved filename detected",
					});
					throw new Error("Reserved filename detected");
				}
			}

			// Check for invalid Windows characters (excluding colon which is valid in drive letters)
			if (/[<>"|?*]/.test(finalNormalized)) {
				auditLogger.logSecurityEvent(SecurityEvent.PATH_SANITIZATION, false, {
					originalPath: path,
					normalizedPath: finalNormalized,
					error: "Invalid characters in Windows path",
				});
				throw new Error("Invalid characters in Windows path");
			}
		}

		auditLogger.logSecurityEvent(SecurityEvent.PATH_SANITIZATION, true, {
			originalPath: path,
			sanitizedPath: finalNormalized,
		});

		return finalNormalized;
	}

	/**
	 * Sanitizes command line arguments to prevent injection attacks
	 */
	export function sanitizeArguments(args: string[]): string[] {
		const auditLogger = getSecurityAuditLogger();

		if (!Array.isArray(args)) {
			auditLogger.logSecurityEvent(SecurityEvent.ARGUMENT_SANITIZATION, false, {
				arguments: args,
				error: "Arguments must be an array",
			});
			throw new Error("Arguments must be an array");
		}

		const sanitizedArgs = args.map((arg) => {
			if (typeof arg !== "string") {
				auditLogger.logSecurityEvent(
					SecurityEvent.ARGUMENT_SANITIZATION,
					false,
					{
						arguments: args,
						invalidArgument: arg,
						error: "All arguments must be strings",
					},
				);
				throw new Error("All arguments must be strings");
			}

			// Remove null bytes and control characters
			const sanitized = removeControlCharacters(arg);

			// Check for actual command injection patterns (more specific validation)
			// Allow legitimate game arguments like --fullscreen, -windowed, etc.
			const actualInjectionPatterns = [
				/;\s*\w+/, // Command chaining with semicolon
				/\|\s*\w+/, // Pipe to another command
				/&\s*\w+/, // Background execution
				/`[^`]*`/, // Command substitution with backticks
				/\$\([^)]*\)/, // Command substitution with $()
				/\\x[0-9a-fA-F]{2}/, // Hex escape sequences
				/\\[0-7]{1,3}/, // Octal escape sequences
				/\${[^}]*}/, // Variable expansion
			];

			// Only flag if it's clearly an injection attempt, not legitimate args
			for (const pattern of actualInjectionPatterns) {
				if (pattern.test(sanitized)) {
					auditLogger.logSecurityEvent(SecurityEvent.INJECTION_ATTEMPT, false, {
						originalArgument: arg,
						sanitizedArgument: sanitized,
						patternMatched: pattern.toString(),
						error: `Dangerous pattern detected in argument: ${arg}`,
					});
					throw new Error(`Dangerous pattern detected in argument: ${arg}`);
				}
			}

			// Validate argument length
			if (sanitized.length > 8192) {
				auditLogger.logSecurityEvent(
					SecurityEvent.ARGUMENT_SANITIZATION,
					false,
					{
						originalArgument: arg,
						sanitizedArgument: sanitized,
						error: "Argument too long",
					},
				);
				throw new Error("Argument too long");
			}

			return sanitized;
		});

		auditLogger.logSecurityEvent(SecurityEvent.ARGUMENT_SANITIZATION, true, {
			originalArguments: args,
			sanitizedArguments: sanitizedArgs,
		});

		return sanitizedArgs;
	}

	/**
	 * Validates and sanitizes environment variables
	 */
	export function validateEnvironment(
		env: Record<string, string>,
	): Record<string, string> {
		const auditLogger = getSecurityAuditLogger();

		if (!env || typeof env !== "object") {
			auditLogger.logSecurityEvent(
				SecurityEvent.ENVIRONMENT_VALIDATION,
				false,
				{
					environment: env,
					error: "Environment must be an object",
				},
			);
			throw new Error("Environment must be an object");
		}

		const sanitized: Record<string, string> = {};
		const blockedVars: string[] = [];

		// Dangerous environment variables that should be filtered
		const dangerousVars = new Set([
			"LD_PRELOAD",
			"LD_LIBRARY_PATH",
			"DYLD_INSERT_LIBRARIES",
			"DYLD_LIBRARY_PATH",
			"PYTHONPATH",
			"NODE_PATH",
			"PERL5LIB",
			"RUBYLIB",
			"CLASSPATH",
		]);

		for (const [key, value] of Object.entries(env)) {
			// Validate key
			if (typeof key !== "string" || typeof value !== "string") {
				auditLogger.logSecurityEvent(
					SecurityEvent.ENVIRONMENT_VALIDATION,
					false,
					{
						environmentKey: key,
						environmentValue: value,
						error: "Environment variable keys and values must be strings",
					},
				);
				throw new Error("Environment variable keys and values must be strings");
			}

			// Check for dangerous variables
			if (dangerousVars.has(key.toUpperCase())) {
				blockedVars.push(key);
				auditLogger.logSecurityEvent(
					SecurityEvent.DANGEROUS_ENVIRONMENT_BLOCKED,
					true,
					{
						blockedVariable: key,
						reason: "Dangerous environment variable blocked",
					},
				);
				continue; // Skip dangerous variables
			}

			// Validate key format (allow parentheses for Windows system variables like CommonProgramFiles(x86))
			if (!/^[A-Za-z_][A-Za-z0-9_()]*$/.test(key)) {
				auditLogger.logSecurityEvent(
					SecurityEvent.ENVIRONMENT_VALIDATION,
					false,
					{
						environmentKey: key,
						error: `Invalid environment variable name: ${key}`,
					},
				);
				throw new Error(`Invalid environment variable name: ${key}`);
			}

			// Remove null bytes and control characters from value
			const sanitizedValue = removeControlCharacters(value);

			// Validate lengths
			if (key.length > 255) {
				auditLogger.logSecurityEvent(
					SecurityEvent.ENVIRONMENT_VALIDATION,
					false,
					{
						environmentKey: key,
						error: "Environment variable name too long",
					},
				);
				throw new Error("Environment variable name too long");
			}
			if (sanitizedValue.length > 32768) {
				auditLogger.logSecurityEvent(
					SecurityEvent.ENVIRONMENT_VALIDATION,
					false,
					{
						environmentKey: key,
						environmentValue: sanitizedValue,
						error: "Environment variable value too long",
					},
				);
				throw new Error("Environment variable value too long");
			}

			sanitized[key] = sanitizedValue;
		}

		auditLogger.logSecurityEvent(SecurityEvent.ENVIRONMENT_VALIDATION, true, {
			originalVariableCount: Object.keys(env).length,
			sanitizedVariableCount: Object.keys(sanitized).length,
			blockedVariables: blockedVars,
		});

		return sanitized;
	}
}

/**
 * Command sanitization utilities
 */
export namespace CommandSanitizer {
	/**
	 * Escapes shell arguments for safe execution
	 */
	export function escapeShellArg(arg: string): string {
		if (typeof arg !== "string") {
			throw new Error("Argument must be a string");
		}

		if (platform() === "win32") {
			// Windows: Escape double quotes and backslashes
			return `"${arg.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
		} else {
			// Unix: Use single quotes and escape single quotes
			return `'${arg.replace(/'/g, "'\\''")}'`;
		}
	}

	/**
	 * Validates command for execution safety
	 */
	export function validateCommand(command: string): void {
		const auditLogger = getSecurityAuditLogger();

		if (!command || typeof command !== "string") {
			auditLogger.logSecurityEvent(SecurityEvent.COMMAND_VALIDATION, false, {
				command,
				error: "Command must be a non-empty string",
			});
			throw new Error("Command must be a non-empty string");
		}

		// Check for shell injection patterns (allow legitimate Windows command operators)
		// First, check if the command contains properly quoted paths
		const hasQuotedPaths = /["'][^"']*["']/.test(command);
		
		const dangerousPatterns = [
			// Platform-specific dangerous metacharacters (forward slash is safe on Unix)
			platform() === "win32" ? /[;`${}/]/ : /[;`${}]/, // Exclude forward slash on Unix
			/\|\|/, // OR operator (potentially dangerous)
			/\s(sudo|su)\s/, // Privilege escalation
			/\s(rm|del)\s/, // File deletion
			/\s(wget|curl)\s/, // Network access
			/\s(nc|netcat)\s/, // Network tools
		];
		
		// Only check for command substitution if not dealing with quoted executable paths
		if (!hasQuotedPaths) {
			dangerousPatterns.push(/\(.*\)/); // Parentheses (command substitution)
		}

		for (const pattern of dangerousPatterns) {
			if (pattern.test(command)) {
				// Debug: Log the exact pattern that matched
				console.error(`DEBUG: Command validation failed`);
				console.error(`DEBUG: Command: ${command}`);
				console.error(`DEBUG: Pattern matched: ${pattern.toString()}`);
				console.error(`DEBUG: Platform: ${platform()}`);
				console.error(`DEBUG: Has quoted paths: ${hasQuotedPaths}`);
				
				if (pattern.toString().includes("sudo|su")) {
					auditLogger.logSecurityEvent(
						SecurityEvent.PRIVILEGE_ESCALATION,
						false,
						{
							command,
							patternMatched: pattern.toString(),
							error: `Privilege escalation attempt detected: ${command}`,
						},
					);
				} else {
					auditLogger.logSecurityEvent(SecurityEvent.INJECTION_ATTEMPT, false, {
						command,
						patternMatched: pattern.toString(),
						error: `Dangerous command pattern detected: ${command}`,
					});
				}
				throw new Error(`Dangerous command pattern detected: ${command}`);
			}
		}

		auditLogger.logSecurityEvent(SecurityEvent.COMMAND_VALIDATION, true, {
			command,
		});
	}
}

/**
 * Path validation utilities
 */
export namespace PathValidator {
	/**
	 * Validates executable path for security
	 */
	export function validateExecutablePath(path: string): void {
		const auditLogger = getSecurityAuditLogger();

		if (!path || typeof path !== "string") {
			auditLogger.logSecurityEvent(SecurityEvent.PATH_VALIDATION, false, {
				path,
				error: "Path must be a non-empty string",
			});
			throw new Error("Path must be a non-empty string");
		}

		// Use SecurityValidator for sanitization and validation
		SecurityValidator.sanitizeExecutablePath(path);

		// Additional executable-specific checks
		if (!isAbsolute(path)) {
			auditLogger.logSecurityEvent(SecurityEvent.PATH_VALIDATION, false, {
				path,
				error: "Executable path must be absolute",
			});
			throw new Error("Executable path must be absolute");
		}

		// Check for executable extensions on Windows
		if (platform() === "win32") {
			const validExtensions = [".exe", ".bat", ".cmd", ".com"];
			const hasValidExtension = validExtensions.some((ext) =>
				path.toLowerCase().endsWith(ext),
			);
			if (!hasValidExtension) {
				auditLogger.logSecurityEvent(SecurityEvent.PATH_VALIDATION, false, {
					path,
					error:
						"Windows executable must have valid extension (.exe, .bat, .cmd, .com)",
				});
				throw new Error(
					"Windows executable must have valid extension (.exe, .bat, .cmd, .com)",
				);
			}
		}

		auditLogger.logSecurityEvent(SecurityEvent.PATH_VALIDATION, true, {
			path,
			type: "executable",
		});
	}

	/**
	 * Validates working directory path
	 */
	export function validateWorkingDirectory(dir: string): void {
		const auditLogger = getSecurityAuditLogger();

		if (!dir || typeof dir !== "string") {
			auditLogger.logSecurityEvent(SecurityEvent.PATH_VALIDATION, false, {
				path: dir,
				error: "Working directory must be a non-empty string",
			});
			throw new Error("Working directory must be a non-empty string");
		}

		// Normalize and check for traversal
		const normalized = normalize(dir);

		if (normalized.includes("..")) {
			auditLogger.logSecurityEvent(SecurityEvent.PATH_TRAVERSAL, false, {
				path: dir,
				normalizedPath: normalized,
				error: "Path traversal detected in working directory",
			});
			throw new Error("Path traversal detected in working directory");
		}

		if (!isAbsolute(normalized)) {
			auditLogger.logSecurityEvent(SecurityEvent.PATH_VALIDATION, false, {
				path: dir,
				normalizedPath: normalized,
				error: "Working directory must be absolute",
			});
			throw new Error("Working directory must be absolute");
		}

		if (normalized.length > 4096) {
			auditLogger.logSecurityEvent(SecurityEvent.PATH_VALIDATION, false, {
				path: dir,
				normalizedPath: normalized,
				error: "Working directory path too long",
			});
			throw new Error("Working directory path too long");
		}

		auditLogger.logSecurityEvent(SecurityEvent.PATH_VALIDATION, true, {
			path: dir,
			normalizedPath: normalized,
			type: "workingDirectory",
		});
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

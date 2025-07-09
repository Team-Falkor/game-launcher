import { access, constants } from "node:fs/promises";
import { resolve } from "node:path";

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

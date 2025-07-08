import { access, constants } from "node:fs/promises";
import { resolve } from "node:path";

export async function validateExecutable(executable: string): Promise<void> {
	try {
		const resolvedPath = resolve(executable);
		await access(resolvedPath, constants.F_OK | constants.X_OK);
	} catch (_error) {
		throw new Error(`Executable not found or not executable: ${executable}`);
	}
}

export function validateGameId(gameId: string): void {
	if (!gameId || typeof gameId !== "string") {
		throw new Error("Game ID must be a non-empty string");
	}

	if (gameId.length > 255) {
		throw new Error("Game ID must be less than 255 characters");
	}

	if (!/^[a-zA-Z0-9_-]+$/.test(gameId)) {
		throw new Error(
			"Game ID can only contain alphanumeric characters, hyphens, and underscores",
		);
	}
}

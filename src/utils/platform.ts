export type Platform = "win32" | "darwin" | "linux" | "other";

// Cache platform detection for better performance
let cachedPlatform: Platform | null = null;

export function getPlatform(): Platform {
	if (cachedPlatform === null) {
		const platform = process.platform;

		if (platform === "win32") cachedPlatform = "win32";
		else if (platform === "darwin") cachedPlatform = "darwin";
		else if (platform === "linux") cachedPlatform = "linux";
		else cachedPlatform = "other";
	}

	return cachedPlatform;
}

export function getKillSignal(force: boolean = false): string {
	// Simplified since all platforms use the same signals
	return force ? "SIGKILL" : "SIGTERM";
}

export type Platform = "win32" | "darwin" | "linux" | "other";

export function getPlatform(): Platform {
	const platform = process.platform;

	if (platform === "win32") return "win32";
	if (platform === "darwin") return "darwin";
	if (platform === "linux") return "linux";

	return "other";
}

export function getKillSignal(force: boolean = false): string {
	const platform = getPlatform();

	if (platform === "win32") {
		return force ? "SIGKILL" : "SIGTERM";
	}

	return force ? "SIGKILL" : "SIGTERM";
}

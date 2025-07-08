import type { GameProcessEvents } from "./events";
import type { GameProcessInfo } from "./process";

export interface GameLauncherOptions {
	/** Maximum number of concurrent games */
	maxConcurrentGames?: number | undefined;
	/** Default working directory for games */
	defaultWorkingDirectory?: string | undefined;
	/** Default environment variables */
	defaultEnvironment?: Record<string, string> | undefined;
	/** Enable process monitoring */
	enableProcessMonitoring?: boolean | undefined;
	/** Monitoring interval in milliseconds */
	monitoringInterval?: number | undefined;
}

export interface LaunchGameOptions {
	/** Unique identifier for the game */
	gameId: string;
	/** Path to the game executable */
	executable: string;
	/** Command line arguments */
	args?: string[] | undefined;
	/** Working directory */
	workingDirectory?: string | undefined;
	/** Environment variables */
	environment?: Record<string, string> | undefined;
	/** Capture stdout/stderr */
	captureOutput?: boolean | undefined;
	/** Launch timeout in milliseconds */
	timeout?: number | undefined;
	/** Additional metadata */
	metadata?: Record<string, any> | undefined;
}

export interface GameLauncherInterface {
	launchGame(options: LaunchGameOptions): Promise<string>;
	closeGame(gameId: string, force?: boolean): Promise<boolean>;
	isGameRunning(gameId: string): boolean;
	getRunningGames(): string[];
	getGameInfo(gameId: string): GameProcessInfo | null;
	on<K extends keyof GameProcessEvents>(
		event: K,
		listener: GameProcessEvents[K],
	): this;
	off<K extends keyof GameProcessEvents>(
		event: K,
		listener: GameProcessEvents[K],
	): this;
	removeAllListeners(event?: keyof GameProcessEvents): this;
}

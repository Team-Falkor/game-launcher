import { validateGameId } from "@/utils/validation";
import type {
	GameLauncherInterface,
	GameLauncherOptions,
	GameProcessEvents,
	GameProcessInfo,
	LaunchGameOptions,
} from "../@types";
import { GameEventEmitter } from "./EventEmitter";
import { ProcessManager } from "./ProcessManager";

export class GameLauncher implements GameLauncherInterface {
	private eventEmitter: GameEventEmitter;
	private processManager: ProcessManager;
	private options: GameLauncherOptions;

	constructor(options: GameLauncherOptions = {}) {
		this.options = {
			maxConcurrentGames: 10,
			enableProcessMonitoring: true,
			monitoringInterval: 1000,
			...options,
		};

		this.eventEmitter = new GameEventEmitter();

		// Filter out undefined values for ProcessManager options
		const processManagerOptions = {
			...(this.options.monitoringInterval !== undefined && {
				monitoringInterval: this.options.monitoringInterval,
			}),
			...(this.options.enableProcessMonitoring !== undefined && {
				enableResourceMonitoring: this.options.enableProcessMonitoring,
			}),
		};

		this.processManager = new ProcessManager(
			this.eventEmitter,
			processManagerOptions,
		);
	}

	async launchGame(options: LaunchGameOptions): Promise<string> {
		const {
			gameId,
			executable,
			args = [],
			workingDirectory,
			environment,
		} = options;

		validateGameId(gameId);

		if (this.isGameRunning(gameId)) {
			throw new Error(`Game with ID "${gameId}" is already running`);
		}

		const runningGames = this.getRunningGames();
		const maxGames = this.options.maxConcurrentGames ?? 10;
		if (runningGames.length >= maxGames) {
			throw new Error(`Maximum concurrent games limit reached (${maxGames})`);
		}

		// Filter out undefined values for process options
		const processOptions = {
			...(workingDirectory !== undefined && { workingDirectory }),
			...(this.options.defaultWorkingDirectory !== undefined &&
				workingDirectory === undefined && {
					workingDirectory: this.options.defaultWorkingDirectory,
				}),
			environment: {
				...(this.options.defaultEnvironment || {}),
				...(environment || {}),
			},
			...(options.captureOutput !== undefined && {
				captureOutput: options.captureOutput,
			}),
			...(options.timeout !== undefined && { timeout: options.timeout }),
			...(options.runAsAdmin !== undefined && {
				runAsAdmin: options.runAsAdmin,
			}),
			...(options.metadata !== undefined && { metadata: options.metadata }),
		};

		await this.processManager.startProcess(
			gameId,
			executable,
			args,
			processOptions,
		);
		return gameId;
	}

	async closeGame(gameId: string, force = false): Promise<boolean> {
		return this.processManager.killProcess(gameId, force);
	}

	isGameRunning(gameId: string): boolean {
		return this.processManager.isProcessRunning(gameId);
	}

	getRunningGames(): string[] {
		const allProcesses = this.processManager.getAllProcesses();
		const runningGames: string[] = [];
		
		// More efficient iteration without intermediate arrays
		for (const [gameId, info] of allProcesses) {
			if (info.status === "running" || info.status === "detached") {
				runningGames.push(gameId);
			}
		}
		
		return runningGames;
	}

	getGameInfo(gameId: string): GameProcessInfo | null {
		return this.processManager.getProcessInfo(gameId);
	}

	on<K extends keyof GameProcessEvents>(
		event: K,
		listener: GameProcessEvents[K],
	): this {
		this.eventEmitter.on(event, listener);
		return this;
	}

	off<K extends keyof GameProcessEvents>(
		event: K,
		listener: GameProcessEvents[K],
	): this {
		this.eventEmitter.off(event, listener);
		return this;
	}

	removeAllListeners(event?: keyof GameProcessEvents): this {
		this.eventEmitter.removeAllListeners(event);
		return this;
	}

	destroy(): void {
		this.processManager.destroy();
		this.eventEmitter.removeAllListeners();
	}
}

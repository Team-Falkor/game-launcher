import type { ChildProcess } from "node:child_process";
import type { GameStatus } from "./events";

export interface GameProcessInfo {
	gameId: string;
	pid: number;
	executable: string;
	args: string[];
	workingDirectory: string;
	environment: Record<string, string>;
	status: GameStatus;
	startTime: Date;
	endTime?: Date;
	exitCode?: number | null;
	signal?: string | null;
	metadata: Record<string, string | number | boolean | null>;
}

export interface ProcessManagerOptions {
	monitoringInterval?: number | undefined;
	enableResourceMonitoring?: boolean | undefined;
	logger?:
		| {
				logSecurityEvent?: (
					event: string,
					success: boolean,
					details: Record<string, unknown>,
				) => void;
				debug(message: string, context?: Record<string, unknown>): void;
				info(message: string, context?: Record<string, unknown>): void;
				warn(message: string, context?: Record<string, unknown>): void;
				error(message: string, context?: Record<string, unknown>): void;
		  }
		| undefined;
}

export interface ProcessManagerInterface {
	startProcess(
		gameId: string,
		executable: string,
		args: string[],
		options: ProcessStartOptions,
	): Promise<ChildProcess>;
	killProcess(gameId: string, force?: boolean): Promise<boolean>;
	getProcess(gameId: string): ChildProcess | null;
	getProcessInfo(gameId: string): GameProcessInfo | null;
	getAllProcesses(): Map<string, GameProcessInfo>;
	isProcessRunning(gameId: string): boolean;
}

export interface ProcessStartOptions {
	workingDirectory?: string | undefined;
	environment?: Record<string, string> | undefined;
	captureOutput?: boolean | undefined;
	timeout?: number | undefined;
	runAsAdmin?: boolean | undefined;
	metadata?: Record<string, string | number | boolean | null> | undefined;
}

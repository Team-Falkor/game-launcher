export interface GameProcessEvents {
	launched: (data: GameLaunchedEvent) => void;
	closed: (data: GameClosedEvent) => void;
	error: (data: GameErrorEvent) => void;
	output: (data: GameOutputEvent) => void;
	statusChange: (data: GameStatusChangeEvent) => void;
}

export interface GameLaunchedEvent {
	gameId: string;
	pid: number;
	startTime: Date;
	command: string;
	args: string[];
}

export interface GameClosedEvent {
	gameId: string;
	pid: number;
	exitCode: number | null;
	signal: string | null;
	startTime: Date;
	endTime: Date;
	duration: number;
}

export interface GameErrorEvent {
	gameId: string;
	pid?: number | undefined;
	error: Error;
	phase: "launch" | "runtime" | "cleanup";
}

export interface GameOutputEvent {
	gameId: string;
	pid: number;
	type: "stdout" | "stderr";
	data: string;
	timestamp: Date;
}

export interface GameStatusChangeEvent {
	gameId: string;
	pid: number;
	previousStatus: GameStatus;
	currentStatus: GameStatus;
	timestamp: Date;
}

export type GameStatus =
	| "launching"
	| "running"
	| "detached"
	| "closing"
	| "closed"
	| "error";
import type {
	GameClosedEvent,
	GameErrorEvent,
	GameLaunchedEvent,
	GameOutputEvent,
	GameProcessEvents,
	GameProcessInfo,
	GameStatusChangeEvent,
	Game as IGame,
	ProcessManagerInterface,
} from "../@types";
import type { GameEventEmitter } from "./EventEmitter";

type GameEventData =
	| GameLaunchedEvent
	| GameClosedEvent
	| GameErrorEvent
	| GameOutputEvent
	| GameStatusChangeEvent;
type EventListener = (data: GameEventData) => void;

/**
 * Represents a single game instance with its own event handling capabilities
 */
export class Game implements IGame {
	private gameId: string;
	private launcher: GameEventEmitter;
	private processManager: ProcessManagerInterface;
	private listenerMap = new Map<EventListener, EventListener>();

	constructor(
		gameId: string,
		launcher: GameEventEmitter,
		processManager: ProcessManagerInterface,
	) {
		this.gameId = gameId;
		this.launcher = launcher;
		this.processManager = processManager;
	}

	/**
	 * Get the game ID
	 */
	get id(): string {
		return this.gameId;
	}

	/**
	 * Listen to events specific to this game
	 */
	on<K extends keyof GameProcessEvents>(
		event: K,
		listener: GameProcessEvents[K],
	): Game {
		// Create a wrapper that filters events for this specific game
		const wrappedListener = (data: GameEventData) => {
			// Check if the event data has a gameId property and matches this game
			if (
				typeof data === "object" &&
				data !== null &&
				"gameId" in data &&
				data.gameId === this.gameId
			) {
				(listener as EventListener)(data);
			}
		};

		// Store the original listener reference for removal
		this.listenerMap.set(listener as EventListener, wrappedListener);

		this.launcher.on(event, wrappedListener as GameProcessEvents[K]);
		return this;
	}

	/**
	 * Remove event listener for this game
	 */
	off<K extends keyof GameProcessEvents>(
		event: K,
		listener: GameProcessEvents[K],
	): Game {
		const listenerKey = listener as EventListener;
		if (this.listenerMap?.has(listenerKey)) {
			const wrappedListener = this.listenerMap.get(listenerKey);
			if (wrappedListener) {
				this.launcher.off(event, wrappedListener as GameProcessEvents[K]);
				this.listenerMap.delete(listenerKey);
			}
		}
		return this;
	}

	/**
	 * Remove all listeners for this game
	 */
	removeAllListeners(): Game {
		// Remove all wrapped listeners from all events
		for (const [, wrappedListener] of this.listenerMap) {
			// Remove from all possible events since we don't track which event each listener is on
			const events: (keyof GameProcessEvents)[] = [
				"launched",
				"closed",
				"error",
				"output",
				"statusChange",
			];
			for (const event of events) {
				this.launcher.off(
					event,
					wrappedListener as GameProcessEvents[typeof event],
				);
			}
		}
		this.listenerMap.clear();
		return this;
	}

	/**
	 * Check if this game is currently running
	 */
	isRunning(): boolean {
		return this.processManager.isProcessRunning(this.gameId);
	}

	/**
	 * Get information about this game process
	 */
	getInfo(): GameProcessInfo | null {
		return this.processManager.getProcessInfo(this.gameId);
	}

	/**
	 * Close this game
	 */
	async close(force = false): Promise<boolean> {
		return this.processManager.killProcess(this.gameId, force);
	}
}

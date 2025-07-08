import { EventEmitter as NodeEventEmitter } from "node:events";
import type { GameProcessEvents } from "../@types";

export class GameEventEmitter extends NodeEventEmitter {
	override on<K extends keyof GameProcessEvents>(
		event: K,
		listener: GameProcessEvents[K],
	): this {
		return super.on(event, listener);
	}

	override off<K extends keyof GameProcessEvents>(
		event: K,
		listener: GameProcessEvents[K],
	): this {
		return super.off(event, listener);
	}

	override emit<K extends keyof GameProcessEvents>(
		event: K,
		...args: Parameters<GameProcessEvents[K]>
	): boolean {
		return super.emit(event, ...args);
	}

	override removeAllListeners(event?: keyof GameProcessEvents): this {
		return super.removeAllListeners(event);
	}
}

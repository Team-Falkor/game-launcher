/**
 * Game-related type definitions
 */

import type {
	GameClosedEvent,
	GameErrorEvent,
	GameLaunchedEvent,
	GameOutputEvent,
	GameStatusChangeEvent,
} from "./events";

/**
 * Union type for all game event data
 */
export type GameEventData =
	| GameLaunchedEvent
	| GameClosedEvent
	| GameErrorEvent
	| GameOutputEvent
	| GameStatusChangeEvent;

/**
 * Event listener type for game events
 */
export type EventListener = (data: GameEventData) => void;

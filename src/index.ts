export * from "./@types";
export { GameEventEmitter } from "./core/EventEmitter";
export { Game } from "./core/Game";
// Default export for convenience
export { GameLauncher } from "./core/GameLauncher";
export { ProcessManager } from "./core/ProcessManager";
// Proton management
export * from "./proton";
export { getKillSignal, getPlatform } from "./utils/platform";
// Security and validation utilities
export {
	CommandSanitizer,
	PathValidator,
	SecurityValidator,
	validateExecutable,
	validateGameId,
} from "./utils/validation";

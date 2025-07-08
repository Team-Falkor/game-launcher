import {
	type ChildProcess,
	execSync,
	type SpawnOptions,
	spawn,
} from "node:child_process";
import type {
	GameProcessInfo,
	GameStatus,
	ProcessManagerInterface,
	ProcessManagerOptions,
	ProcessStartOptions,
} from "../@types";
import { getPlatform } from "../utils/platform";
import { validateExecutable } from "../utils/validation";
import type { GameEventEmitter } from "./EventEmitter";

export class ProcessManager implements ProcessManagerInterface {
	private processes = new Map<string, ChildProcess>();
	private processInfo = new Map<string, GameProcessInfo>();
	private eventEmitter: GameEventEmitter;
	private monitoringInterval?: NodeJS.Timeout | undefined;
	private options: ProcessManagerOptions;

	constructor(
		eventEmitter: GameEventEmitter,
		options: ProcessManagerOptions = {},
	) {
		this.eventEmitter = eventEmitter;
		this.options = {
			monitoringInterval: 1000,
			enableResourceMonitoring: true,
			...options,
		};

		if (this.options.enableResourceMonitoring) {
			this.startMonitoring();
		}
	}

	async startProcess(
		gameId: string,
		executable: string,
		args: string[] = [],
		options: ProcessStartOptions = {},
	): Promise<ChildProcess> {
		if (!gameId || typeof gameId !== "string") {
			throw new Error("Game ID must be a non-empty string");
		}

		if (this.processes.has(gameId)) {
			throw new Error(`Game with ID "${gameId}" is already running`);
		}

		await validateExecutable(executable);

		const cleanEnvironment: Record<string, string> = {};
		Object.entries(process.env).forEach(([key, value]) => {
			if (value !== undefined) {
				cleanEnvironment[key] = value;
			}
		});

		const filteredOptionsEnvironment: Record<string, string> = {};
		if (options.environment) {
			Object.entries(options.environment).forEach(([key, value]) => {
				if (value !== undefined) {
					filteredOptionsEnvironment[key] = value;
				}
			});
		}

		const processInfo: GameProcessInfo = {
			gameId,
			pid: 0,
			executable,
			args,
			workingDirectory: options.workingDirectory || process.cwd(),
			environment: { ...cleanEnvironment, ...filteredOptionsEnvironment },
			status: "launching",
			startTime: new Date(),
			metadata: options.metadata || {},
		};

		try {
			// FIX: Proper spawn options with correct types
			const spawnOptions: SpawnOptions = {
				cwd: processInfo.workingDirectory,
				env: processInfo.environment,
				stdio: options.captureOutput ? "pipe" : "ignore",
				detached: getPlatform() !== "win32",
				shell: getPlatform() === "win32",
			};

			const childProcess = spawn(executable, args, spawnOptions);

			// FIX: Better error handling for spawn failure
			await new Promise<void>((resolve, reject) => {
				const timeout = setTimeout(() => {
					reject(new Error("Process spawn timeout"));
				}, 5000);

				childProcess.on("error", (error: Error) => {
					clearTimeout(timeout);
					reject(error);
				});

				childProcess.on("spawn", () => {
					clearTimeout(timeout);
					resolve();
				});

				// Handle immediate exit during spawn
				childProcess.on(
					"exit",
					(code: number | null, signal: string | null) => {
						clearTimeout(timeout);
						if (code !== null && code !== 0) {
							reject(new Error(`Process exited immediately with code ${code}`));
						}
					},
				);
			});

			if (!childProcess.pid) {
				throw new Error("Failed to start process - no PID assigned");
			}

			processInfo.pid = childProcess.pid;
			processInfo.status = "running";

			this.processes.set(gameId, childProcess);
			this.processInfo.set(gameId, processInfo);

			this.setupProcessHandlers(gameId, childProcess);

			this.eventEmitter.emit("launched", {
				gameId,
				pid: childProcess.pid,
				startTime: processInfo.startTime,
				command: executable,
				args,
			});

			return childProcess;
		} catch (error) {
			this.eventEmitter.emit("error", {
				gameId,
				error: error as Error,
				phase: "launch",
			});
			throw error;
		}
	}

	async killProcess(gameId: string, force = false): Promise<boolean> {
		const process = this.processes.get(gameId);
		const info = this.processInfo.get(gameId);

		if (!process || !info) {
			return false;
		}

		try {
			info.status = "closing";
			this.updateProcessStatus(gameId, "closing");

			if (getPlatform() === "win32") {
				if (force) {
					process.kill("SIGKILL");
				} else {
					process.kill("SIGTERM");
				}
			} else {
				const signal = force ? "SIGKILL" : "SIGTERM";
				if (process.pid) {
					try {
						process.kill(signal);
					} catch (_error) {
						process.kill("SIGKILL");
					}
				}
			}

			return true;
		} catch (error) {
			this.eventEmitter.emit("error", {
				gameId,
				pid: info.pid,
				error: error as Error,
				phase: "cleanup",
			});
			return false;
		}
	}

	getProcess(gameId: string): ChildProcess | null {
		return this.processes.get(gameId) || null;
	}

	getProcessInfo(gameId: string): GameProcessInfo | null {
		return this.processInfo.get(gameId) || null;
	}

	getAllProcesses(): Map<string, GameProcessInfo> {
		return new Map(this.processInfo);
	}

	isProcessRunning(gameId: string): boolean {
		const info = this.processInfo.get(gameId);
		return info?.status === "running" || info?.status === "detached";
	}

	private setupProcessHandlers(gameId: string, process: ChildProcess): void {
		let hasExited = false;
		const startTime = Date.now();
		const MIN_RUNTIME_MS = 500; // Minimum time before considering exit as legitimate

		process.on("exit", (code, signal) => {
			if (!hasExited) {
				hasExited = true;
				const runtime = Date.now() - startTime;

				// If process exits too quickly, it might be a GUI app that spawned successfully
				// but detached immediately (common with Windows GUI apps)
				if (runtime < MIN_RUNTIME_MS && code === 0 && !signal) {
					console.log(
						`Process ${gameId} exited quickly (${runtime}ms) with code 0 - likely a GUI app that detached`,
					);

					// Mark as detached but keep monitoring for actual closure
					const info = this.processInfo.get(gameId);
					if (info) {
						info.status = "detached";
						this.updateProcessStatus(gameId, "detached");
					}

					// Start enhanced monitoring for this detached process
					this.startDetachedProcessMonitoring(gameId, process.pid!);
					return;
				}

				// For all other cases (errors, signals, or sufficient runtime), handle normally
				this.handleProcessExit(gameId, code, signal);
			}
		});

		process.on("error", (error) => {
			this.eventEmitter.emit("error", {
				gameId,
				...(process.pid !== undefined && { pid: process.pid }),
				error,
				phase: "runtime",
			});
		});

		// FIX: Better output handling
		if (process.stdout) {
			process.stdout.on("data", (data) => {
				if (process.pid !== undefined) {
					this.eventEmitter.emit("output", {
						gameId,
						pid: process.pid,
						type: "stdout",
						data: data.toString(),
						timestamp: new Date(),
					});
				}
			});
		}

		if (process.stderr) {
			process.stderr.on("data", (data) => {
				if (process.pid !== undefined) {
					this.eventEmitter.emit("output", {
						gameId,
						pid: process.pid,
						type: "stderr",
						data: data.toString(),
						timestamp: new Date(),
					});
				}
			});
		}
	}

	private handleProcessExit(
		gameId: string,
		exitCode: number | null,
		signal: string | null,
	): void {
		const info = this.processInfo.get(gameId);
		if (!info) return;

		this.updateProcessStatus(gameId, "closed");

		info.status = "closed";
		info.endTime = new Date();
		info.exitCode = exitCode;
		info.signal = signal;

		this.eventEmitter.emit("closed", {
			gameId,
			pid: info.pid,
			exitCode,
			signal,
			startTime: info.startTime,
			endTime: info.endTime,
			duration: info.endTime.getTime() - info.startTime.getTime(),
		});

		this.processes.delete(gameId);
	}

	private updateProcessStatus(gameId: string, status: GameStatus): void {
		const info = this.processInfo.get(gameId);
		if (!info) return;

		const previousStatus = info.status;
		info.status = status;

		this.eventEmitter.emit("statusChange", {
			gameId,
			pid: info.pid,
			previousStatus,
			currentStatus: status,
			timestamp: new Date(),
		});
	}

	private startDetachedProcessMonitoring(gameId: string, pid: number): void {
		// Enhanced monitoring specifically for detached GUI processes
		const info = this.processInfo.get(gameId);
		if (!info) return;

		// Extract executable name from the executable path for process monitoring
		const executablePath = info.executable;
		const executableName = executablePath.split(/[\\/]/).pop() || "";

		const checkInterval = setInterval(() => {
			const currentInfo = this.processInfo.get(gameId);
			if (!currentInfo || currentInfo.status !== "detached") {
				clearInterval(checkInterval);
				return;
			}

			try {
				if (getPlatform() === "win32") {
					try {
						// Check if any process with the same executable name is running
						const result = execSync(
							`tasklist /FI "IMAGENAME eq ${executableName}" /NH`,
							{
								stdio: "pipe",
								timeout: 1000,
								encoding: "utf8",
							},
						);

						// If tasklist returns "INFO: No tasks are running" or empty, process is dead
						if (
							result.includes("INFO: No tasks are running") ||
							result.trim() === ""
						) {
							clearInterval(checkInterval);
							this.handleProcessExit(gameId, 0, null);
						}
						// If we find the process, continue monitoring
					} catch (error) {
						// If tasklist fails, assume process is dead
						clearInterval(checkInterval);
						this.handleProcessExit(gameId, 0, null);
					}
				} else {
					// On Unix-like systems, use kill(0) to check if process exists
					try {
						process.kill(pid, 0);
						// Process exists, continue monitoring
					} catch (error) {
						// Process doesn't exist
						clearInterval(checkInterval);
						this.handleProcessExit(gameId, 0, null);
					}
				}
			} catch (error) {
				console.warn(`Error monitoring detached process ${gameId}:`, error);
			}
		}, 2000); // Check every 2 seconds for detached processes
	}

	private startMonitoring(): void {
		if (this.monitoringInterval) return;

		this.monitoringInterval = setInterval(() => {
			this.processInfo.forEach((info, gameId) => {
				if (info.status === "running") {
					const process = this.processes.get(gameId);
					if (process) {
						try {
							if (getPlatform() === "win32") {
								// On Windows, for GUI apps that may have detached, we need a more robust check
								if (process.pid) {
									try {
										// Use tasklist to check if process actually exists
										try {
											execSync(`tasklist /FI "PID eq ${process.pid}" /NH`, {
												stdio: "pipe",
												timeout: 1000,
											});
											// If we get here, process exists
										} catch (error) {
											// Process doesn't exist or tasklist failed
											this.handleProcessExit(gameId, null, null);
										}
									} catch (error) {
										// Fallback to kill(0) method
										try {
											process.kill(0);
										} catch (killError) {
											this.handleProcessExit(gameId, null, null);
										}
									}
								}
							} else {
								// On Unix-like systems, use the killed property and kill(0)
								if (process.killed) {
									this.handleProcessExit(gameId, null, null);
								} else if (process.pid) {
									try {
										process.kill(0);
									} catch (error) {
										this.handleProcessExit(gameId, null, null);
									}
								}
							}
						} catch (error) {
							// Error checking process status
							console.warn(
								`Error checking process status for ${gameId}:`,
								error,
							);
						}
					}
				}
			});
		}, this.options.monitoringInterval);
	}

	destroy(): void {
		if (this.monitoringInterval) {
			clearInterval(this.monitoringInterval);
			this.monitoringInterval = undefined;
		}

		const killPromises = Array.from(this.processes.keys()).map((gameId) =>
			this.killProcess(gameId, true),
		);

		Promise.all(killPromises).catch(console.error);

		this.processes.clear();
		this.processInfo.clear();
	}
}

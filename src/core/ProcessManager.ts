import {
	type ChildProcess,
	execSync,
	type SpawnOptions,
	spawn,
} from "node:child_process";
import * as sudo from "@expo/sudo-prompt";
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
	private detachedMonitoringIntervals = new Map<string, NodeJS.Timeout>();
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
			metadata: { 
				...options.metadata || {},
				...(options.runAsAdmin && { runAsAdmin: true })
			},
		};

		try {
			let childProcess: ChildProcess;

			if (options.runAsAdmin) {
				// Use sudo-prompt for admin execution
				childProcess = await this.spawnWithAdmin(
					executable,
					args,
					processInfo.workingDirectory,
					processInfo.environment,
					options.captureOutput,
				);
			} else {
				// FIX: Proper spawn options with correct types
				const spawnOptions: SpawnOptions = {
					cwd: processInfo.workingDirectory,
					env: processInfo.environment,
					stdio: options.captureOutput ? "pipe" : "ignore",
					detached: getPlatform() !== "win32",
					shell: getPlatform() === "win32",
				};

				childProcess = spawn(executable, args, spawnOptions);
			}

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
					(code: number | null, _signal: string | null) => {
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

			// For admin processes, check if we found a real PID and update metadata
			if (options.runAsAdmin && (childProcess as any).actualPid) {
				processInfo.metadata = {
					...processInfo.metadata,
					hasRealPid: true
				};
			}

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

			// Clear detached monitoring if exists
			this.clearDetachedMonitoring(gameId);

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

	private async spawnWithAdmin(
		executable: string,
		args: string[],
		workingDirectory: string,
		environment: Record<string, string>,
		captureOutput?: boolean,
	): Promise<ChildProcess> {
		return new Promise((resolve, reject) => {
			// Build the command string with improved quoting
			const quotedExecutable = this.quoteArg(executable);
			const quotedArgs = args.map((arg) => this.quoteArg(arg));
			const command = [quotedExecutable, ...quotedArgs].join(" ");

			// Build environment variables command prefix
			let envCommand = "";
			const platform = getPlatform();
			if (platform === "win32") {
				// Windows: set environment variables before command
				const envVars = Object.entries(environment)
					.filter(
						([key, value]) => key !== "PATH" && value !== process.env[key],
					)
					.map(([key, value]) => `set "${key}=${value}" &&`)
					.join(" ");
				envCommand = envVars ? `${envVars} ` : "";
			} else {
				// Unix-like: export environment variables
				const envVars = Object.entries(environment)
					.filter(
						([key, value]) => key !== "PATH" && value !== process.env[key],
					)
					.map(([key, value]) => `export ${key}="${value}"`)
					.join("; ");
				envCommand = envVars ? `${envVars}; ` : "";
			}

			// Change directory command
			const cdCommand =
				platform === "win32"
					? `cd /d "${workingDirectory}" && `
					: `cd "${workingDirectory}" && `;

			const fullCommand = `${cdCommand}${envCommand}${command}`;

			// Sanitize environment variables for sudo-prompt
			// Remove variables with invalid characters (like parentheses) that cause sudo-prompt to fail
			const sanitizedEnv = Object.fromEntries(
				Object.entries(environment).filter(([key]) => {
					// Filter out environment variable names with invalid characters
					return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key);
				})
			);

			const sudoOptions = {
				name: "Game Launcher",
				env: sanitizedEnv,
			};

			// Record the time before launching to help find the actual PID
			const launchTime = Date.now();
			const executableName = executable.split(/[\\/]/).pop() || "";

			sudo.exec(fullCommand, sudoOptions, async (error, stdout, stderr) => {
				if (error) {
					reject(error);
					return;
				}

				// Try to find the actual PID of the elevated process
			const actualPid = await this.findElevatedProcessPid(
				executableName,
				launchTime,
			);

			// Create a mock ChildProcess-like object for admin processes
			// Since sudo-prompt doesn't return a ChildProcess, we need to simulate one
			const stdoutStr = stdout
				? typeof stdout === "string"
					? stdout
					: stdout.toString()
				: "";
			const stderrStr = stderr
				? typeof stderr === "string"
					? stderr
					: stderr.toString()
				: "";
			const mockProcess = this.createMockChildProcess(
				stdoutStr,
				stderrStr,
				captureOutput,
				actualPid,
			);
			

			
			resolve(mockProcess);
			});
		});
	}

	private createMockChildProcess(
		_stdout: string,
		_stderr: string,
		captureOutput?: boolean,
		actualPid?: number,
	): ChildProcess {
		// Create a minimal mock ChildProcess for admin processes
		// This is necessary because sudo-prompt doesn't return a real ChildProcess
		const pid = actualPid || Math.floor(Math.random() * 100000) + 1000;
		
		// Create a proper EventEmitter-like object
		const eventListeners = new Map<string, Function[]>();
		
		const addListener = (event: string, listener: Function) => {
			if (!eventListeners.has(event)) {
				eventListeners.set(event, []);
			}
			eventListeners.get(event)!.push(listener);
		};
		
		const emit = (event: string, ...args: any[]) => {
			const listeners = eventListeners.get(event);
			if (listeners) {
				listeners.forEach(listener => {
					try {
						listener(...args);
					} catch (error) {
						console.error(`Error in mock process event listener for ${event}:`, error);
					}
				});
				return true;
			}
			return false;
		};
		
		const mockProcess = {
			pid: pid,
			actualPid: actualPid, // Store the actual PID for metadata purposes
			kill: (signal?: string | number) => {
				// For admin processes with actual PIDs, attempt to kill the real process
				if (actualPid) {
					try {
						if (getPlatform() === "win32") {
							// Use taskkill for Windows
							const force = signal === "SIGKILL" || signal === 9;
							const cmd = force ? `taskkill /F /PID ${actualPid}` : `taskkill /PID ${actualPid}`;
							execSync(cmd, { stdio: "ignore" });
						} else {
							// Use kill for Unix-like systems
							process.kill(actualPid, (signal as NodeJS.Signals) || "SIGTERM");
						}
						return true;
					} catch {
						return false;
					}
				}
				return false; // Mock processes without actual PID can't be killed
			},
			killed: false,
			exitCode: null,
			signalCode: null,
			spawnargs: [],
			spawnfile: "",
			stdin: null,
			stdout: captureOutput ? { on: () => {}, pipe: () => {} } : null,
			stderr: captureOutput ? { on: () => {}, pipe: () => {} } : null,
			stdio: [null, null, null],
			connected: false,
			on: addListener,
			once: (event: string, listener: Function) => {
				const onceWrapper = (...args: any[]) => {
					listener(...args);
					// Remove the listener after it's called once
					const listeners = eventListeners.get(event);
					if (listeners) {
						const index = listeners.indexOf(onceWrapper);
						if (index > -1) {
							listeners.splice(index, 1);
						}
					}
				};
				addListener(event, onceWrapper);
			},
			off: () => {},
			removeListener: () => {},
			removeAllListeners: () => {},
			setMaxListeners: () => {},
			getMaxListeners: () => 0,
			listeners: () => [],
			rawListeners: () => [],
			emit: emit,
			listenerCount: () => 0,
			prependListener: () => {},
			prependOnceListener: () => {},
			eventNames: () => [],
			disconnect: () => {},
			unref: () => {},
			ref: () => {},
			send: () => false,
		} as unknown as ChildProcess;

		// Simulate immediate spawn for admin processes
		// Use setImmediate to ensure the event is emitted in the next tick
		setImmediate(() => {
			emit("spawn");
			// Admin processes are considered "detached" and running independently
			// We don't emit exit events as they run with elevated privileges
		});

		return mockProcess;
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
					if (process.pid) {
						this.startDetachedProcessMonitoring(gameId, process.pid);
					}
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

	private async findElevatedProcessPid(
		executableName: string,
		launchTime: number,
	): Promise<number | undefined> {
		if (!executableName || typeof executableName !== "string") {
			return undefined;
		}

		try {
			const platform = getPlatform();
			const searchWindow = 5000; // 5 seconds window to find the process

			if (platform === "win32") {
				// Use WMIC to get detailed process information including creation time
				try {
					const result = execSync(
						`wmic process where "name='${executableName}'" get ProcessId,CreationDate /format:csv`,
						{
							stdio: "pipe",
							timeout: 3000,
							encoding: "utf8",
						},
					);

					const lines = result.split("\n").filter(line => line.trim() && !line.includes("Node"));
					
					for (const line of lines) {
						const parts = line.split(",");
						if (parts.length >= 3) {
							const creationDate = parts[1]?.trim();
							const processId = parts[2]?.trim();
							
							if (creationDate && processId && !isNaN(Number(processId))) {
								// Parse Windows WMI datetime format (YYYYMMDDHHMMSS.ffffff+TZO)
								const dateMatch = creationDate.match(/^(\d{14})/);
								if (dateMatch && dateMatch[1]) {
									try {
										const dateStr = dateMatch[1];
										const year = parseInt(dateStr.substr(0, 4));
										const month = parseInt(dateStr.substr(4, 2)) - 1;
										const day = parseInt(dateStr.substr(6, 2));
										const hour = parseInt(dateStr.substr(8, 2));
										const minute = parseInt(dateStr.substr(10, 2));
										const second = parseInt(dateStr.substr(12, 2));
										
										// Validate parsed values
										if (year > 1970 && month >= 0 && month < 12 && day >= 1 && day <= 31 &&
											hour >= 0 && hour < 24 && minute >= 0 && minute < 60 && second >= 0 && second < 60) {
											
											const processTime = new Date(year, month, day, hour, minute, second).getTime();
											
											// Check if process was created within our search window
											if (Math.abs(processTime - launchTime) <= searchWindow) {
												const pid = Number(processId);
												if (pid > 0) {
													return pid;
												}
											}
										}
									} catch (parseError) {
										// Skip invalid date entries
										continue;
									}
								}
							}
						}
					}
				} catch {
					// Fallback: just find any process with the same name
					try {
						const result = execSync(
							`tasklist /FI "IMAGENAME eq ${executableName}" /FO CSV /NH`,
							{
								stdio: "pipe",
								timeout: 2000,
								encoding: "utf8",
							},
						);

						const lines = result.split("\n").filter(line => line.trim());
						if (lines.length > 0) {
							const firstLine = lines[0];
							if (firstLine) {
								const pidMatch = firstLine.match(/"([^"]+)","(\d+)"/); 
								if (pidMatch && pidMatch[2]) {
									const pid = Number(pidMatch[2]);
									if (pid > 0) {
										return pid;
									}
								}
							}
						}
					} catch {
						// If all else fails, return undefined
					}
				}
			} else {
				// Unix-like systems: use ps to find processes
				try {
					const result = execSync(
						`ps -eo pid,lstart,comm | grep "${executableName}"`,
						{
							stdio: "pipe",
							timeout: 3000,
							encoding: "utf8",
						},
					);

					const lines = result.split("\n").filter(line => line.trim());
					for (const line of lines) {
						const parts = line.trim().split(/\s+/);
						if (parts.length >= 6) {
							const pid = parts[0];
							// For Unix systems, we'll just return the first matching process
							// as getting exact creation time is more complex
							if (!isNaN(Number(pid))) {
								const pidNum = Number(pid);
								if (pidNum > 0) {
									return pidNum;
								}
							}
						}
					}
				} catch {
					// Fallback for Unix systems
					try {
						const result = execSync(`pgrep "${executableName}"`, {
							stdio: "pipe",
							timeout: 2000,
							encoding: "utf8",
						});
						const pid = result.trim().split("\n")[0];
						if (pid && !isNaN(Number(pid))) {
							const pidNum = Number(pid);
							if (pidNum > 0) {
								return pidNum;
							}
						}
					} catch {
						// Final fallback failed
					}
				}
			}
		} catch (error) {
			console.warn(`Failed to find elevated process PID for ${executableName}:`, error);
		}

		return undefined;
	}

	private startDetachedProcessMonitoring(gameId: string, pid: number): void {
		// Enhanced monitoring specifically for detached GUI processes
		const info = this.processInfo.get(gameId);
		if (!info) return;

		// Clear any existing monitoring for this gameId to prevent duplicates
		this.clearDetachedMonitoring(gameId);

		// Extract executable name from the executable path for process monitoring
		const executablePath = info.executable;
		const executableName = executablePath.split(/[\\/]/).pop() || "";
		const platform = getPlatform();
		const isWindows = platform === "win32";

		const checkInterval = setInterval(() => {
			const currentInfo = this.processInfo.get(gameId);
			if (!currentInfo || currentInfo.status !== "detached") {
				this.clearDetachedMonitoring(gameId);
				return;
			}

			try {
				if (isWindows) {
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
							this.clearDetachedMonitoring(gameId);
							this.handleProcessExit(gameId, 0, null);
						}
						// If we find the process, continue monitoring
					} catch {
						// If tasklist fails, assume process is dead
						this.clearDetachedMonitoring(gameId);
						this.handleProcessExit(gameId, 0, null);
					}
				} else {
					// On Unix-like systems, use kill(0) to check if process exists
					try {
						process.kill(pid, 0);
						// Process exists, continue monitoring
					} catch {
						// Process doesn't exist
						this.clearDetachedMonitoring(gameId);
						this.handleProcessExit(gameId, 0, null);
					}
				}
			} catch (error) {
				console.warn(`Error monitoring detached process ${gameId}:`, error);
			}
		}, 2000); // Check every 2 seconds for detached processes

		// Store the interval for proper cleanup
		this.detachedMonitoringIntervals.set(gameId, checkInterval);
	}

	private clearDetachedMonitoring(gameId: string): void {
		const interval = this.detachedMonitoringIntervals.get(gameId);
		if (interval) {
			clearInterval(interval);
			this.detachedMonitoringIntervals.delete(gameId);
		}
	}

	private quoteArg(arg: string): string {
		if (!arg) return '""'; // Handle empty strings
		
		if (getPlatform() === "win32") {
			// Windows-style quoting - only quote if necessary
			if (/[\s"<>|&^]/.test(arg)) {
				return `"${arg.replace(/"/g, '\\"')}"`;
			}
			return arg;
		} else {
			// Unix-style quoting - only quote if necessary
			if (/[\s'"\\$`!*?\[\]{}();|&<>]/.test(arg)) {
				return `'${arg.replace(/'/g, "'\\''")}' `;
			}
			return arg;
		}
	}

	private startMonitoring(): void {
		if (this.monitoringInterval) return;

		// Cache platform check to avoid repeated calls
		const platform = getPlatform();
		const isWindows = platform === "win32";

		this.monitoringInterval = setInterval(() => {
			// Batch process checks for better performance
			const runningProcesses = new Map<string, { info: GameProcessInfo; process: ChildProcess }>();
			
			// Collect all running processes first
			this.processInfo.forEach((info, gameId) => {
				if (info.status === "running") {
					const process = this.processes.get(gameId);
					if (process) {
						runningProcesses.set(gameId, { info, process });
					}
				}
			});

			if (runningProcesses.size === 0) return;

			// Batch check processes based on platform
			if (isWindows) {
				this.batchCheckWindowsProcesses(runningProcesses);
			} else {
				this.batchCheckUnixProcesses(runningProcesses);
			}
		}, this.options.monitoringInterval);
	}

	private batchCheckWindowsProcesses(processes: Map<string, { info: GameProcessInfo; process: ChildProcess }>): void {
		// Group processes by type for efficient batch checking
		const regularPids: number[] = [];
		const adminProcesses = new Map<string, { info: GameProcessInfo; process: ChildProcess }>();
		const pidToGameId = new Map<number, string>();

		processes.forEach(({ info, process }, gameId) => {
			const isAdminProcess = info.metadata?.runAsAdmin === true;

			if (isAdminProcess) {
				adminProcesses.set(gameId, { info, process });
			} else if (process.pid) {
				regularPids.push(process.pid);
				pidToGameId.set(process.pid, gameId);
			}
		});

		// Batch check regular processes
		if (regularPids.length > 0) {
			try {
				const pidList = regularPids.join(',');
				const result = execSync(`tasklist /FI "PID eq ${pidList}" /FO CSV /NH`, {
					stdio: "pipe",
					timeout: 2000,
					encoding: "utf8",
				});

				const foundPids = new Set<number>();
				const lines = result.split('\n').filter(line => line.trim());
				for (const line of lines) {
					const match = line.match(/"[^"]*","(\d+)"/); 
					if (match && match[1]) {
						foundPids.add(Number(match[1]));
					}
				}

				// Check which processes are missing
				regularPids.forEach(pid => {
					if (!foundPids.has(pid)) {
						const gameId = pidToGameId.get(pid);
						if (gameId) {
							this.handleProcessExit(gameId, null, null);
						}
					}
				});
			} catch (error) {
				// Fallback to individual checks
				regularPids.forEach(pid => {
					const gameId = pidToGameId.get(pid);
					if (gameId) {
						try {
							const process = processes.get(gameId)?.process;
							if (process) {
								process.kill(0);
							}
						} catch {
							this.handleProcessExit(gameId, null, null);
						}
					}
				});
			}
		}

		// Check admin processes individually (they require special handling)
		adminProcesses.forEach(({ info, process }, gameId) => {
			const hasRealPid = info.metadata?.hasRealPid === true;
			try {
				if (hasRealPid && process.pid) {
					const result = execSync(`tasklist /FI "PID eq ${process.pid}" /NH`, {
						stdio: "pipe",
						timeout: 1000,
						encoding: "utf8",
					});
					if (result.includes("INFO: No tasks are running") || result.trim() === "") {
						this.handleProcessExit(gameId, 0, null);
					}
				} else {
					// Admin process with mock PID - check by executable name
					const executableName = info.executable.split(/[\\/]/).pop() || "";
					const result = execSync(`tasklist /FI "IMAGENAME eq ${executableName}" /NH`, {
						stdio: "pipe",
						timeout: 1000,
						encoding: "utf8",
					});
					if (result.includes("INFO: No tasks are running") || result.trim() === "") {
						this.handleProcessExit(gameId, 0, null);
					}
				}
			} catch {
				this.handleProcessExit(gameId, 0, null);
			}
		});
	}

	private batchCheckUnixProcesses(processes: Map<string, { info: GameProcessInfo; process: ChildProcess }>): void {
		processes.forEach(({ info, process }, gameId) => {
			try {
				const isAdminProcess = info.metadata?.runAsAdmin === true;
				const hasRealPid = isAdminProcess && info.metadata?.hasRealPid === true;

				if (process.killed) {
					this.handleProcessExit(gameId, null, null);
				} else if (process.pid && (!isAdminProcess || hasRealPid)) {
					try {
						process.kill(0);
					} catch {
						this.handleProcessExit(gameId, null, null);
					}
				}
			} catch (error) {
				console.warn(`Error checking Unix process ${gameId}:`, error);
			}
		});
	}

	destroy(): void {
		if (this.monitoringInterval) {
			clearInterval(this.monitoringInterval);
			this.monitoringInterval = undefined;
		}

		// Clear all detached monitoring intervals
		for (const [gameId] of this.detachedMonitoringIntervals) {
			this.clearDetachedMonitoring(gameId);
		}

		const killPromises = Array.from(this.processes.keys()).map((gameId) =>
			this.killProcess(gameId, true),
		);

		Promise.all(killPromises).catch(console.error);

		this.processes.clear();
		this.processInfo.clear();
	}
}

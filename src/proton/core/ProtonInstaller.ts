import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { EventEmitter } from "node:events";
import { createWriteStream, promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { extract, list } from "tar";
import type {
	ProtonInstallOptions,
	ProtonInstallResult,
	ProtonRemoveOptions,
	ProtonRemoveResult,
	ProtonVersionInfo,
} from "@/@types";

/**
 * Extraction progress event data
 */
export interface ExtractionProgressEvent {
	variant: string;
	version: string;
	entriesProcessed: number;
	totalEntries: number;
	percentage: number;
	currentFile: string;
}

/**
 * Download progress event data
 */
export interface DownloadProgressEvent {
	variant: string;
	version: string;
	bytesDownloaded: number;
	totalBytes: number;
	percentage: number;
	speed: number; // bytes per second
	estimatedTimeRemaining: number; // seconds
}

/**
 * Download status event data
 */
export interface DownloadStatusEvent {
	variant: string;
	version: string;
	status:
		| "started"
		| "downloading"
		| "retrying"
		| "validating"
		| "extracting"
		| "building"
		| "completed"
		| "failed";
	message?: string;
	error?: string;
}

/**
 * Build progress event data
 */
export interface BuildProgressEvent {
	variant: string;
	version: string;
	step: "configure" | "make" | "install";
	message: string;
	percentage?: number;
}

/**
 * Handles installation and removal of Proton versions
 * Note: Proton installation is only supported on Linux systems
 *
 * Events:
 * - 'download-progress': Emitted during download with progress information
 * - 'download-status': Emitted when download status changes
 * - 'extraction-progress': Emitted during archive extraction with progress information
 * - 'build-progress': Emitted during build steps
 * - 'install-progress': Emitted during installation steps
 * - 'install-complete': Emitted when installation completes
 * - 'install-error': Emitted when installation fails
 */
export class ProtonInstaller extends EventEmitter {
	private readonly isLinux: boolean;
	private readonly compatibilityToolsPath: string;
	private readonly userAgent = "ProtonInstaller/1.0";

	constructor() {
		super();
		this.isLinux = os.platform() === "linux";
		this.compatibilityToolsPath = this.getCompatibilityToolsPath();
	}

	/**
	 * Gets the Steam compatibility tools directory path
	 */
	private getCompatibilityToolsPath(): string {
		const homeDir = os.homedir();
		// Prefer the local Steam directory
		return path.join(
			homeDir,
			".local",
			"share",
			"Steam",
			"compatibilitytools.d",
		);
	}

	/**
	 * Installs a Proton version
	 */
	async installProtonVersion(
		options: ProtonInstallOptions,
	): Promise<ProtonInstallResult> {
		if (!this.isLinux) {
			return {
				success: false,
				version: options.version,
				variant: options.variant,
				installPath: "",
				error: "Proton installation is only supported on Linux systems",
			};
		}

		try {
			// Determine install path
			const installPath =
				options.installPath ||
				path.join(this.compatibilityToolsPath, this.getInstallDirName(options));

			console.log("Install path:", installPath);

			// Check if already installed
			if (!options.force && (await this.pathExists(installPath))) {
				return {
					success: false,
					version: options.version,
					variant: options.variant,
					installPath,
					error: `Proton ${options.variant} ${options.version} is already installed at ${installPath}. Use force=true to overwrite.`,
				};
			}

			// Get version info to find download URL
			const versionInfo = await this.getVersionInfo(options);
			if (!versionInfo?.downloadUrl) {
				return {
					success: false,
					version: options.version,
					variant: options.variant,
					installPath,
					error: `Download URL not found for ${options.variant} ${options.version}`,
				};
			}

			console.log(`Installing Proton ${options.variant} ${options.version}...`);

			// Create compatibility tools directory if it doesn't exist
			await fs.mkdir(this.compatibilityToolsPath, { recursive: true });

			// Download and extract
			await this.downloadAndExtract(
				versionInfo.downloadUrl,
				installPath,
				options,
			);

			console.log(
				`Successfully installed Proton ${options.variant} ${options.version} to ${installPath}`,
			);

			return {
				success: true,
				version: options.version,
				variant: options.variant,
				installPath,
			};
		} catch (error) {
			console.error("Error installing Proton:", error);
			return {
				success: false,
				version: options.version,
				variant: options.variant,
				installPath: options.installPath || "",
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	}

	/**
	 * Removes a Proton version
	 */
	async removeProtonVersion(
		options: ProtonRemoveOptions,
	): Promise<ProtonRemoveResult> {
		if (!this.isLinux) {
			return {
				success: false,
				version: options.version,
				variant: options.variant,
				error: "Proton removal is only supported on Linux systems",
			};
		}

		try {
			// Find the installation
			const installPath = await this.findInstallation(options);
			if (!installPath) {
				return {
					success: false,
					version: options.version,
					variant: options.variant,
					error: `Proton ${options.variant} ${options.version} is not installed`,
				};
			}

			console.log(
				`Removing Proton ${options.variant} ${options.version} from ${installPath}...`,
			);

			// Remove the directory
			await fs.rm(installPath, { recursive: true, force: true });

			console.log(
				`Successfully removed Proton ${options.variant} ${options.version}`,
			);

			return {
				success: true,
				version: options.version,
				variant: options.variant,
			};
		} catch (error) {
			console.error("Error removing Proton:", error);
			return {
				success: false,
				version: options.version,
				variant: options.variant,
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	}

	/**
	 * Downloads and extracts a Proton archive
	 */
	private async downloadAndExtract(
		downloadUrl: string,
		installPath: string,
		options: ProtonInstallOptions,
	): Promise<void> {
		const tempDir = path.join(os.tmpdir(), `proton-install-${Date.now()}`);
		const archivePath = path.join(tempDir, "proton.tar.gz");

		try {
			// Create temp directory
			await fs.mkdir(tempDir, { recursive: true });

			// Download the archive with retry logic
			console.log("Downloading Proton archive...");
			await this.downloadWithRetry(
				downloadUrl,
				archivePath,
				options.variant,
				options.version,
				3, // max retries
			);

			// Extract the archive
			console.log("Extracting Proton archive...");
			this.emit("download-status", {
				variant: options.variant,
				version: options.version,
				status: "extracting",
				message: "Extracting archive...",
			} as DownloadStatusEvent);

			await this.extractArchive(
				archivePath,
				installPath,
				options.variant,
				options.version,
			);

			// Check if this is source code that needs building
			const needsBuild = await this.detectSourceCode(installPath);
			if (needsBuild && options.buildOptions?.enableBuild !== false) {
				console.log("Source code detected, starting build process...");
				await this.buildFromSource(installPath, options);
			}

			// Emit completion event
			this.emit("download-status", {
				variant: options.variant,
				version: options.version,
				status: "completed",
				message: `Successfully installed to ${installPath}`,
			} as DownloadStatusEvent);

			this.emit("install-complete", {
				variant: options.variant,
				version: options.version,
				installPath: installPath,
			});
		} catch (error) {
			// Emit error event
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			this.emit("download-status", {
				variant: options.variant,
				version: options.version,
				status: "failed",
				error: errorMessage,
			} as DownloadStatusEvent);

			this.emit("install-error", {
				variant: options.variant,
				version: options.version,
				error: errorMessage,
			});

			throw error;
		} finally {
			// Clean up temp directory
			try {
				await fs.rm(tempDir, { recursive: true, force: true });
			} catch {
				// Ignore cleanup errors
			}
		}
	}

	/**
	 * Downloads a file with retry logic and exponential backoff
	 */
	private async downloadWithRetry(
		url: string,
		outputPath: string,
		variant: string,
		version: string,
		maxRetries: number = 3,
	): Promise<void> {
		let lastError: Error | null = null;

		for (let attempt = 1; attempt <= maxRetries; attempt++) {
			try {
				if (attempt > 1) {
					// Wait with exponential backoff: 2^(attempt-1) seconds
					const delayMs = 2 ** (attempt - 1) * 1000;
					console.log(
						`Retrying download in ${delayMs / 1000} seconds... (attempt ${attempt}/${maxRetries})`,
					);
					this.emit("download-status", {
						variant,
						version,
						status: "retrying",
						message: `Retrying download in ${delayMs / 1000} seconds... (attempt ${attempt}/${maxRetries})`,
					} as DownloadStatusEvent);
					await new Promise((resolve) => setTimeout(resolve, delayMs));
				}

				await this.downloadFileWithProgress(url, outputPath, variant, version);
				return; // Success, exit retry loop
			} catch (error) {
				lastError = error instanceof Error ? error : new Error(String(error));
				console.error(`Download attempt ${attempt} failed:`, lastError.message);

				if (attempt === maxRetries) {
					// Final attempt failed
					throw new Error(
						`Download failed after ${maxRetries} attempts. Last error: ${lastError.message}`,
					);
				}

				// Clean up partial download before retry
				try {
					await fs.unlink(outputPath);
				} catch {
					// Ignore cleanup errors
				}
			}
		}
	}

	/**
	 * Downloads a file with progress tracking
	 */
	private async downloadFileWithProgress(
		url: string,
		outputPath: string,
		variant: string,
		version: string,
	): Promise<void> {
		let downloadedBytes = 0;
		let totalBytes = 0;
		const startTime = Date.now();
		let lastProgressTime = startTime;
		let lastDownloadedBytes = 0;

		// Emit download started event
		this.emit("download-status", {
			variant,
			version,
			status: "started",
			message: `Starting download from ${url}`,
		} as DownloadStatusEvent);

		const response = await fetch(url, {
			headers: {
				"User-Agent": this.userAgent,
			},
		});

		if (!response.ok) {
			const error = `Download failed: ${response.status} ${response.statusText}`;
			this.emit("download-status", {
				variant,
				version,
				status: "failed",
				error,
			} as DownloadStatusEvent);
			throw new Error(error);
		}

		if (!response.body) {
			throw new Error("No response body");
		}

		// Get total file size
		totalBytes = parseInt(response.headers.get("content-length") || "0", 10);

		// Emit downloading status
		this.emit("download-status", {
			variant,
			version,
			status: "downloading",
			message: `Downloading ${totalBytes > 0 ? `${(totalBytes / 1024 / 1024).toFixed(1)} MB` : "file"}`,
		} as DownloadStatusEvent);

		// Create readable stream with progress tracking
		const reader = response.body.getReader();
		const fileStream = createWriteStream(outputPath);

		try {
			while (true) {
				const { done, value } = await reader.read();

				if (done) break;

				downloadedBytes += value.length;
				fileStream.write(value);

				// Emit progress every 500ms or every 1MB
				const now = Date.now();
				const timeDiff = now - lastProgressTime;
				const bytesDiff = downloadedBytes - lastDownloadedBytes;

				if (timeDiff >= 500 || bytesDiff >= 1024 * 1024) {
					const percentage =
						totalBytes > 0 ? (downloadedBytes / totalBytes) * 100 : 0;
					const speed = timeDiff > 0 ? (bytesDiff / timeDiff) * 1000 : 0;
					const estimatedTimeRemaining =
						speed > 0 && totalBytes > 0
							? (totalBytes - downloadedBytes) / speed
							: 0;

					this.emit("download-progress", {
						variant,
						version,
						bytesDownloaded: downloadedBytes,
						totalBytes,
						percentage,
						speed,
						estimatedTimeRemaining,
					} as DownloadProgressEvent);

					lastProgressTime = now;
					lastDownloadedBytes = downloadedBytes;
				}
			}

			// Validate download completion
			if (totalBytes > 0 && downloadedBytes !== totalBytes) {
				throw new Error(
					`Download incomplete: Expected ${totalBytes} bytes, but only downloaded ${downloadedBytes} bytes. Please try again.`,
				);
			}

			// Emit final progress
			if (totalBytes > 0) {
				this.emit("download-progress", {
					variant,
					version,
					bytesDownloaded: downloadedBytes,
					totalBytes,
					percentage: 100,
					speed: 0,
					estimatedTimeRemaining: 0,
				} as DownloadProgressEvent);
			}

			// Validate file integrity
			await this.validateFileIntegrity(outputPath, variant, version);

			// Emit download completed status
			this.emit("download-status", {
				variant,
				version,
				status: "completed",
				message: `Download completed: ${(downloadedBytes / 1024 / 1024).toFixed(1)} MB`,
			} as DownloadStatusEvent);
		} catch (error) {
			// Emit download failed status
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			this.emit("download-status", {
				variant,
				version,
				status: "failed",
				error: errorMessage,
			} as DownloadStatusEvent);
			throw error;
		} finally {
			fileStream.end();
			reader.releaseLock();
		}
	}

	/**
	 * Validates file integrity using SHA256 checksum
	 */
	private async validateFileIntegrity(
		filePath: string,
		variant: string,
		version: string,
	): Promise<void> {
		try {
			// Emit validation started status
			this.emit("download-status", {
				variant,
				version,
				status: "validating",
				message: "Validating file integrity...",
			} as DownloadStatusEvent);

			// Calculate SHA256 hash of the downloaded file
			const fileBuffer = await fs.readFile(filePath);
			const hash = createHash("sha256");
			hash.update(fileBuffer);
			const calculatedHash = hash.digest("hex");

			// For now, we'll just log the hash for debugging purposes
			// In the future, this could be compared against known checksums
			console.log(`File SHA256: ${calculatedHash}`);

			// Basic file validation - check if it's a valid tar.gz file
			const fileStats = await fs.stat(filePath);
			if (fileStats.size < 1024) {
				throw new Error("Downloaded file is too small to be a valid archive");
			}

			// Check file header for tar.gz signature
			const headerBuffer = await this.readFileHeader(filePath, 10);
			if (!this.isValidTarGzHeader(headerBuffer)) {
				throw new Error(
					"Downloaded file does not appear to be a valid tar.gz archive",
				);
			}

			console.log("File integrity validation passed");
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			throw new Error(`File validation failed: ${errorMessage}`);
		}
	}

	/**
	 * Reads the first few bytes of a file
	 */
	private async readFileHeader(
		filePath: string,
		bytes: number,
	): Promise<Buffer> {
		const fileHandle = await fs.open(filePath, "r");
		try {
			const buffer = Buffer.alloc(bytes);
			const { bytesRead } = await fileHandle.read(buffer, 0, bytes, 0);
			return buffer.subarray(0, bytesRead);
		} finally {
			await fileHandle.close();
		}
	}

	/**
	 * Checks if the file header indicates a valid gzip file
	 */
	private isValidTarGzHeader(header: Buffer): boolean {
		// Gzip files start with magic bytes 0x1f 0x8b
		if (header.length < 2) return false;
		return header[0] === 0x1f && header[1] === 0x8b;
	}

	/**
	 * Extracts a tar.gz archive with progress tracking
	 */
	private async extractArchive(
		archivePath: string,
		installPath: string,
		variant?: string,
		version?: string,
	): Promise<void> {
		try {
			// Validate archive file exists and is readable
			const archiveStats = await fs.stat(archivePath);
			if (archiveStats.size === 0) {
				throw new Error("Archive file is empty or corrupted");
			}

			// Create parent directory
			await fs.mkdir(path.dirname(installPath), { recursive: true });

			// First, count total entries in the archive for progress tracking
			let totalEntries = 0;
			try {
				await list({
					file: archivePath,
					onReadEntry: () => {
						totalEntries++;
					},
				});
			} catch (error) {
				throw new Error(
					`Failed to read archive contents: ${error instanceof Error ? error.message : String(error)}. The archive may be corrupted.`,
				);
			}

			if (totalEntries === 0) {
				throw new Error("Archive appears to be empty or corrupted");
			}

			// Now extract with progress tracking
			let entriesProcessed = 0;
			try {
				await extract({
					file: archivePath,
					cwd: path.dirname(installPath),
					strip: 1, // Remove the top-level directory from the archive
					onReadEntry: (entry) => {
						entriesProcessed++;
						const percentage =
							totalEntries > 0
								? Math.round((entriesProcessed / totalEntries) * 100)
								: 0;

						// Emit extraction progress event
						if (variant && version) {
							this.emit("extraction-progress", {
								variant,
								version,
								entriesProcessed,
								totalEntries,
								percentage,
								currentFile: entry.path || "unknown",
							} as ExtractionProgressEvent);
						}
					},
				});
			} catch (error) {
				// Handle specific zlib errors
				const errorMessage =
					error instanceof Error ? error.message : String(error);
				if (
					errorMessage.includes("unexpected end of file") ||
					errorMessage.includes("invalid")
				) {
					throw new Error(
						`Archive extraction failed: The downloaded file appears to be corrupted or incomplete. Please try downloading again. Error: ${errorMessage}`,
					);
				}
				throw new Error(`Archive extraction failed: ${errorMessage}`);
			}
		} catch (error) {
			if (error instanceof Error) {
				throw error;
			}
			throw new Error(`Extraction failed: ${String(error)}`);
		}

		// Rename extracted directory to final name if needed
		const extractedName = path.basename(installPath);
		const parentDir = path.dirname(installPath);
		const entries = await fs.readdir(parentDir);

		// Find the extracted directory (should be the only new one)
		for (const entry of entries) {
			const entryPath = path.join(parentDir, entry);
			const stats = await fs.stat(entryPath);

			if (stats.isDirectory() && entry !== extractedName) {
				// This might be the extracted directory with a different name
				const protonExe = path.join(entryPath, "proton");
				if (await this.pathExists(protonExe)) {
					// Rename to the expected name
					await fs.rename(entryPath, installPath);
					break;
				}
			}
		}
	}

	/**
	 * Gets version information for installation
	 */
	private async getVersionInfo(
		options: ProtonInstallOptions,
	): Promise<ProtonVersionInfo | null> {
		// This would typically fetch from ProtonVersionFetcher
		// For now, we'll construct GitHub URLs based on known patterns
		const downloadUrl = this.constructDownloadUrl(options);

		if (!downloadUrl) {
			return null;
		}

		return {
			version: options.version,
			installed: false,
			downloadUrl,
		};
	}

	/**
	 * Constructs download URL based on variant and version
	 */
	private constructDownloadUrl(options: ProtonInstallOptions): string | null {
		const { variant, version } = options;

		switch (variant) {
			case "proton-ge":
				return `https://github.com/GloriousEggroll/proton-ge-custom/releases/download/${version}/${version}.tar.gz`;
			case "wine-ge":
				return `https://github.com/GloriousEggroll/wine-ge-custom/releases/download/${version}/${version}.tar.gz`;
			case "proton-stable":
			case "proton-experimental":
				// Valve Proton releases have different naming patterns
				return `https://github.com/ValveSoftware/Proton/releases/download/${version}/proton-${version}.tar.gz`;
			default:
				return null;
		}
	}

	/**
	 * Gets the installation directory name
	 */
	private getInstallDirName(options: ProtonInstallOptions): string {
		const { variant, version } = options;

		switch (variant) {
			case "proton-ge":
				return version.startsWith("GE-Proton")
					? version
					: `GE-Proton${version}`;
			case "wine-ge":
				return version.startsWith("wine-ge") ? version : `wine-ge-${version}`;
			case "proton-stable":
			case "proton-experimental":
				return `Proton-${version}`;
			default:
				return `${variant}-${version}`;
		}
	}

	/**
	 * Finds an existing installation
	 */
	private async findInstallation(
		options: ProtonRemoveOptions,
	): Promise<string | null> {
		const expectedName = this.getInstallDirName(options);
		const expectedPath = path.join(this.compatibilityToolsPath, expectedName);

		if (await this.pathExists(expectedPath)) {
			return expectedPath;
		}

		// Search for variations
		try {
			const entries = await fs.readdir(this.compatibilityToolsPath);
			for (const entry of entries) {
				if (
					entry.toLowerCase().includes(options.version.toLowerCase()) &&
					entry.toLowerCase().includes(options.variant.replace("-", ""))
				) {
					return path.join(this.compatibilityToolsPath, entry);
				}
			}
		} catch {
			// Directory doesn't exist or can't be read
		}

		return null;
	}

	/**
	 * Detects if extracted content is source code that needs building
	 */
	private async detectSourceCode(installPath: string): Promise<boolean> {
		try {
			// Check for common build files
			const buildFiles = [
				"Makefile",
				"makefile",
				"configure.sh",
				"configure",
				"build.sh",
				"CMakeLists.txt",
			];

			for (const file of buildFiles) {
				if (await this.pathExists(path.join(installPath, file))) {
					return true;
				}
			}

			// Check for source directories
			const sourceDirs = ["src", "wine", "dxvk", "docker"];
			for (const dir of sourceDirs) {
				if (await this.pathExists(path.join(installPath, dir))) {
					return true;
				}
			}

			return false;
		} catch {
			return false;
		}
	}

	/**
	 * Builds Proton from source code
	 */
	private async buildFromSource(
		installPath: string,
		options: ProtonInstallOptions,
	): Promise<void> {
		const buildOptions = options.buildOptions || {};
		const timeout = buildOptions.buildTimeout || 3600000; // 1 hour default
		const makeJobs = buildOptions.makeJobs || os.cpus().length;

		this.emit("download-status", {
			variant: options.variant,
			version: options.version,
			status: "building",
			message: "Building from source...",
		} as DownloadStatusEvent);

		try {
			// Step 1: Configure
			await this.runBuildStep(installPath, "configure", options, timeout);

			// Step 2: Make
			await this.runBuildStep(installPath, "make", options, timeout, [
				"-j",
				makeJobs.toString(),
				...(buildOptions.makeArgs || []),
			]);

			// Step 3: Install
			await this.runBuildStep(installPath, "install", options, timeout, [
				"install",
			]);
		} catch (error) {
			throw new Error(
				`Build failed: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	/**
	 * Runs a build step (configure, make, or install)
	 */
	private async runBuildStep(
		installPath: string,
		step: "configure" | "make" | "install",
		options: ProtonInstallOptions,
		timeout: number,
		args: string[] = [],
	): Promise<void> {
		// Determine command and args before creating Promise
		let command: string;
		let commandArgs: string[] = [];

		switch (step) {
			case "configure":
				// Try different configure methods
				if (await this.pathExists(path.join(installPath, "configure.sh"))) {
					command = "./configure.sh";
				} else if (await this.pathExists(path.join(installPath, "configure"))) {
					command = "./configure";
				} else {
					// Skip configure if no configure script found
					return;
				}
				commandArgs = options.buildOptions?.configureArgs || [];
				break;
			case "make":
				command = "make";
				commandArgs = args;
				break;
			case "install":
				command = "make";
				commandArgs = args;
				break;
		}

		return new Promise((resolve, reject) => {
			this.emit("build-progress", {
				variant: options.variant,
				version: options.version,
				step,
				message: `Running ${command} ${commandArgs.join(" ")}`,
			} as BuildProgressEvent);

			const child = spawn(command, commandArgs, {
				cwd: installPath,
				stdio: ["ignore", "pipe", "pipe"],
				shell: true,
			});

			let errorOutput = "";

			child.stdout?.on("data", (data) => {
				// Emit progress updates for verbose output
				const lines = data.toString().split("\n");
				for (const line of lines) {
					if (line.trim()) {
						this.emit("build-progress", {
							variant: options.variant,
							version: options.version,
							step,
							message: line.trim(),
						} as BuildProgressEvent);
					}
				}
			});

			child.stderr?.on("data", (data) => {
				errorOutput += data.toString();
			});

			const timer = setTimeout(() => {
				child.kill("SIGTERM");
				reject(new Error(`Build step '${step}' timed out after ${timeout}ms`));
			}, timeout);

			child.on("close", (code) => {
				clearTimeout(timer);
				if (code === 0) {
					resolve();
				} else {
					reject(
						new Error(
							`Build step '${step}' failed with exit code ${code}. Error: ${errorOutput}`,
						),
					);
				}
			});

			child.on("error", (error) => {
				clearTimeout(timer);
				reject(
					new Error(`Failed to start build step '${step}': ${error.message}`),
				);
			});
		});
	}

	/**
	 * Checks if a path exists
	 */
	private async pathExists(filePath: string): Promise<boolean> {
		try {
			await fs.access(filePath);
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Checks if the system supports Proton installation
	 */
	isInstallationSupported(): boolean {
		return this.isLinux;
	}

	/**
	 * Gets the compatibility tools directory path
	 */
	getCompatibilityToolsDirectory(): string {
		return this.compatibilityToolsPath;
	}
}

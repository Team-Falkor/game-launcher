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
	ProtonVariant,
	ProtonVersionInfo,
} from "@/@types";

// Import types from @types folder
import type {
	DownloadProgressEvent,
	DownloadStatusEvent,
	ExtractionProgressEvent,
} from "../../@types/proton/installer";

/**
 * Handles installation and removal of Proton versions
 * Note: Proton installation is only supported on Linux systems
 *
 * Events:
 * - 'download-progress': Emitted during download with progress information
 * - 'download-status': Emitted when download status changes
 * - 'extraction-progress': Emitted during archive extraction with progress information

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

		// Determine file extension from URL
		const urlPath = new URL(downloadUrl).pathname;
		const fileName = path.basename(urlPath);
		const archivePath = path.join(tempDir, fileName || "proton-archive");

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

					// Always emit progress events, even without total size
					this.emit("download-progress", {
						variant,
						version,
						bytesDownloaded: downloadedBytes,
						totalBytes,
						percentage,
						speed,
						estimatedTimeRemaining,
					} as DownloadProgressEvent);

					// Also emit a status update for downloads without content-length
					if (totalBytes === 0) {
						this.emit("download-status", {
							variant,
							version,
							status: "downloading",
							message: `Downloaded ${(downloadedBytes / 1024 / 1024).toFixed(1)} MB (${(speed / 1024).toFixed(1)} KB/s)`,
						} as DownloadStatusEvent);
					}

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

			// Emit final progress (always, regardless of totalBytes)
			this.emit("download-progress", {
				variant,
				version,
				bytesDownloaded: downloadedBytes,
				totalBytes,
				percentage: totalBytes > 0 ? 100 : 0,
				speed: 0,
				estimatedTimeRemaining: 0,
			} as DownloadProgressEvent);

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
			if (!this.isValidArchiveHeader(headerBuffer)) {
				throw new Error(
					"Downloaded file does not appear to be a valid compressed archive (tar.gz or tar.xz)",
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
	 * Checks if the file header indicates a valid compressed archive (gzip or xz)
	 */
	private isValidArchiveHeader(header: Buffer): boolean {
		if (header.length < 6) return false;

		// Gzip files start with magic bytes 0x1f 0x8b
		if (header[0] === 0x1f && header[1] === 0x8b) {
			return true;
		}

		// XZ files start with magic bytes 0xfd 0x37 0x7a 0x58 0x5a 0x00
		if (
			header[0] === 0xfd &&
			header[1] === 0x37 &&
			header[2] === 0x7a &&
			header[3] === 0x58 &&
			header[4] === 0x5a &&
			header[5] === 0x00
		) {
			return true;
		}

		return false;
	}

	/**
	 * Extracts a compressed archive (tar.gz or tar.xz) with progress tracking
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

			// Create the target directory
			await fs.mkdir(installPath, { recursive: true });

			// Now extract with progress tracking
			let entriesProcessed = 0;
			try {
				await extract({
					file: archivePath,
					cwd: installPath,
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

		// For binary releases, verify extraction was successful
		const protonExe = path.join(installPath, "proton");
		if (!(await this.pathExists(protonExe))) {
			throw new Error(
				"Extraction completed but Proton executable not found. The archive may be corrupted or have an unexpected structure.",
			);
		}
	}

	/**
	 * Gets version information for installation
	 */
	private async getVersionInfo(
		options: ProtonInstallOptions,
	): Promise<ProtonVersionInfo | null> {
		// Import ProtonVersionFetcher to get actual download URLs from GitHub API
		const { ProtonVersionFetcher } = await import("./ProtonVersionFetcher");
		const fetcher = new ProtonVersionFetcher();

		try {
			// Fetch versions for the specific variant
			const versions = await fetcher.fetchVersionsForVariant(
				options.variant as ProtonVariant,
			);

			// Find the exact version match - try both full version and shortened version
			let versionInfo = versions.find((v) => v.version === options.version);

			// If not found with exact match, try to find by shortened version for backward compatibility
			if (!versionInfo && options.variant === "proton-ge") {
				// For GE-Proton, also try matching against shortened version (e.g., "10-9" matches "GE-Proton10-9")
				versionInfo = versions.find((v) => {
					const shortVersion = v.version
						.replace(/^(ge-)?proton-?/i, "")
						.replace(/^ge-?/i, "");
					return shortVersion === options.version;
				});
			} else if (!versionInfo && options.variant === "wine-ge") {
				// For Wine-GE, also try matching against shortened version
				versionInfo = versions.find((v) => {
					const shortVersion = v.version
						.replace(/wine-?ge-?/i, "")
						.replace(/^ge-?/i, "");
					return shortVersion === options.version;
				});
			}

			if (!versionInfo || !versionInfo.downloadUrl) {
				console.warn(
					`No download URL found for ${options.variant} version ${options.version}`,
				);
				// Fallback to constructed URL as last resort
				const fallbackUrl = this.constructDownloadUrl(options);
				if (fallbackUrl) {
					return {
						version: options.version,
						installed: false,
						downloadUrl: fallbackUrl,
					};
				}
				return null;
			}

			return versionInfo;
		} catch (error) {
			console.error(
				`Failed to fetch version info for ${options.variant} ${options.version}:`,
				error,
			);
			// Fallback to constructed URL
			const fallbackUrl = this.constructDownloadUrl(options);
			if (fallbackUrl) {
				return {
					version: options.version,
					installed: false,
					downloadUrl: fallbackUrl,
				};
			}
			return null;
		}
	}

	/**
	 * Constructs download URL based on variant and version
	 */
	private constructDownloadUrl(options: ProtonInstallOptions): string | null {
		const { variant, version } = options;

		switch (variant) {
			case "proton-ge":
				// Proton-GE releases typically have the format: GE-Proton8-32.tar.gz
				// But the version might be just the number part, so we need to handle both
				if (version.startsWith("GE-Proton")) {
					return `https://github.com/GloriousEggroll/proton-ge-custom/releases/download/${version}/${version}.tar.gz`;
				} else {
					// Try common patterns
					return `https://github.com/GloriousEggroll/proton-ge-custom/releases/download/GE-Proton${version}/GE-Proton${version}.tar.gz`;
				}
			case "wine-ge":
				// Wine-GE releases use .tar.xz format and have lutris in the filename
				// Example: lutris-GE-Proton8-26-x86_64.tar.xz
				if (version.startsWith("lutris-")) {
					return `https://github.com/GloriousEggroll/wine-ge-custom/releases/download/${version}/${version}.tar.xz`;
				} else {
					return `https://github.com/GloriousEggroll/wine-ge-custom/releases/download/${version}/lutris-${version}-x86_64.tar.xz`;
				}
			case "proton-stable":
			case "proton-experimental":
				// Valve Proton releases have various naming patterns
				// Common patterns: proton_8.0.tar.gz, proton-8.0-4.tar.gz
				// Try the most common pattern first
				return `https://github.com/ValveSoftware/Proton/releases/download/proton-${version}/proton-${version}.tar.gz`;
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
					: `GE-Proton-${version}`;
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

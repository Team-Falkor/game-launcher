import { spawnSync } from "node:child_process";
import * as crypto from "node:crypto";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	renameSync,
	rmSync,
	statSync,
	unlinkSync,
} from "node:fs";
import * as tar from "tar";

import {
	GPTK_URL,
	PROTON_URL,
	PROTONGE_URL,
	WINECROSSOVER_URL,
	WINEGE_URL,
	WINELUTRIS_URL,
	WINESTAGINGMACOS_URL,
} from "../config/constants";

export interface VersionInfo {
	version: string;
	type: string;
	date: string;
	download?: string;
	downsize?: number;
	disksize?: number;
	checksum?: string;
	installDir?: string;
}

export interface WineManagerStatus {
	status: "idle" | "downloading" | "unzipping";
	percentage?: number;
	eta?: number;
	avgSpeed?: number;
}

export enum Repositorys {
	WINEGE = "WINEGE",
	PROTONGE = "PROTONGE",
	PROTON = "PROTON",
	WINELUTRIS = "WINELUTRIS",
	WINECROSSOVER = "WINECROSSOVER",
	WINESTAGINGMACOS = "WINESTAGINGMACOS",
	GPTK = "GPTK",
}

interface FetchProps {
	url: string;
	type: string;
	count: number;
}

interface GetVersionsProps {
	repositorys?: Repositorys[];
	count?: number;
}

interface InstallProps {
	versionInfo: VersionInfo;
	installDir: string;
	overwrite?: boolean;
	onProgress?: (state: WineManagerStatus) => void;
	abortSignal?: AbortSignal;
}

interface UnzipProps {
	filePath: string;
	unzipDir: string;
	overwrite?: boolean;
	onProgress: (state: WineManagerStatus) => void;
	abortSignal?: AbortSignal | undefined;
}

function getVersionName(type: string, tag_name: string): string {
	if (type.includes("Wine")) {
		return `Wine-${tag_name}`;
	} else {
		return tag_name;
	}
}

/**
 * Helper to fetch releases from given url.
 *
 * @param url url where to fetch releases from.
 * @param type type of the releases (wine, proton, ge, ...)
 * @param count number of releases to fetch
 * @returns resolves with an array of VersionInfo
 */
async function fetchReleases({
	url,
	type,
	count,
}: FetchProps): Promise<VersionInfo[]> {
	const releases: Array<VersionInfo> = [];

	try {
		const response = await fetch(`${url}?per_page=${count}`);

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		interface GitHubRelease {
			tag_name: string;
			published_at: string;
			assets: Array<{
				name: string;
				browser_download_url: string;
				size: number;
			}>;
		}

		const data = (await response.json()) as GitHubRelease[];

		for (const release of data) {
			const release_data = {} as VersionInfo;
			release_data.version = getVersionName(type, release.tag_name);
			release_data.type = type;
			release_data.date = release.published_at?.split("T")[0] || "";
			release_data.disksize = 0;

			for (const asset of release.assets) {
				if (asset.name.endsWith("sha512sum")) {
					release_data.checksum = asset.browser_download_url;
				} else if (
					asset.name.endsWith("tar.gz") ||
					asset.name.endsWith("tar.xz")
				) {
					release_data.download = asset.browser_download_url;
					release_data.downsize = asset.size;
				}
			}

			// Only push if we have required fields
			if (release_data.version && release_data.type && release_data.date) {
				releases.push({
					version: release_data.version,
					type: release_data.type,
					date: release_data.date,
					disksize: release_data.disksize,
					...(release_data.download && { download: release_data.download }),
					...(release_data.downsize !== undefined && {
						downsize: release_data.downsize,
					}),
					...(release_data.checksum && { checksum: release_data.checksum }),
				});
			}
		}

		// sort out specific versions like LoL or diablo wine
		const latest =
			releases.find((release) => /\d+-\d+$/.test(release.version)) ??
			releases[0];

		// add latest to list if it exists
		if (latest) {
			releases.unshift({
				version: `${latest.type}-latest`,
				type: latest.type,
				date: latest.date,
				...(latest.download && { download: latest.download }),
				...(latest.downsize !== undefined && { downsize: latest.downsize }),
				...(latest.disksize !== undefined && { disksize: latest.disksize }),
				...(latest.checksum && { checksum: latest.checksum }),
			});
		}

		return releases;
	} catch (error) {
		throw new Error(
			`Could not fetch available releases from ${url} with error:\n ${error}`,
		);
	}
}

/**
 * Helper to unlink a file.
 *
 * @param filePath absolute path to file
 * @throws Error
 */
function unlinkFile(filePath: string) {
	try {
		if (existsSync(filePath)) {
			unlinkSync(filePath);
		}
	} catch {
		throw new Error(`Couldn't remove ${filePath}!`);
	}
}

/**
 * Helper to get disk space of installed version.
 *
 * @param folder absolute path to folder
 * @returns size of folder in bytes
 */
function getFolderSize(folder: string): number {
	const isMac = process.platform === "darwin";
	const param = isMac ? "-sk" : "-sb";
	const { stdout } = spawnSync("du", [param, folder]);
	const value = parseInt(stdout.toString());

	// on mac we get the size in kilobytes so we need to convert it to bytes
	return isMac ? value * 1024 : value;
}

/**
 * Helper to unzip an archive via tar.
 *
 * @param filePath url of the file
 * @param unzipDir absolute path to the unzip directory
 * @param onProgress callback to get unzip progress
 * @returns resolves or rejects with a message
 */
async function unzipFile({
	filePath,
	unzipDir,
	onProgress,
}: UnzipProps): Promise<string> {
	return new Promise((resolve, reject) => {
		try {
			if (!existsSync(filePath)) {
				reject(`Zip file ${filePath} does not exist!`);
			} else if (statSync(filePath).isDirectory()) {
				reject(`Archive path ${filePath} is not a file!`);
			} else if (!existsSync(unzipDir)) {
				reject(`Install path ${unzipDir} does not exist!`);
			}
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			reject(errorMessage);
		}

		onProgress({ status: "unzipping" });

		tar
			.extract({
				file: filePath,
				cwd: unzipDir,
				strip: 1,
			})
			.then(() => {
				onProgress({ status: "idle" });
				resolve(`Successfully unzip ${filePath} to ${unzipDir}.`);
			})
			.catch((error) => {
				onProgress({ status: "idle" });
				reject(`Unzip of ${filePath} failed with:\n ${error}!`);
			});
	});
}

/**
 * Download a file with progress tracking
 */
async function downloadFile({
	url,
	dest,
	progressCallback,
	abortSignal,
}: {
	url: string;
	dest: string;
	progressCallback?: (
		downloaded: number,
		speed: number,
		percentage: number,
	) => void;
	abortSignal?: AbortSignal | undefined;
}): Promise<void> {
	const response = await fetch(url, {
		method: "GET",
		...(abortSignal && { signal: abortSignal }),
	});

	if (!response.ok) {
		throw new Error(`HTTP error! status: ${response.status}`);
	}

	const totalLength = parseInt(response.headers.get("content-length") || "0");
	let downloadedLength = 0;
	const startTime = Date.now();

	const fs = await import("node:fs");
	const writer = fs.createWriteStream(dest);

	return new Promise((resolve, reject) => {
		const reader = response.body?.getReader();

		if (!reader) {
			reject(new Error("Failed to get response body reader"));
			return;
		}

		const pump = async () => {
			try {
				while (true) {
					const { done, value } = await reader.read();

					if (done) {
						writer.end();
						resolve();
						break;
					}

					downloadedLength += value.length;
					const elapsed = (Date.now() - startTime) / 1000;
					const speed = downloadedLength / elapsed;
					const percentage =
						totalLength > 0 ? (downloadedLength / totalLength) * 100 : 0;

					if (progressCallback) {
						progressCallback(downloadedLength, speed, percentage);
					}

					writer.write(value);
				}
			} catch (error) {
				writer.destroy();
				reject(error);
			}
		};

		writer.on("error", reject);
		pump();
	});
}

/**
 * Calculate ETA for download
 */
function calculateEta(
	downloadedBytes: number,
	downloadSpeed: number,
	totalSize?: number,
): number | null {
	if (!totalSize || downloadSpeed === 0) return null;
	const remainingBytes = totalSize - downloadedBytes;
	return remainingBytes / downloadSpeed;
}

/**
 * Fetch all available releases for given Repositorys.
 * If no repository is given, all Repositorys are checked.
 * @param repositorys array of Repositorys.
 * @param count max versions to fetch for each Repository
 * @returns resolves with an array of VersionInfo
 */
export async function getAvailableVersions({
	repositorys = [Repositorys.WINEGE, Repositorys.PROTONGE],
	count = 100,
}: GetVersionsProps): Promise<VersionInfo[]> {
	const releases: Array<VersionInfo> = [];

	for await (const repo of repositorys) {
		try {
			switch (repo) {
				case Repositorys.WINEGE: {
					const fetchedReleases = await fetchReleases({
						url: WINEGE_URL,
						type: "Wine-GE",
						count: count,
					});
					releases.push(...fetchedReleases);
					break;
				}
				case Repositorys.PROTONGE: {
					const fetchedReleases = await fetchReleases({
						url: PROTONGE_URL,
						type: "GE-Proton",
						count: count,
					});
					releases.push(...fetchedReleases);
					break;
				}
				case Repositorys.PROTON: {
					const fetchedReleases = await fetchReleases({
						url: PROTON_URL,
						type: "Proton",
						count: count,
					});
					releases.push(...fetchedReleases);
					break;
				}
				case Repositorys.WINELUTRIS: {
					const fetchedReleases = await fetchReleases({
						url: WINELUTRIS_URL,
						type: "Wine-Lutris",
						count: count,
					});
					releases.push(...fetchedReleases);
					break;
				}
				case Repositorys.WINECROSSOVER: {
					const fetchedReleases = await fetchReleases({
						url: WINECROSSOVER_URL,
						type: "Wine-Crossover",
						count: count,
					});
					releases.push(...fetchedReleases);
					break;
				}
				case Repositorys.WINESTAGINGMACOS: {
					const fetchedReleases = await fetchReleases({
						url: WINESTAGINGMACOS_URL,
						type: "Wine-Staging-macOS",
						count: count,
					});
					releases.push(...fetchedReleases);
					break;
				}
				case Repositorys.GPTK: {
					const fetchedReleases = await fetchReleases({
						url: GPTK_URL,
						type: "Game-Porting-Toolkit",
						count: count,
					});
					releases.push(...fetchedReleases);
					break;
				}
				default: {
					console.warn(
						`Unknown and not supported repository key passed! Skip fetch for ${repo}`,
					);
					break;
				}
			}
		} catch (error) {
			console.error(`Error fetching releases for ${repo}:`, error);
		}
	}

	return releases;
}

/**
 * Installs a given version to the given installation directory.
 *
 * @param versionInfo the version to install
 * @param installDir absolute path to installation directory
 * @param overwrite allow overwriting existing version installation
 * @param onProgress callback to get installation progress
 * @returns resolves with updated VersionInfo and the full installation directory
 */
export async function installVersion({
	versionInfo,
	installDir,
	overwrite = false,
	onProgress = () => {
		return;
	},
	abortSignal,
}: InstallProps): Promise<{ versionInfo: VersionInfo; installDir: string }> {
	/*
	 * VARIABLE DECLARATION
	 */

	if (!versionInfo.download) {
		throw new Error(`No download link provided for ${versionInfo.version}!`);
	}

	const tarFile = `${installDir}/${versionInfo.download.split("/").slice(-1)[0]}`;
	const installSubDir =
		versionInfo.installDir ?? `${installDir}/${versionInfo.version}`;
	const sourceChecksum = versionInfo.checksum
		? await fetch(versionInfo.checksum).then(async (response) => {
				if (!response.ok) {
					throw new Error(`HTTP error! status: ${response.status}`);
				}
				return response.text();
			})
		: undefined;

	const abortHandler = () => {
		const error = new Error(
			`Installation of ${versionInfo.version} was aborted!`,
		);
		error.name = "AbortError";
		unlinkFile(tarFile);
		if (existsSync(installSubDir)) {
			rmSync(installSubDir, { recursive: true });
		}

		throw error;
	};

	/*
	 * INSTALLATION PROCESS
	 */

	// Check if installDir exist
	if (!existsSync(installDir)) {
		mkdirSync(installDir, { recursive: true });
	} else if (!statSync(installDir).isDirectory()) {
		throw new Error(`Installation directory ${installDir} is not a directory!`);
	}

	// Check if it already exist
	if (existsSync(installSubDir) && !overwrite) {
		console.warn(
			`${versionInfo.version} is already installed. Skip installing! \n\n      Consider using 'override: true if you wan't to override it!'`,
		);

		// resolve with disksize
		versionInfo.disksize = getFolderSize(installSubDir);
		return { versionInfo: versionInfo, installDir: installSubDir };
	}

	// remove tarFile if still exist
	unlinkFile(tarFile);

	const getProgress = (
		downloadedBytes: number,
		downloadSpeed: number,
		percentage: number,
	) => {
		const eta = calculateEta(
			downloadedBytes,
			downloadSpeed,
			versionInfo.downsize,
		);

		onProgress({
			status: "downloading",
			percentage,
			eta: eta ?? 0,
			avgSpeed: downloadSpeed,
		});
	};

	// Download
	await downloadFile({
		url: versionInfo.download,
		dest: tarFile,
		progressCallback: getProgress,
		...(abortSignal && { abortSignal }),
	}).catch((error: Error) => {
		if (error instanceof Error && error.message.includes("Download stopped")) {
			abortHandler();
		}

		unlinkFile(tarFile);
		throw new Error(
			`Download of ${versionInfo.version} failed with:\n ${error}`,
		);
	});

	// Check if download checksum is correct
	const fileBuffer = readFileSync(tarFile);
	const hashSum = crypto.createHash("sha512");
	hashSum.update(fileBuffer);

	const downloadChecksum = hashSum.digest("hex");
	if (sourceChecksum) {
		if (!sourceChecksum.includes(downloadChecksum)) {
			unlinkFile(tarFile);
			throw new Error("Checksum verification failed");
		}
	} else {
		console.warn(
			`No checksum provided. Download of ${versionInfo.version} could be invalid!`,
		);
	}

	// backup old folder
	if (overwrite) {
		renameSync(installSubDir, `${installSubDir}_backup`);
	}

	try {
		mkdirSync(installSubDir);
	} catch (error) {
		unlinkFile(tarFile);
		throw new Error(`Failed to make folder ${installSubDir} with:\n ${error}`);
	}

	// Unzip
	await unzipFile({
		filePath: tarFile,
		unzipDir: installSubDir,
		overwrite: overwrite,
		onProgress: onProgress,
		...(abortSignal && { abortSignal }),
	}).catch((error: string) => {
		if (error.includes("AbortError")) {
			abortHandler();
		}

		// remove artefacts
		rmSync(installSubDir, { recursive: true });
		unlinkFile(tarFile);

		// restore backup
		if (overwrite) {
			renameSync(`${installSubDir}_backup`, installSubDir);
		}

		throw new Error(
			`Unzip of ${tarFile.split("/").slice(-1)[0]} failed with:\n ${error}`,
		);
	});

	// clean up
	if (overwrite) {
		rmSync(`${installSubDir}_backup`, { recursive: true });
	}
	unlinkFile(tarFile);

	// resolve with disksize
	versionInfo.disksize = getFolderSize(installSubDir);
	return { versionInfo: versionInfo, installDir: installSubDir };
}

export { fetchReleases, unlinkFile, getFolderSize, unzipFile };

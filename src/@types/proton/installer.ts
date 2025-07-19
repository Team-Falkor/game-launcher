/**
 * Proton installer-related type definitions
 */

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
		| "completed"
		| "failed";
	message?: string;
	error?: string;
}

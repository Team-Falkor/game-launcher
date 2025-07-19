/**
 * Process manager-related type definitions
 */

import type { ChildProcess } from "node:child_process";

/**
 * Security audit details interface to match SecurityAuditLogger expectations
 */
export interface SecurityAuditDetails {
	gameId?: string;
	userId?: string;
	sourceIp?: string;
	executable?: string;
	arguments?: string[];
	workingDirectory?: string;
	environment?: Record<string, string>;
	error?: string;
	blockedValue?: string;
	sanitizedValue?: string;
	[key: string]:
		| string
		| number
		| boolean
		| string[]
		| Record<string, string>
		| null
		| undefined;
}

/**
 * Extended ChildProcess interface for admin processes
 */
export interface ExtendedChildProcess extends ChildProcess {
	actualPid?: number;
}

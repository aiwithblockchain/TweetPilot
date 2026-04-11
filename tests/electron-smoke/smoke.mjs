import { existsSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";
import process from "node:process";
import electronPath from "electron";

const projectRoot = process.cwd();
const smokePrefix = "[electron-smoke]";
const distFiles = [
	join(projectRoot, "dist", "index.html"),
	join(projectRoot, "dist-electron", "main.js"),
	join(projectRoot, "dist-electron", "preload.mjs"),
];

for (const file of distFiles) {
	if (!existsSync(file)) {
		console.error(`Missing build artifact: ${file}`);
		console.error("Run `npm run build` before `npm run test:electron-smoke`.");
		process.exit(1);
	}
}

function fail(message) {
	console.error(message);
	process.exit(1);
}

const child = spawn(electronPath, ["."], {
	cwd: projectRoot,
	env: {
		...process.env,
		ELECTRON_SMOKE_TEST: "1",
		LOCAL_BRIDGE_TIMEOUT: process.env.LOCAL_BRIDGE_TIMEOUT ?? "1500",
	},
	stdio: ["ignore", "pipe", "pipe"],
});

let resolved = false;
let outputBuffer = "";
let errorBuffer = "";
let lineBuffer = "";

const timeoutId = setTimeout(() => {
	if (!resolved) {
		child.kill("SIGTERM");
		fail("Electron smoke test timed out before reporting a result.");
	}
}, 20000);

function handleLine(line) {
	if (!line.startsWith(smokePrefix)) {
		return;
	}

	resolved = true;
	clearTimeout(timeoutId);

	try {
		const payload = JSON.parse(line.slice(smokePrefix.length));

		if (!payload.success) {
			fail(`Electron smoke probe failed: ${payload.error}`);
		}

		if (payload.startup?.title !== "Dashboard") {
			fail(`Unexpected startup title: ${payload.startup?.title ?? "null"}`);
		}

		if (payload.navigation?.title !== "Accounts") {
			fail(
				`Unexpected navigation title: ${payload.navigation?.title ?? "null"}`,
			);
		}

		if (payload.preload?.available !== true) {
			fail("Preload API was not available in the Electron renderer.");
		}

		if (payload.preload?.ok !== true && typeof payload.preload?.error !== "string") {
			fail("Preload LocalBridge probe returned neither success nor an error message.");
		}

		console.log("Electron smoke test passed.");
		child.kill("SIGTERM");
		process.exit(0);
	} catch (error) {
		fail(`Failed to parse Electron smoke output: ${error instanceof Error ? error.message : String(error)}`);
	}
}

child.stdout.on("data", (chunk) => {
	const text = chunk.toString();
	outputBuffer += text;
	lineBuffer += text;

	const lines = lineBuffer.split(/\r?\n/);
	lineBuffer = lines.pop() ?? "";

	for (const line of lines) {
		const trimmed = line.trim();
		if (trimmed) {
			handleLine(trimmed);
		}
	}
});

child.stderr.on("data", (chunk) => {
	errorBuffer += chunk.toString();
});

child.on("exit", (code, signal) => {
	if (resolved) {
		return;
	}

	clearTimeout(timeoutId);
	fail(
		[
			`Electron smoke process exited before reporting a result.`,
			`code=${code ?? "null"} signal=${signal ?? "null"}`,
			outputBuffer.trim() ? `stdout:\n${outputBuffer.trim()}` : null,
			errorBuffer.trim() ? `stderr:\n${errorBuffer.trim()}` : null,
		]
			.filter(Boolean)
			.join("\n"),
	);
});

import { createFsDrain } from "evlog/fs";
import { createEvlog } from "evlog/next";
import { createInstrumentation } from "evlog/next/instrumentation/create";

/**
 * In development every wide event is also appended to `.evlog/logs` as NDJSON,
 * so a request can be read back after the fact instead of being scrolled for in
 * the terminal. Never in production: that filesystem is read-only, and events
 * there belong in a real drain.
 */
const drain =
	process.env.NODE_ENV === "production" ? undefined : createFsDrain();

export const { withEvlog, useLogger, log, createError } = createEvlog({
	service: "just-us-web",
	drain,
});

export const { register, onRequestError } = createInstrumentation({
	service: "just-us-web",
	drain,
});

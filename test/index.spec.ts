import {
	createExecutionContext,
	waitOnExecutionContext,
} from "cloudflare:test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createWorker } from "../src/index";
import { loadConfig } from "../src/config";

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;
const singleTargetWorker = createWorker(
	loadConfig({
		ip: "1.85.61.130",
		port: 29202,
	}),
);
const testEnv = {} as Env;

function mockFetch(expected: {
	url: string;
	method?: string;
	body?: string;
	responseBody: string;
	status?: number;
}) {
	vi.stubGlobal(
		"fetch",
		vi.fn(async (input: RequestInfo | URL) => {
			const request = new Request(input);

			expect(request.url).toBe(expected.url);
			expect(request.method).toBe(expected.method ?? "GET");

			if (expected.body !== undefined) {
				expect(await request.text()).toBe(expected.body);
			}

			return new Response(expected.responseBody, {
				status: expected.status ?? 200,
			});
		}),
	);
}

describe("edge proxy worker", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("proxies the root path to the configured target", async () => {
		mockFetch({
			url: "http://1.85.61.130:29202/",
			responseBody: "root upstream",
		});

		const request = new IncomingRequest("https://proxy.example.com/");
		const ctx = createExecutionContext();
		const response = await singleTargetWorker.fetch(request, testEnv, ctx);

		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(200);
		expect(await response.text()).toBe("root upstream");
	});

	it("keeps the request path and query string unchanged", async () => {
		mockFetch({
			url: "http://1.85.61.130:29202/users/profile?id=1",
			responseBody: "path upstream",
		});

		const request = new IncomingRequest("https://proxy.example.com/users/profile?id=1");
		const ctx = createExecutionContext();
		const response = await singleTargetWorker.fetch(request, testEnv, ctx);

		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(200);
		expect(await response.text()).toBe("path upstream");
	});

	it("forwards request bodies", async () => {
		mockFetch({
			url: "http://1.85.61.130:29202/login",
			method: "POST",
			body: JSON.stringify({ username: "demo" }),
			responseBody: "post upstream",
		});

		const request = new IncomingRequest("https://proxy.example.com/login", {
			method: "POST",
			body: JSON.stringify({ username: "demo" }),
			headers: {
				"content-type": "application/json",
			},
		});
		const ctx = createExecutionContext();
		const response = await singleTargetWorker.fetch(request, testEnv, ctx);

		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(200);
		expect(await response.text()).toBe("post upstream");
	});

	it("can route by the first path segment when routes are configured", async () => {
		const routedWorker = createWorker(
			loadConfig({
				ip: "1.85.61.130",
				port: 29001,
				routes: {
					api: {
						ip: "1.85.61.130",
						port: 29001,
					},
					file: {
						ip: "1.85.61.130",
						port: 29002,
					},
				},
			}),
		);

		mockFetch({
			url: "http://1.85.61.130:29002/avatar.png",
			responseBody: "file upstream",
		});

		const request = new IncomingRequest("https://proxy.example.com/file/avatar.png");
		const ctx = createExecutionContext();
		const response = await routedWorker.fetch(request, testEnv, ctx);

		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(200);
		expect(await response.text()).toBe("file upstream");
	});

	it("can keep the route prefix in route mode", async () => {
		const routedWorker = createWorker(
			loadConfig({
				ip: "1.85.61.130",
				port: 29001,
				routes: {
					auth: {
						ip: "1.85.61.130",
						port: 29202,
						stripPrefix: false,
					},
				},
			}),
		);

		mockFetch({
			url: "http://1.85.61.130:29202/auth/login",
			responseBody: "auth upstream",
		});

		const request = new IncomingRequest("https://proxy.example.com/auth/login");
		const ctx = createExecutionContext();
		const response = await routedWorker.fetch(request, testEnv, ctx);

		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(200);
		expect(await response.text()).toBe("auth upstream");
	});

	it("returns 404 for unknown path routes in route mode", async () => {
		const routedWorker = createWorker(
			loadConfig({
				ip: "1.85.61.130",
				port: 29001,
				routes: {
					api: {
						ip: "1.85.61.130",
						port: 29001,
					},
				},
			}),
		);

		const request = new IncomingRequest("https://proxy.example.com/missing/users");
		const ctx = createExecutionContext();
		const response = await routedWorker.fetch(request, testEnv, ctx);

		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(404);
		expect(await response.text()).toBe('No proxy route configured for "missing"');
	});
});

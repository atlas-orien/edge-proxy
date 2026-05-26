import {
	env,
	createExecutionContext,
	waitOnExecutionContext,
	fetchMock,
} from "cloudflare:test";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { createWorker } from "../src/index";
import { loadConfig } from "../src/config";

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;
const singleTargetWorker = createWorker(
	loadConfig({
		ip: "1.85.61.130",
		port: 29202,
	}),
);

describe("edge proxy worker", () => {
	beforeAll(() => {
		fetchMock.activate();
		fetchMock.disableNetConnect();
	});

	afterEach(() => {
		fetchMock.assertNoPendingInterceptors();
	});

	it("proxies the root path to the configured target", async () => {
		fetchMock
			.get("http://1.85.61.130:29202")
			.intercept({
				path: "/",
				method: "GET",
			})
			.reply(200, "root upstream");

		const request = new IncomingRequest("https://proxy.example.com/");
		const ctx = createExecutionContext();
		const response = await singleTargetWorker.fetch(request, env, ctx);

		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(200);
		expect(await response.text()).toBe("root upstream");
	});

	it("keeps the request path and query string unchanged", async () => {
		fetchMock
			.get("http://1.85.61.130:29202")
			.intercept({
				path: "/users/profile?id=1",
				method: "GET",
			})
			.reply(200, "path upstream");

		const request = new IncomingRequest("https://proxy.example.com/users/profile?id=1");
		const ctx = createExecutionContext();
		const response = await singleTargetWorker.fetch(request, env, ctx);

		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(200);
		expect(await response.text()).toBe("path upstream");
	});

	it("forwards request bodies", async () => {
		fetchMock
			.get("http://1.85.61.130:29202")
			.intercept({
				path: "/login",
				method: "POST",
				body: JSON.stringify({ username: "demo" }),
			})
			.reply(200, "post upstream");

		const request = new IncomingRequest("https://proxy.example.com/login", {
			method: "POST",
			body: JSON.stringify({ username: "demo" }),
			headers: {
				"content-type": "application/json",
			},
		});
		const ctx = createExecutionContext();
		const response = await singleTargetWorker.fetch(request, env, ctx);

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

		fetchMock
			.get("http://1.85.61.130:29002")
			.intercept({
				path: "/avatar.png",
				method: "GET",
			})
			.reply(200, "file upstream");

		const request = new IncomingRequest("https://proxy.example.com/file/avatar.png");
		const ctx = createExecutionContext();
		const response = await routedWorker.fetch(request, env, ctx);

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

		fetchMock
			.get("http://1.85.61.130:29202")
			.intercept({
				path: "/auth/login",
				method: "GET",
			})
			.reply(200, "auth upstream");

		const request = new IncomingRequest("https://proxy.example.com/auth/login");
		const ctx = createExecutionContext();
		const response = await routedWorker.fetch(request, env, ctx);

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
		const response = await routedWorker.fetch(request, env, ctx);

		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(404);
		expect(await response.text()).toBe('No proxy route configured for "missing"');
	});
});

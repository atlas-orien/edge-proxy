import {
	env,
	createExecutionContext,
	waitOnExecutionContext,
	fetchMock,
} from "cloudflare:test";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import worker from "../src/index";

// For now, you'll need to do something like this to get a correctly-typed
// `Request` to pass to `worker.fetch()`.
const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

describe("edge proxy worker", () => {
	beforeAll(() => {
		fetchMock.activate();
		fetchMock.disableNetConnect();
	});

	afterEach(() => {
		fetchMock.assertNoPendingInterceptors();
	});

	it("lists available routes at the root path", async () => {
		const request = new IncomingRequest("https://proxy.example.com/");
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);

		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(200);
		expect(await response.text()).toBe("Available routes: api, file, admin");
	});

	it("returns 404 when the route prefix is not configured", async () => {
		const request = new IncomingRequest("https://proxy.example.com/missing/users");
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);

		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(404);
		expect(await response.text()).toBe('No proxy route configured for "missing"');
	});

	it("proxies a configured route and strips the route prefix by default", async () => {
		fetchMock
			.get("http://192.168.1.1:23949")
			.intercept({
				path: "/users?id=1",
				method: "GET",
			})
			.reply(200, "api upstream");

		const request = new IncomingRequest("https://proxy.example.com/api/users?id=1");
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);

		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(200);
		expect(await response.text()).toBe("api upstream");
	});

	it("can keep the route prefix for routes with stripPrefix disabled", async () => {
		fetchMock
			.get("http://192.168.1.4:8080")
			.intercept({
				path: "/admin/settings",
				method: "GET",
			})
			.reply(200, "admin upstream");

		const request = new IncomingRequest("https://proxy.example.com/admin/settings");
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);

		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(200);
		expect(await response.text()).toBe("admin upstream");
	});
});

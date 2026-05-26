import { loadRoutes, type NormalizedRoute } from "./config";

const routes = loadRoutes();

function textResponse(message: string, status: number): Response {
	return new Response(message, {
		status,
		headers: {
			"content-type": "text/plain; charset=utf-8",
		},
	});
}

function buildProxyUrl(requestUrl: URL, route: NormalizedRoute): URL {
	const upstreamUrl = new URL(route.target.toString());
	const pathSegments = requestUrl.pathname.split("/").filter(Boolean);
	const targetSegments = route.stripPrefix ? pathSegments.slice(1) : pathSegments;

	upstreamUrl.pathname = [
		upstreamUrl.pathname.replace(/\/+$/, ""),
		...targetSegments.map((segment) => encodeURIComponent(decodeURIComponent(segment))),
	]
		.filter(Boolean)
		.join("/");

	if (!upstreamUrl.pathname.startsWith("/")) {
		upstreamUrl.pathname = `/${upstreamUrl.pathname}`;
	}

	upstreamUrl.search = requestUrl.search;
	return upstreamUrl;
}

function createProxyRequest(request: Request, upstreamUrl: URL): Request {
	const requestUrl = new URL(request.url);
	const headers = new Headers(request.headers);

	headers.set("host", upstreamUrl.host);
	headers.set("x-forwarded-host", requestUrl.host);
	headers.set("x-forwarded-proto", requestUrl.protocol.replace(":", ""));
	headers.set("x-forwarded-uri", requestUrl.pathname);

	return new Request(upstreamUrl, {
		method: request.method,
		headers,
		body: request.body,
		redirect: "manual",
	});
}

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const requestUrl = new URL(request.url);
		const routeName = requestUrl.pathname.split("/").filter(Boolean)[0];

		if (!routeName) {
			return textResponse(
				`Available routes: ${Array.from(routes.keys()).join(", ") || "(none)"}`,
				200,
			);
		}

		const route = routes.get(routeName);
		if (!route) {
			return textResponse(`No proxy route configured for "${routeName}"`, 404);
		}

		const upstreamUrl = buildProxyUrl(requestUrl, route);
		const proxyRequest = createProxyRequest(request, upstreamUrl);

		return fetch(proxyRequest);
	},
} satisfies ExportedHandler<Env>;

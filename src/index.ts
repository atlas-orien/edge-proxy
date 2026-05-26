import { loadConfig, type NormalizedTarget } from "./config";

const defaultConfig = loadConfig();

export type ProxyWorker = ExportedHandler<Env> & {
	fetch: NonNullable<ExportedHandler<Env>["fetch"]>;
};

function textResponse(message: string, status: number): Response {
	return new Response(message, {
		status,
		headers: {
			"content-type": "text/plain; charset=utf-8",
		},
	});
}

function buildProxyUrl(requestUrl: URL, target: NormalizedTarget): URL {
	const upstreamUrl = new URL(target.url.toString());
	const pathSegments = requestUrl.pathname.split("/").filter(Boolean);
	const targetSegments = target.stripPrefix ? pathSegments.slice(1) : pathSegments;

	upstreamUrl.pathname = `/${targetSegments
		.map((segment) => encodeURIComponent(decodeURIComponent(segment)))
		.join("/")}`;

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

export function createWorker(config = defaultConfig): ProxyWorker {
	return {
		async fetch(request, env, ctx): Promise<Response> {
			const requestUrl = new URL(request.url);
			const routeName = requestUrl.pathname.split("/").filter(Boolean)[0];
			const hasRoutes = config.routes.size > 0;

			if (hasRoutes && !routeName) {
				return textResponse(
					`Available routes: ${Array.from(config.routes.keys()).join(", ")}`,
					200,
				);
			}

			const target = hasRoutes ? config.routes.get(routeName) : config.defaultTarget;

			if (!target) {
				return textResponse(`No proxy route configured for "${routeName}"`, 404);
			}

			const upstreamUrl = buildProxyUrl(requestUrl, target);
			const proxyRequest = createProxyRequest(request, upstreamUrl);

			return fetch(proxyRequest);
		},
	};
}

export default createWorker() satisfies ExportedHandler<Env>;

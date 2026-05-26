import rawConfig from "../routes.config.json";

export interface ProxyRoute {
	target: string;
	stripPrefix?: boolean;
}

export interface ProxyConfig {
	routes: Record<string, ProxyRoute | string>;
}

export interface NormalizedRoute {
	name: string;
	target: URL;
	stripPrefix: boolean;
}

function routeToTargetUrl(routeName: string, route: ProxyRoute | string): URL {
	const target = typeof route === "string" ? route : route.target;
	const normalizedTarget = /^[a-z][a-z0-9+.-]*:\/\//i.test(target)
		? target
		: `http://${target}`;

	try {
		return new URL(normalizedTarget);
	} catch {
		throw new Error(`Invalid target URL for route "${routeName}": ${target}`);
	}
}

export function loadRoutes(config: ProxyConfig = rawConfig): Map<string, NormalizedRoute> {
	const routes = new Map<string, NormalizedRoute>();

	for (const [name, route] of Object.entries(config.routes)) {
		routes.set(name, {
			name,
			target: routeToTargetUrl(name, route),
			stripPrefix: typeof route === "string" ? true : route.stripPrefix ?? true,
		});
	}

	return routes;
}

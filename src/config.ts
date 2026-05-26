import rawConfig from "../routes.config.json";

export interface ProxyTarget {
	ip: string;
	port: number;
	protocol?: "http" | "https";
	stripPrefix?: boolean;
}

export interface ProxyConfig extends ProxyTarget {
	routes?: Record<string, ProxyTarget>;
}

export interface NormalizedTarget {
	name: string;
	url: URL;
	stripPrefix: boolean;
}

export interface LoadedConfig {
	defaultTarget: NormalizedTarget;
	routes: Map<string, NormalizedTarget>;
}

function normalizeTarget(name: string, config: ProxyTarget, defaultStripPrefix: boolean): NormalizedTarget {
	const protocol = config.protocol ?? "http";
	const target = `${protocol}://${config.ip}:${config.port}`;

	try {
		return {
			name,
			url: new URL(target),
			stripPrefix: config.stripPrefix ?? defaultStripPrefix,
		};
	} catch {
		throw new Error(`Invalid proxy target: ${config.ip}:${config.port}`);
	}
}

export function loadConfig(config: ProxyConfig = rawConfig): LoadedConfig {
	const routes = new Map<string, NormalizedTarget>();

	for (const [name, target] of Object.entries(config.routes ?? {})) {
		routes.set(name, normalizeTarget(name, target, true));
	}

	return {
		defaultTarget: normalizeTarget("default", config, false),
		routes,
	};
}

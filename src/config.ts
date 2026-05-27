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

export interface ProxyEnv {
	PROXY_IP?: string;
	PROXY_PORT?: string;
	PROXY_PROTOCOL?: "http" | "https";
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

export function loadConfigFromEnv(env: ProxyEnv, fallback: ProxyConfig = rawConfig): LoadedConfig {
	if (!env.PROXY_IP && !env.PROXY_PORT && !env.PROXY_PROTOCOL) {
		return loadConfig(fallback);
	}

	const port = env.PROXY_PORT ? Number(env.PROXY_PORT) : fallback.port;

	if (!Number.isInteger(port) || port < 1 || port > 65535) {
		throw new Error(`Invalid PROXY_PORT: ${env.PROXY_PORT}`);
	}

	return loadConfig({
		...fallback,
		ip: env.PROXY_IP ?? fallback.ip,
		port,
		protocol: env.PROXY_PROTOCOL ?? fallback.protocol,
	});
}

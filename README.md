# Edge Proxy

一个用 TypeScript 编写的 Cloudflare Workers 反向代理模板。这个项目保留了 Cloudflare CLI 生成的标准结构，可以通过 Cloudflare 环境变量或 `routes.config.json` 配置上游 IP 和端口。

## 项目结构

```text
.
├── src/
│   ├── index.ts        # Worker 入口，处理请求并转发到目标服务
│   └── config.ts       # 读取并规范化 routes.config.json
├── test/
│   └── index.spec.ts   # 基于 Cloudflare Workers Vitest pool 的测试
├── routes.config.example.json # 配置示例
├── routes.config.json         # 实际使用的反向代理 IP 和端口
├── wrangler.jsonc      # Cloudflare Workers / Wrangler 配置
├── package.json        # pnpm 脚本和开发依赖
└── tsconfig.json       # TypeScript 配置
```

`wrangler.jsonc` 的 `main` 指向 `src/index.ts`，这是 Worker 的入口文件。

## 配置模式

支持两种配置来源：Cloudflare 环境变量和 `routes.config.json`。如果配置了环境变量，环境变量优先；否则使用 `routes.config.json`。

### Cloudflare 环境变量

从 GitHub 导入 Worker 后，Cloudflare 会先按仓库内容构建一次。之后可以在 Cloudflare Dashboard 里修改变量：

```text
PROXY_IP=1.85.61.130
PROXY_PORT=29202
```

如果目标是 HTTPS，可以再加：

```text
PROXY_PROTOCOL=https
```

修改变量后，需要重新部署一次 Worker。这样不需要在 Cloudflare 里编辑 `routes.config.json` 文件。

`wrangler.jsonc` 里已经提供了默认变量，第一次构建可以直接通过：

```json
"vars": {
	"PROXY_IP": "192.168.1.100",
	"PROXY_PORT": "18080"
}
```

### 配置文件

`routes.config.json` 是仓库里的默认配置。没有设置环境变量时，Worker 会读取它。

支持两种配置模式：单目标模式和路径路由模式。

### 单目标模式

默认只需要一个 IP 和一个端口。收到请求后，会把原始路径和查询参数原样转发到配置的目标。

```json
{
	"ip": "1.85.61.130",
	"port": 29001
}
```

`routes.config.example.json` 是示例文件，可以作为新配置的参考。使用时从 `examples` 里复制其中一个对象到 `routes.config.json` 顶层，例如：

```json
{
	"ip": "api.example.com",
	"port": 443,
	"protocol": "https"
}
```

转发效果：

- `/` -> `http://1.85.61.130:29001/`
- `/users?id=1` -> `http://1.85.61.130:29001/users?id=1`
- `/api/login` -> `http://1.85.61.130:29001/api/login`

如果要部署到其他端口，只需要修改 `routes.config.json`：

```json
{
	"ip": "1.85.61.130",
	"port": 29002
}
```

### 路径路由模式

如果配置了 `routes`，Worker 会使用 path 第一段匹配不同目标：

```json
{
	"ip": "1.85.61.130",
	"port": 29001,
	"routes": {
		"api": {
			"ip": "1.85.61.130",
			"port": 29001
		},
		"file": {
			"ip": "1.85.61.130",
			"port": 29002
		},
		"auth": {
			"ip": "1.85.61.130",
			"port": 29202,
			"stripPrefix": false
		}
	}
}
```

路径路由模式下，默认会去掉第一段路由名前缀：

- `/api/users?id=1` -> `http://1.85.61.130:29001/users?id=1`
- `/file/avatar.png` -> `http://1.85.61.130:29002/avatar.png`

如果某条路由设置 `"stripPrefix": false`，会保留第一段前缀：

- `/auth/login` -> `http://1.85.61.130:29202/auth/login`

如果目标服务是 HTTPS，可以额外加 `protocol`：

```json
{
	"ip": "1.85.61.130",
	"port": 443,
	"protocol": "https"
}
```

## 开发

```bash
pnpm install
pnpm dev
```

## 测试

```bash
pnpm test
```

## 部署

```bash
pnpm run deploy
```

从 GitHub 创建 Worker 时，直接提交这个目录即可。Cloudflare 会读取 `wrangler.jsonc`，入口文件是 `src/index.ts`。导入后如果要改目标服务，建议在 Cloudflare Dashboard 里修改 `PROXY_IP` 和 `PROXY_PORT` 变量，然后重新部署。

## 注意

Cloudflare Workers 运行在 Cloudflare 边缘节点上，目标服务需要能从公网访问，或配合 Cloudflare Tunnel、私有网络接入等方案。

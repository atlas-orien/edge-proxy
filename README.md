# Edge Proxy

一个用 TypeScript 编写的 Cloudflare Workers 反向代理模板。这个项目保留了 Cloudflare CLI 生成的标准结构，并把代理路由放在 `routes.config.json` 中。

## 项目结构

```text
.
├── src/
│   ├── index.ts        # Worker 入口，处理请求并转发到目标服务
│   └── config.ts       # 读取并规范化 routes.config.json
├── test/
│   └── index.spec.ts   # 基于 Cloudflare Workers Vitest pool 的测试
├── routes.config.json  # 反向代理路由表
├── wrangler.jsonc      # Cloudflare Workers / Wrangler 配置
├── package.json        # pnpm 脚本和开发依赖
└── tsconfig.json       # TypeScript 配置
```

`wrangler.jsonc` 的 `main` 指向 `src/index.ts`，这是 Worker 的入口文件。

## 路由规则

默认使用请求路径的第一段作为路由名，并在转发时移除这一段：

- `/api/users?id=1` -> `http://192.168.1.1:23949/users?id=1`
- `/file/avatar.png` -> `http://192.168.1.3:13949/avatar.png`

如果某条路由设置 `"stripPrefix": false`，转发时会保留路由名前缀：

- `/admin/settings` -> `http://192.168.1.4:8080/admin/settings`

## 配置

编辑 `routes.config.json`：

```json
{
	"routes": {
		"api": {
			"target": "http://192.168.1.1:23949"
		},
		"file": {
			"target": "http://192.168.1.3:13949"
		},
		"admin": {
			"target": "http://192.168.1.4:8080",
			"stripPrefix": false
		}
	}
}
```

目标也可以简写成字符串：

```json
{
	"routes": {
		"api": "192.168.1.1:23949",
		"file": "192.168.1.3:13949"
	}
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

从 GitHub 创建 Worker 时，直接提交这个目录即可。Cloudflare 会读取 `wrangler.jsonc`，入口文件是 `src/index.ts`。

## 注意

Cloudflare Workers 运行在 Cloudflare 边缘节点上，默认不能直接访问 `192.168.x.x` 这类内网地址。线上使用时，需要让目标服务公网可达，或配合 Cloudflare Tunnel、私有网络接入等方案。

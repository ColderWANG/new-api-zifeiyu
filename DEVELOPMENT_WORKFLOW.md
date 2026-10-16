# New API 开发协作手册

更新时间：2026-10-16。

本文按 **新成员入门 → 日常协作 → 上游升级 → 测试 → 发布与回滚** 组织，适用于本仓库的前后端二次开发。具体编码、安全与数据库规则以 [AGENTS.md](./AGENTS.md)、[前端约定](./web/AGENTS.md) 及对应专项规则为准，不在此重复维护。

> 自建仓库的 `main` 保存定制代码，`upstream-sync` 保持纯官方代码。通过任务分支和 PR 协作，通过临时升级分支合并上游；验证通过不等于批准上线。已共享、已发布的分支不改写历史、不强推。

## 1. 新成员入门

### 1.1 先了解项目与分支

本仓库基于 **QuantumNous / New API** 二次开发，范围不限于前端：

- 前端：黑白主题、首页、Header、侧边栏、控制台页面、生图台等。
- 后端：生图台接口与路由、相关中间件及转发逻辑、API 密钥状态筛选等。
- 必须保持原有接口契约、权限边界与数据语义。本文不再采用旧版“只允许改 `web/`”“保证无冲突”“生产分支 rebase 后强推”的约定。

| 分支 | 职责 | 是否部署生产 |
| --- | --- | --- |
| 官方 QuantumNous/new-api 的 `main` | 官方持续开发的代码来源，不代表每个提交都是稳定发行版 | 否 |
| 自建仓库的 `main` | 默认分支，定制代码、README 和协作文档的集成与发布入口 | 是，部署验证过的明确提交 |
| 自建仓库的 `upstream-sync` | 纯官方代码镜像，不提交定制代码和本项目文档 | 否 |
| 自建仓库的 `custom-ui` | 迁移前的二开历史分支，不再作为开发或发布入口 | 否 |
| `feature/<主题>`、`fix/<主题>` | 从自建 `main` 创建的日常任务分支 | 否 |
| `upgrade/upstream-<日期或版本>` | 从自建 `main` 创建的上游升级验证分支 | 否，先隔离验证 |

`upstream-sync` 不会自动更新，需按第 3 部分同步。官方 `main` 与自建 `main` 职责不同，操作时必须结合远程名称判断。

### 1.2 获取代码并确认远程

新成员在自己选择的工作目录执行；命令逐步运行，失败时停止，不继续复制后续步骤：

```bash
git clone https://github.com/zi-fei-yu-2020/new-api-zifeiyu.git
cd new-api-zifeiyu
git remote add upstream https://github.com/QuantumNous/new-api.git
git branch --track upstream-sync origin/upstream-sync
git remote -v
git branch -vv
git status --short
```

已有仓库先检查配置，不重复添加远程或同名分支。

| 环境 | 自建仓库远程 | 官方仓库远程 | 二开主分支跟踪关系 |
| --- | --- | --- | --- |
| 本地 | `origin` | `upstream` | `main` → `origin/main` |
| 服务器 | `custom` | `origin` | `main` → `custom/main` |

本地 `upstream-sync` 跟踪 `origin/upstream-sync`，服务器对应分支跟踪 `custom/upstream-sync`。本地官方更新通过显式 `git fetch upstream` 获取。

**服务器发布必须使用 `custom/main`，不能误用服务器上的官方 `origin/main`。**

### 1.3 准备环境并首次启动

| 工具或配置 | 要求与依据 |
| --- | --- |
| Git | 用于分支协作及同步上游 |
| Go | 以各 `go.mod` 为准；当前根模块和 `tokenkit/` 为 1.26，`relaykit/` 为 1.25.1 |
| Bun | 使用 `web/bun.lock`；当前 CI 与 Dockerfile 使用 1.4.0 |
| Node.js | 前端部分维护脚本直接调用 `node`，需要可用的 Node.js 环境 |
| 数据库与 Redis | 基础本地开发可使用默认 SQLite；数据库兼容性测试另需真实实例，见第 4 部分 |
| Docker Compose | 需要容器化开发、数据库矩阵或发布验证时准备 |

先阅读 [.env.example](./.env.example)，按需要在根目录创建仅含本地配置的 `.env`，不要覆盖已有文件或复制生产配置。未设置 `SQL_DSN` 时使用本地 SQLite；同时检查终端继承的 `SQL_DSN`、`LOG_SQL_DSN`、`REDIS_CONN_STRING` 等变量，确保不会连接生产环境。容器开发配置与源码启动不同，参考 [开发 Compose](./docker-compose.dev.yml) 和 [makefile](./makefile)。

后端嵌入 `web/dist`，第一次运行 Go 前必须先构建前端。在仓库根目录打开终端 A：

```bash
cd web
bun install --frozen-lockfile
bun run build
cd ..
go run .
```

Windows 开发者在运行 Go 的 PowerShell 终端先设置 `$env:GOARCH='amd64'`，避免默认 386 架构导致溢出问题。Go 或前端编译失败时先解决，不用空文件冒充可用页面。

在另一个终端 B 启动前端开发服务：

```bash
cd web
bun run dev -- --host 127.0.0.1 --port 5173
```

- 默认后端端口为 `3000`，前端访问地址以启动日志为准，示例为 `http://127.0.0.1:5173`；端口占用时不能假设服务仍在原端口。
- `web/rsbuild.config.ts` 默认将 `/api`、`/v1`、`/mj`、`/pg` 代理到 `http://localhost:3000`。后端地址不同，可在启动前端的终端设置 `VITE_REACT_APP_SERVER_URL`；该变量不得包含密钥，也不要指向生产环境。
- 首次使用空的本地数据库时，按初始化向导创建自己的管理员，不共享生产账号，不在文档里记录账号密码。
- 开发端口不得暴露到公网。真实模型请求可能收费，必须使用独立测试渠道，并事先确认授权、预算及测试范围。
- 日常 UI 修改由前端开发服务热更新；Go 代码修改需重启本地后端。只访问后端嵌入页面时，前端改动需重新构建并重启后端才能生效。

### 1.4 常用代码入口

| 内容 | 优先阅读 |
| --- | --- |
| 功能介绍与通用开发说明 | `README.md`、`README.zh_CN.md` 的开发章节 |
| 共享组件、主题与布局 | `web/src/components/`、`web/src/styles/` |
| 页面、状态与路由 | `web/src/features/`、`web/src/stores/`、`web/src/routes/` |
| 生图台 | `web/src/features/image-studio/`、`controller/image_studio.go`、`router/image_studio_test.go` |
| API 密钥筛选 | `web/src/features/keys/`、`controller/token.go`、`model/token.go`、`controller/token_test.go` |
| 路由、访问校验与业务逻辑 | `router/`、`middleware/`、`controller/`、`service/`、`model/` |
| 上游转发与独立模块 | `relay/`、`relaykit/`、`tokenkit/` |

### 1.5 老成员的分支迁移

2026-10-16 已完成分支调整：原纯官方基线 `7de10f2c6` 保存在 `upstream-sync`；自建 `main` 快进接纳全部二开历史；`custom-ui` 保留在 `800e985bd`，不再双线维护。本次迁移未顺带升级上游，也未改写历史。

旧工作区先保存未提交内容，再执行：

```bash
git fetch origin
git switch main
git branch --set-upstream-to=origin/main main
git merge --ff-only origin/main

# 仅在本地还没有 upstream-sync 时执行
git branch --track upstream-sync origin/upstream-sync
git branch -vv
```

若无法快进，先保留现有工作分支并人工整合，不强制重置。旧 `custom-ui` 上未合入的内容通过任务分支迁移，已有以它为目标的 PR 改为自建 `main` 并重新验证。

## 2. 日常协作

### 2.1 认领任务并创建分支

开始前明确修改范围、验收标准、负责人及可能涉及的接口或数据变更。避免多人同时重写同一批共享组件；范围变化时先协调，再继续开发。

检查并保存工作区已有改动，未跟踪文件也要逐项确认，不能盲目清理或整体暂存。在本地仓库根目录执行：

```bash
git fetch origin
git switch main
git merge --ff-only origin/main

# 替换为本次任务主题
git switch -c fix/balance-layout
```

### 2.2 开发与接口交付

- 优先复用现有组件和设计变量，只改任务需要的文件，避免全仓格式化；具体规则见 `AGENTS.md` 与 `web/AGENTS.md`。
- 修复问题先补可复现的回归测试，再实现修复；保留多语言、响应式、键盘操作及失败状态。
- 前后端联合修改时，列明接口路径、请求/响应字段、类型、默认值、权限、分页与筛选含义。保持旧调用兼容；确需破坏性变更时必须提前评审并制定迁移方案。
- 新增配置要说明默认值、是否必填、配置位置及旧版本兼容方式；新增数据库变更要说明迁移和回滚限制，不得仅靠页面验证。
- 不提交密码、API Key、数据库、日志、生产配置或临时测试数据。截图、日志与 PR 描述同样需要脱敏。
- 本地 `create_demo_data.py` 等测试工具不得在生产执行；`update-official-image.sh` 不适用于定制版本发布，使用它可能将线上替换回官方镜像。

### 2.3 提交、PR 与审核

1. 按第 4 部分完成相关检查，审查 `git diff`，只 `git add` 已确认的明确文件路径，不使用 `git add .`。
2. 检查 `git diff --cached`，使用说明目的的提交信息，例如 `fix(ui): prevent balance overflow`。
3. 推送任务分支，以**自建仓库的 `main`** 为 PR 目标；不要向 `upstream-sync` 提交定制内容。
4. 提交人负责实现与测试，审核人检查契约、风险和验证证据，维护者确认合并，发布负责人安排上线。可由同一维护者兼任，但每次任务应明确实际负责人。

PR 至少包含：

- 目的、范围、关联任务及明确未修改的部分。
- 接口、配置、依赖、迁移影响；没有相关影响也要说明。
- 实际运行的测试命令及结果，未执行项和已知问题；UI 修改附桌面与手机截图。
- 需要特殊部署步骤时，提供执行顺序、回滚条件与文档更新。

若 `main` 在审核期间有新提交，合并更新后的 `origin/main` 到任务分支并重测，不覆盖远程历史。共享的 `main`、`upstream-sync` 及历史 `custom-ui` 不做 rebase，不使用 `push --force` 或 `push --force-with-lease`。

合并后按实际合并提交检查结果，避免合并冲突处理引入未经验证的变化。合并代码不等于批准上线。

### 2.4 仓库规则与紧急修复

- 多人协作原则上通过 PR 合并；分支保护、必需审核人和必需检查需由管理员配置，本文不表示这些仓库设置已经启用。
- 当前 `.github/workflows/ci.yml` 为 PR 配置后端 vet/build/test、前端 typecheck/test。它不代替前端 lint、生产构建、浏览器回归或真实数据库兼容性验证；以实际运行结果为准。
- 紧急修复从**实际线上提交**创建 `hotfix/<主题>`，不能假设当前 `main` 就是线上版本。走最小范围审核、验证及第 5 部分的发布流程，不在服务器临时改代码冒充正式修复。
- 紧急修复发布后及时合回 `main`，并同步到正在进行的升级分支；记录回流状态，避免下次发布把修复丢掉。

## 3. 上游升级

```text
官方 main（或审核过的发行版本）
          ↓
本地 upstream-sync → 自建仓库 upstream-sync
          ↓ merge
upgrade/upstream-<日期或版本>
          ↓ 解决冲突、测试、预览、PR 审核
自建 main
          ↓ 发布负责人确认后，服务器拉取明确提交并构建
备份 → 切换 → 验证 → 必要时回滚
```

### 3.1 选择目标并同步纯官方代码

先保存工作区内容，记录当前生产提交，阅读目标版本的接口、认证、计费、迁移和依赖变化。不承诺无冲突，不在生产服务器解决合并冲突，也不把官方分支直接部署到生产。

以下在本地执行，示例同步 `upstream/main`。若选择官方发行版本，使用已核实的 tag/提交；若其不在当前同步分支的后续历史中，另建验证分支，不倒退或强推 `upstream-sync`。

```bash
git fetch upstream --tags
git fetch origin
git switch upstream-sync
git merge --ff-only origin/upstream-sync
git merge --ff-only upstream/main
git push origin upstream-sync
```

快进或推送失败时先检查分叉原因，不用 `reset --hard` 或强推掩盖差异。`git fetch` 只更新远程引用，不会自动升级工作分支或线上服务。获取官方 tags 不等于向自建仓库发布 tags，不运行未经审核的 `git push --tags`。

### 3.2 在临时升级分支合并

```bash
git switch main
git merge --ff-only origin/main

# 替换为未使用的本次升级分支名
git switch -c upgrade/upstream-20261016
git merge --no-ff --no-commit upstream-sync
```

`--no-commit` 让实际合并停下来以便检查；提示已是最新时，不需要创建空的合并提交。

处理冲突：

- 用 `git status`、`git diff --name-only --diff-filter=U` 查看冲突，逐项理解双方改动，不整批选择 ours/theirs。
- 兼容官方新增逻辑并保留二开功能，重点关注共享 UI、路由、翻译、生图台、令牌筛选及受影响的权限、计费、数据结构。
- 官方已修复相同问题时，核对行为和测试后可替换我们的补丁，避免重复实现；依赖及锁文件按实际依赖关系处理。
- 只暂存已审查的明确路径，按第 4 部分完成验证后执行 `git commit` 保存合并结果。

放弃尚未提交的合并可执行 `git merge --abort`。合并已提交时不再使用该命令；保留或放弃临时分支即可，此时尚未影响自建 `main` 和生产。

### 3.3 审核并合入 `main`

推送升级分支，以自建 `main` 为目标创建 PR，说明官方目标提交、冲突处理、定制功能兼容情况及完整验证结果。

**升级 PR 使用保留历史的 merge commit，不 squash、不 rebase 掉官方祖先关系**，否则下次同步可能重复处理同一批改动。

如果审核期间 `main` 有新提交，先更新升级分支：

```bash
git fetch origin
git switch upgrade/upstream-20261016
git merge origin/main
```

解决冲突、重新测试并正常推送后再审核合并。合并完成后同步本地 `main`，记录用于发布的明确提交：

```bash
git switch main
git pull --ff-only origin main
git rev-parse HEAD
```

同步与合并不触发本手册中的生产发布授权，需另按第 5 部分安排。

## 4. 测试

### 4.1 按影响范围选择验证

根据完整差异确定范围，包括合并进来的上游改动，不能只检查自己写的文件。

| 变更类型 | 最低检查范围 |
| --- | --- |
| 仅文档 | 分支名、命令、相对链接、代码块、UTF-8 编码及敏感信息检查；不需要重启服务 |
| 前端小修复 | 回归测试、受影响 lint/格式检查、类型检查、相关浏览器验证；发布前生产构建 |
| 上游升级或广泛前端变更 | 完整前端检查、构建与主要用户流程回归，并检查后端影响 |
| 后端或独立模块 | 受影响 Go 包测试与构建；独立模块单独验证，广泛修改扩大测试范围 |
| 数据库、认证、计费 | 额外执行 `AGENTS.md` 对应专项要求，不以普通单元测试代替 |

### 4.2 前端检查与浏览器回归

在 `web/` 下执行，任何一步失败都先解决：

```bash
bun install --frozen-lockfile
bun run typecheck
bun run lint
bun run format:check
bun run test
bun run build
```

日常小修复可按 `web/AGENTS.md` 缩小 lint、格式检查及测试范围；合并上游优先完整执行。不得顺手全仓格式化来消除无关问题。

浏览器检查按变更范围覆盖桌面和手机、首页和导航、登录注册、概览与图表、API 密钥状态筛选、渠道列表、生图台模型权限和文生图/图生图、语言切换，并补充边界及失败场景。涉及金额时核对完整数值和精度，涉及筛选时同时核对界面状态与实际查询结果。

### 4.3 后端、接口与数据库

- 使用各 `go.mod` 声明的工具链。根模块完成前端构建后执行受影响 Go 包测试与构建；需要完整测试时参考 `make test`，区分实际已执行与未执行的范围。
- 当前 Windows 开发机运行 Go 时显式设置 `$env:GOARCH='amd64'`。修改 `relaykit/` 或 `tokenkit/` 时，分别在对应模块执行 `GOWORK=off go build ./...`；PowerShell 使用 `$env:GOWORK='off'` 设置环境变量。
- 修改认证或计费前，遵守 `AGENTS.md` 对应专项阅读与安全验证要求；必要的权限、失败、重试或数据不变量测试不能省略。
- 涉及数据库行为时，必须验证真实 SQLite、MySQL、PostgreSQL，不能用单一数据库或 mock 代替。
- 涉及迁移时，验证新建库、代表性旧库升级及重复启动幂等性；检查数据、索引、约束和受影响的独立日志库。

### 4.4 测试隔离与验收记录

- 开发和测试使用独立数据库、缓存、账号及渠道，不复用生产连接配置。
- 生产数据副本仅可在受控隔离环境验证，按需要脱敏，禁止连接生产缓存、上游渠道或触发真实任务；副本与备份不得公开。
- 不在生产制造演示数据，不执行未经确认的付费请求。没有真实上游条件时，说明哪些使用模拟接口、哪些尚未实测。
- 记录实际命令、环境、数据库版本、结果和未解决项。不能把构建成功描述为“所有功能、数据库验证通过”。
- 发现失败项先定位；仅有历史环境问题时也要说明证据和影响，由审核人决定是否接受，不能静默跳过。

## 5. 发布与回滚

### 5.1 发布职责、目录与服务

发布负责人确认目标提交、验收结果、维护窗口和回滚条件，并通知相关成员；**同一环境同一时间只运行一个发布任务**。先检查是否已有构建或部署在执行，禁止并发改写镜像配置。

| 路径或服务 | 用途 |
| --- | --- |
| `/root/zifeiyu/project/new-api` | 生产仓库、Compose 配置和挂载目录 |
| `/root/zifeiyu/project/new-api-releases/<短提交号>` | 独立源码 worktree、服务器构建日志及验证记录 |
| `/root/zifeiyu/backups/new-api/<发布备份名称>` | 数据库备份、旧配置和回滚脚本 |
| `new-api` 容器 | 应用，当前宿主机端口 3001 映射到容器 3000 |
| `postgres`、`redis` 容器 | 生产数据库和缓存，不随普通应用更新重建 |

**构建目录不合并、不重命名。服务器从自建仓库拉取并构建，不上传本地编译的发布包。**

### 5.2 发布前检查

以下只检查状态并拉取引用，不启动发布：

```bash
cd /root/zifeiyu/project/new-api
git remote -v
git branch -vv
git status --short
git fetch custom main
git rev-parse custom/main
docker inspect new-api --format '{{.Config.Image}} {{.State.Status}}'
```

- 核对当前分支为 `main`、跟踪 `custom/main`，目标完整提交号与已审核版本一致；不得无条件采用发布等待期间的新提交。
- 检查新增配置、迁移、依赖及回滚限制。迁移不向后兼容时，必须先准备恢复方案，不能仅保留旧镜像。
- 服务器允许存在合法生产配置差异，尤其是 `docker-compose.yml`。先检查并备份，不用强制 checkout、reset 或清理工作区覆盖它们。
- 保留 `docker-compose.override.yml`、服务文件、环境变量、挂载、网络、端口和日志目录；包含密钥的配置及 inspect 输出只能保存在受保护的备份中。

### 5.3 构建与切换顺序

1. 记录旧镜像和 revision，保留回滚镜像、配置及数据备份，检查磁盘和内存余量。
2. 为明确的目标提交建立干净的独立 worktree，避免把生产日志、配置、密钥和数据库放入 Docker 构建上下文。
3. 在服务器使用仓库 Dockerfile 构建带提交号及 revision 标签的镜像；资源紧张时顺序构建前端 builder 和完整镜像。
4. 长任务写入受保护的日志及退出码文件，允许 SSH 断开后继续。构建失败不切换线上，不盲目重跑旧发布目录中写死提交号的脚本。
5. 按第 4 部分完成所需验证；把生产仓库快进到目标提交时保留部署文件，若有配置覆盖风险则停止并人工整合。
6. 准备仅修改应用镜像的 Compose override，对比解析后的配置；必要配置变更需单独评审，不能夹带非预期变化。
7. 在维护窗口仅优雅停止 `new-api`（当前使用 150 秒超时），确认停写后保存一致性数据库备份，校验备份可读性，再启动新镜像。
8. 使用 `docker compose up -d --no-deps --pull never new-api` 只更新应用，不重建 PostgreSQL、Redis 或其他服务。
9. 验证成功后记录发布报告，通知维护结束；清理临时凭据，但保留所需回滚镜像及备份。

### 5.4 上线验证

- 检查容器健康、运行镜像 revision、重启次数及启动异常。
- 检查本机 `/api/status`、公网状态、首页、登录页、相关页面和静态资源，确认来自目标构建。
- 对比原环境变量值、挂载、网络、端口和启动参数；环境变量按键值比较，不能因数组顺序变化误判配置变更。
- 公网探测使用正常客户端兼容的 User-Agent，区分边缘防护的 403 与应用故障；不能跳过公网验证或绕过访问控制宣称成功。
- 核对关键数据无异常变化；日志等持续写入数据允许正常增长，异常差异必须调查。
- 验证未认证请求仍受保护，对本次功能做必要的只读或受控检查，不能只看容器是否启动。

### 5.5 失败回滚

验证失败时停止进一步发布，按本次预先准备的方案恢复旧镜像配置，只重建应用，再检查本机、公网和服务健康，通知相关成员并记录失败原因。

**应用回滚不等于数据库回滚。** 如果新迁移不兼容旧应用，执行预先评审的恢复流程；不能未经确认用旧备份覆盖已经产生的新数据。回滚脚本须说明适用版本、数据兼容条件和使用位置。

禁止通过 `docker compose down` 重建整套服务；禁止 `docker compose down -v`、清空生产目录、导入本地 SQLite 或演示数据、使用拉官方镜像的脚本替代定制发布。

### 5.6 发布记录与交接

每次发布留下以下记录，不包含任何可用凭据：

- 发布负责人、目标提交、镜像标签和 revision、发布时间及维护窗口。
- 上游目标、冲突处理、保留或替换的定制逻辑、配置和迁移变化。
- 实际测试、浏览器及数据库验证结果；未通过、未执行项和验收决定。
- 备份位置、回滚入口、适用条件、线上检查结果及后续跟进事项。

本文随自建 `main` 维护，不提交到纯官方镜像 `upstream-sync`。规则或部署方式变化时由对应修改人同步更新，并由审核人检查；仅更新文档无需重建或重启生产，编辑、提交推送与发布按任务授权分别执行。

### 5.7 历史部署与迁移快照

截至 2026-10-16，最近一次已确认成功上线的应用提交为 `800e985bd`，镜像为 `new-api-zifeiyu:800e985bd`。这是历史记录，不是固定发布目标，以实际运行镜像、revision 和部署报告为准。

分支迁移仅调整 Git、跟踪关系及文档，没有重建或重启应用。历史 `/api/status` 中的 `custom-ui-<提交号>` 是旧版本标签，不代表仍从 `custom-ui` 发布，不为改标签单独发版。

服务器旧官方 `main` 保存在 `archive/main-before-20261016`，旧 `my-custom` 保留不动；本地和远程 `custom-ui` 同样保留历史。后续发布从 `custom/main` 获取验证过的提交。

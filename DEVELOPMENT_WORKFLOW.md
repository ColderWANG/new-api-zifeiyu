# New API 二次开发、上游同步与上线流程

更新时间：2026-10-16。

本文适用于当前 New API 定制项目。开发与验证同时遵循根目录 `AGENTS.md`、`web/AGENTS.md` 及变更涉及的专项规则。

> 核心原则：自建仓库的 `main` 保存我们的定制，`upstream-sync` 保持纯官方代码；在临时分支合并上游，验证后再上线。已发布分支不做 rebase、不强推。同步上游不等于立即部署，也不保证自动合并无冲突。

## 1. 分支与仓库分工

| 分支 | 职责 | 是否部署生产 |
| --- | --- | --- |
| 官方 QuantumNous/new-api 的 `main` | 官方持续开发的代码来源，不代表每个提交都是稳定发行版 | 否 |
| 自建仓库的 `main` | 默认分支，定制功能、README、协作文档的集成与发布入口 | 是，部署验证过的明确提交 |
| 自建仓库的 `upstream-sync` | 官方代码的同步镜像，不提交定制功能和本项目运维文档 | 否 |
| 自建仓库的 `custom-ui` | 迁移前的二开分支，保留历史，不再作为日常开发或发布入口 | 否 |
| `feature/<主题>`、`fix/<主题>` | 从自建 `main` 创建的日常开发分支 | 否 |
| `upgrade/upstream-<日期或版本>` | 从自建 `main` 创建的上游升级验证分支 | 否，先在隔离环境验证 |

`upstream-sync` **不会自动同步官方**。需要主动 fetch、审核目标版本并更新，再通过升级分支将需要的改动合入自建 `main`。官方的 `main` 与自建仓库的 `main` 现在职责不同，必须结合远程名称判断。

### 1.1 当前二开范围

- 前端：黑白主题、首页、Header、侧边栏、控制台页面、生图台等。
- 后端：生图台接口与路由、相关中间件及转发逻辑、API 密钥状态筛选等。
- 后续允许按需求修改前后端，但必须保留原有接口契约、权限边界及数据语义；不能为了合并方便覆盖掉已有功能。
- 本文替代旧版“仅允许修改 `web/`”“100% 无冲突”“对生产分支 rebase 后强推”的约定。

### 1.2 本地与服务器的远程名称不同

| 环境 | 指向自建仓库 | 指向官方仓库 | 二开分支跟踪关系 |
| --- | --- | --- | --- |
| 本地 | `origin` | `upstream` | `main` → `origin/main` |
| 服务器 | `custom` | `origin` | `main` → `custom/main` |

仓库地址：

```text
自建：https://github.com/zi-fei-yu-2020/new-api-zifeiyu.git
官方：https://github.com/QuantumNous/new-api.git
```

本地 `main` 跟踪 `origin/main`，`upstream-sync` 跟踪 `origin/upstream-sync`；官方更新通过显式 `git fetch upstream` 获取。服务器对应分支跟踪 `custom/main`、`custom/upstream-sync`。操作前先确认实际配置，不要仅凭 `origin` 这个名称判断仓库归属：

```bash
git remote -v
git branch -vv
git status --short
```

**服务器发布必须使用自建仓库的 `custom/main`，不能误用官方的 `origin/main`。**

### 1.3 已确认的部署快照

截至上述更新时间，最近一次成功上线的应用提交为 `800e985bd`，镜像为 `new-api-zifeiyu:800e985bd`。这只是历史快照，不是固定发布目标；后续以实际运行镜像、Git revision 标签及部署验证记录为准。

本次分支迁移只调整 Git 分支、跟踪关系和文档，不重建或重启应用。历史镜像及 `/api/status` 中的 `custom-ui-<提交号>` 属于旧版本标签，不代表仍从 `custom-ui` 发布；不为改标签单独发版。

### 1.4 2026-10-16 分支迁移说明

- 原自建 `main` 的纯官方基线 `7de10f2c6` 保存在 `upstream-sync`，本次没有顺带升级官方代码。
- 自建 `main` 通过快进接纳原 `custom-ui` 的全部历史，再提交定制 README 和本文；没有改写提交历史。
- `custom-ui` 保留在迁移前的 `800e985bd`，作为历史参考，不再与 `main` 双线维护。
- 仓库默认分支仍为 `main`；新 PR 应以自建 `main` 为目标，已有以 `custom-ui` 为目标的 PR 需调整目标分支并重新验证。
- 服务器旧官方 `main` 保存在本机归档分支 `archive/main-before-20261016`，旧 `my-custom` 保留不动。

已拉取旧分支布局的协作者应先保存未提交工作，然后在本地执行：

```bash
git fetch origin
git switch main
git branch --set-upstream-to=origin/main main
git merge --ff-only origin/main

# 仅在本地还没有 upstream-sync 时执行
git branch --track upstream-sync origin/upstream-sync
git branch -vv
```

若本地 `main` 有额外提交导致无法快进，先保留工作分支并人工整合，不要强制重置。旧 `custom-ui` 上尚未合入的开发内容要通过新分支迁移至 `main`，不要直接删除。

## 2. 日常开发

开始前检查工作区，提交或单独保存当前工作，避免把不相关改动带入新分支。未跟踪文件也要逐项检查，不能盲目清理或整体暂存。

以下 Git 命令在本地项目根目录执行，每一步成功后再继续：

```bash
git fetch origin
git switch main
git merge --ff-only origin/main

# 示例名称，每次替换为本次任务主题
git switch -c fix/balance-layout
```

前端开发使用 Bun：

```bash
cd web
bun install --frozen-lockfile
bun run dev
```

开发要求：

- 优先复用现有组件和设计变量，只改任务需要的文件，避免全仓格式化。
- 修复问题先补回归测试，再验证修复；保留翻译、响应式、键盘操作及错误状态。
- 只暂存本次改动的明确路径，审查 `git diff --cached` 后提交；不要直接 `git add .`。
- 不提交账号密码、API Key、数据库、日志、生产环境配置或临时测试数据。
- 多人协作通过 PR 将开发分支合回自建 `main`，说明变更范围、接口影响及实际验证结果；UI 修改附桌面和手机截图。若 `main` 已被别人更新，先整合并重测，不覆盖远程历史。
- 合并代码不等于批准上线。由指定发布负责人协调发布，同一环境同一时间只运行一个发布任务；分支保护和必需检查需由仓库管理员配置，本文不表示这些设置已经启用。

本地 `create_demo_data.py` 等测试工具不得在生产执行。`update-official-image.sh` 不适用于定制版本发布，使用它可能把线上替换回官方镜像。

## 3. 同步上游：先验证，后发布

```text
官方 main（或审核过的发行版本）
          ↓
本地 upstream-sync → 自建仓库 upstream-sync
          ↓ merge
upgrade/upstream-<日期或版本>
          ↓ 解决冲突、测试、预览
自建 main → 推送自建仓库
          ↓ 服务器拉取明确提交并构建
备份 → 切换 → 验证 → 必要时回滚
```

### 3.1 准备与选择目标

1. 确认工作区无未处理的改动；记录当前生产提交和镜像。
2. 获取上游代码，阅读目标版本的改动，尤其是接口、认证、计费、迁移和依赖变化。
3. 确定本次升级目标。下面示例同步 `upstream/main`；若选择官方发行版本，使用已核实的对应 tag/提交，并保留纯官方历史。
4. 不在生产服务器处理合并冲突，不直接把官方分支部署到生产。

### 3.2 更新纯官方 `upstream-sync`

在本地执行：

```bash
git fetch upstream --tags
git fetch origin
git switch upstream-sync
git merge --ff-only origin/upstream-sync
git merge --ff-only upstream/main
git push origin upstream-sync
```

若快进合并或推送失败，先检查分叉原因；不要使用 `reset --hard` 或强推来掩盖差异。`git fetch` 只更新远程引用，不会自动升级工作分支或线上服务。

### 3.3 在临时升级分支合并

```bash
git switch main
git merge --ff-only origin/main

# 日期只是示例，必须换成未使用的本次升级分支名
git switch -c upgrade/upstream-20261016
git merge --no-ff --no-commit upstream-sync
```

`--no-commit` 让有实际合并的操作停下来，便于检查和验证；如果 Git 提示已经是最新，则没有需要创建的合并提交。

处理冲突时：

- 用 `git status`、`git diff --name-only --diff-filter=U` 查看冲突。
- 逐个理解双方改动，兼容官方新增逻辑并保留我们的功能；不要整批选择 ours/theirs。
- 重点检查基础 UI、路由、翻译文件、生图台、令牌筛选以及上游改动涉及的权限、计费和数据结构。
- 若官方已修复同一个问题，核对行为和回归测试后可采用官方实现，避免长期保留重复补丁。
- 依赖和锁文件按实际依赖关系处理，不能随意选一边。
- 解决后只 `git add` 已审查的明确文件路径，按第 4 节完成验证，再执行 `git commit` 保存合并结果。

若决定放弃尚未提交的合并：

```bash
git merge --abort
```

合并已提交时，不再使用 `merge --abort`；保留或放弃临时分支即可，此时尚未影响自建 `main` 和生产。

### 3.4 验证通过后合回发布分支

```bash
git fetch origin
git switch main
git merge --ff-only origin/main
git merge --ff-only upgrade/upstream-20261016
git push origin main
git rev-parse HEAD
```

上面是有权限的维护者在验证后的命令示例；多人协作优先用以自建 `main` 为目标的 PR 合并，并遵守仓库保护规则，不为执行命令绕过审核。

如果升级期间自建 `main` 有新提交，最后的快进合并可能失败。应回到升级分支，合并更新后的自建 `main`，解决冲突并重新测试，再重复上述步骤。推送被拒绝时同样先整合新提交，不强推。

**不要对已共享、已上线的 `main` 或历史 `custom-ui` 执行 rebase、`push --force` 或 `push --force-with-lease`。**

上游升级的 PR 应保留合并历史（merge commit），不要 squash 或 rebase 掉官方祖先关系，否则下次同步可能重复处理同一批改动。

## 4. 验证清单

根据完整合并差异确定范围，而不是只检查自己的修改。

### 前端

在 `web/` 下执行，任何一步失败都先修复：

```bash
bun install --frozen-lockfile
bun run typecheck
bun run lint
bun run format:check
bun run test
bun run build
```

针对日常小修复可按 `web/AGENTS.md` 运行受影响文件的 lint、格式检查和相关测试；合并上游时优先跑完整前端验证。不得顺手全仓格式化来消除无关问题。

浏览器回归至少关注：桌面与手机端、首页和导航、登录注册、概览与图表、API 密钥状态筛选、渠道列表、生图台模型权限及文生图/图生图、语言切换。根据本次变更补充边界和异常场景，不在生产制造演示数据或未经确认的付费请求。

### 后端、接口与数据库

- 使用各 `go.mod` 声明的工具链，完成受影响 Go 包测试与构建；上游涉及广泛后端变动时扩大测试范围。
- 当前 Windows 开发机运行 Go 时显式设置 `$env:GOARCH='amd64'`，避免默认 386 架构导致溢出问题。
- 修改 `relaykit/` 或 `tokenkit/` 时，分别在对应模块执行 `GOWORK=off go build ./...`；PowerShell 使用 `$env:GOWORK='off'` 设置环境变量。
- 涉及认证、计费时，先遵守 `AGENTS.md` 对应专项阅读及安全验证要求。
- 涉及数据库行为时，必须验证真实 SQLite、MySQL、PostgreSQL，不能用单一数据库或 mock 代替。
- 涉及迁移时，验证新建库、代表性旧库升级和重复启动幂等性；同时检查数据、索引、约束及独立日志库受影响路径。
- 生产数据副本仅可在隔离环境验证，禁止连接生产缓存、上游渠道或触发真实任务；备份不得公开。
- 记录实际命令、数据库版本、结果与未解决项。不能把构建成功描述为“所有功能、数据库验证通过”。

## 5. 服务器发布

### 5.1 目录与服务

| 路径或服务 | 用途 |
| --- | --- |
| `/root/zifeiyu/project/new-api` | 生产仓库、Compose 配置与挂载目录 |
| `/root/zifeiyu/project/new-api-releases/<短提交号>` | 独立源码 worktree、服务器构建日志及验证记录 |
| `/root/zifeiyu/backups/new-api/<发布备份名称>` | 数据库备份、旧配置和回滚脚本 |
| `new-api` 容器 | 应用，当前宿主机端口 3001 映射到容器 3000 |
| `postgres`、`redis` 容器 | 生产数据库和缓存，不随普通应用更新重建 |

**构建目录不合并、不重命名。服务器从自建仓库拉取并构建，不上传本地编译的发布包。**

### 5.2 发布前检查

以下只用于检查和拉取引用，不会启动发布：

```bash
cd /root/zifeiyu/project/new-api
git remote -v
git branch -vv
git status --short
git fetch custom main
git rev-parse custom/main
docker inspect new-api --format '{{.Config.Image}} {{.State.Status}}'
```

必须核对 `custom/main` 的完整提交号与本地验证过的发布目标一致，不能在等待发布期间无条件采用远程最新提交。

服务器可能有合法的生产配置差异，尤其是 `docker-compose.yml`。先检查并备份，不能通过强制 checkout、reset 或清理工作区覆盖它们。保留 `docker-compose.override.yml`、服务文件、环境变量、挂载、网络、端口及日志目录；包含密钥的配置和 inspect 输出只保存在受保护的备份中。

### 5.3 发布顺序

1. 记录旧应用镜像及 revision，保留回滚镜像、生产配置和数据备份，检查磁盘及内存余量。
2. 为明确的目标提交建立干净的独立 worktree，防止把生产日志、配置、密钥和数据库放入 Docker 构建上下文。
3. 在服务器使用仓库 Dockerfile 构建带提交号的镜像，设置 revision 标签；资源紧张时顺序构建前端 builder 和完整镜像。
4. 长任务写入受保护的日志及退出码文件，允许 SSH 断开后继续。构建失败时不切换线上。
5. 按第 4 节要求完成发布前验证。把生产仓库快进到目标提交时保留部署文件；若会覆盖生产配置，先停止发布并人工整合。
6. 准备仅修改应用镜像的 Compose override，对比解析后的配置，确认没有其他非预期变化。
7. 预留短暂维护窗口，仅优雅停止 `new-api`（当前使用 150 秒超时），在停写期间保存并校验一致性数据库备份，再启动新镜像。不能用 `docker compose down` 重建整套服务。
8. 使用 `docker compose up -d --no-deps --pull never new-api` 只更新应用，不重建 PostgreSQL、Redis 或其他服务。
9. 验证成功后记录部署报告与回滚入口；清理本次临时凭据，不删除所需回滚镜像或备份。

### 5.4 上线验证与回滚

验证至少包括：

- 容器健康状态、运行镜像 revision、重启次数与启动异常。
- 本机 `/api/status` 以及公网状态、首页、登录页、相关页面和静态资源确实来自目标构建。
- 原有环境变量值、挂载、网络、端口及启动参数保持不变；比较环境变量时按键值比较，不能因为数组顺序变化误判配置变更。
- 公网探测使用与正常客户端兼容的 User-Agent，区分边缘防护的 403 与应用自身故障；不能跳过公网验证或绕过访问控制来宣称成功。
- 用户、渠道、令牌等关键数据无异常变化；日志等持续写入数据应允许正常增长。
- 未认证请求仍受到保护，相关功能完成必要的只读或受控验证。

验证失败时恢复本次备份的旧镜像配置，只重建应用并再次检查健康。**应用回滚不等于数据库回滚**：如果升级涉及不向后兼容的迁移，必须提前制定对应恢复方案；不能未经确认就用旧备份覆盖已有新数据。

不要运行 `docker compose down -v`、清空生产目录、导入本地 SQLite 或演示数据，也不要用拉取官方镜像的脚本替代定制版本发布。

## 6. 每次升级留下的记录

- 官方升级目标、合并前后提交、冲突处理及保留/替换的定制功能。
- 实际测试、浏览器检查和数据库验证结果，明确列出未通过或未执行项。
- 发布提交、镜像标签与 revision、部署时间、备份位置、回滚命令及适用条件。
- 新增配置项、迁移风险及后续跟进事项，不记录任何可用凭据。

本文件属于自建 `main` 的项目维护文档，应随二开代码维护，不能提交到纯官方镜像 `upstream-sync`。仅更新文档不需要重建或重启生产服务；文档编辑、Git 提交推送与生产发布是不同操作，按任务授权分别执行。

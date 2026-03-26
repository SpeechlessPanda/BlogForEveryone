# 本地开发运行排障清单

适用场景：`pnpm run dev` 在 Windows / PowerShell / CMD / Git Bash 环境下启动失败，或 Electron + Vite 开发链路出现端口、命令解析、残留进程问题。

## 1. 先确认依赖安装状态

- [ ] 在仓库根目录执行 `pnpm install`
- [ ] 再执行 `pnpm exec concurrently --version`
- [ ] 再执行 `pnpm exec wait-on --help`
- [ ] 如果这里都找不到命令，优先怀疑当前工作目录不对、`node_modules` 未安装，或 shell/终端复用了错误的项目环境

说明：
- `pnpm run dev` 依赖本地 `concurrently`、`wait-on`、`cross-env`、`vite`、`electron`
- 如果报 `'concurrently' is not recognized`，优先检查安装状态，不要先改 `package.json`

## 2. 再确认 5173 端口是否被旧进程占用

- [ ] 执行 `netstat -ano | findstr :5173`
- [ ] 如果看到 `LISTENING`，记录 PID
- [ ] 用 `wmic process where processid=<PID> get ProcessId,ParentProcessId,Name,CommandLine /format:list` 确认是不是旧的 `vite` / `electron` 进程
- [ ] 如果确认是残留开发进程，先结束它，再重试 `pnpm run dev`

常见现象：
- Vite 报 `Port 5173 is already in use`
- Electron 还能起，但连的是旧的 dev server
- 根因通常是上一次 dev 退出不完整，而不是当前脚本本身坏了

## 3. Windows 下结束残留进程的推荐方式

- [ ] 使用原生命令：`cmd /c taskkill /PID <PID> /T /F`
- [ ] 如果一个 `vite` 下面还挂着 `cmd.exe` / `electron.exe`，优先对父 PID 使用 `/T /F`
- [ ] 清理后再次执行 `netstat -ano | findstr :5173`，确认端口已释放

说明：
- 某些 shell 会对 `taskkill` 有包装/别名差异
- `cmd /c taskkill ...` 在当前仓库环境里更稳定

## 4. 重新启动开发链路

- [ ] 执行 `pnpm run dev`
- [ ] 期望看到 Vite 输出：`Local: http://localhost:5173/`
- [ ] Electron 随后应连接本地 dev server

以下噪音通常不是启动失败主因：
- Chromium cache 目录警告
- `Autofill.enable not found`
- DevTools 相关调试日志

## 5. 如果仍失败，按顺序缩小范围

- [ ] 先执行 `pnpm run build:renderer`，排除前端编译错误
- [ ] 再执行 `pnpm exec node --test`，排除最近代码改动引入的主流程回归
- [ ] 再回到 `pnpm run dev`

建议顺序：
1. 安装状态
2. 端口占用
3. 残留进程
4. renderer build
5. 全量 node tests

## 6. Shell 差异注意事项

- [ ] PowerShell / CMD / Git Bash 混用时，先确认当前 shell 没有覆盖 npm registry、PATH、代理、Node 环境变量
- [ ] 如果同一台机器开了多个仓库窗口，确认你在正确仓库根目录执行 `pnpm run dev`
- [ ] 如果刚切换 worktree，先在对应 worktree 目录执行一次 `pnpm install`

## 7. 当前仓库里已确认有效的手动检查

```bash
pnpm install
pnpm exec concurrently --version
netstat -ano | findstr :5173
pnpm run build:renderer
pnpm run dev
```

如果 `pnpm run dev` 成功，Vite 应输出本地地址；如果失败，优先把失败归类为：
- 安装态问题
- 残留端口问题
- renderer 编译问题

不要在证据不足时直接修改 dev 脚本。

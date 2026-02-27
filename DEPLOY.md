# 部署到 GitHub 与 Netlify

## 一、把新书架更新到 GitHub

在项目根目录（`在线书架` 文件夹）打开终端（PowerShell 或 CMD），按顺序执行：

### 1. 查看当前修改

```bash
git status
```

会看到已修改的文件（如 `index.html`、`src/main.js`、`src/storage.js`、`src/styles.css` 等）。

### 2. 添加所有修改到暂存区

```bash
git add .
```

（若只想提交部分文件，可用 `git add 文件名` 代替 `git add .`）

### 3. 提交并写说明

```bash
git commit -m "同步状态提示、数据库连接与更新结果展示"
```

`-m` 后面的引号里可以改成你自己的提交说明。

### 4. 推送到 GitHub

```bash
git push origin main
```

- 若默认分支是 `master`，则用：`git push origin master`
- 第一次推送可能要求登录 GitHub（浏览器或令牌），按提示操作即可。

---

## 二、在 Netlify 上更新部署

有两种常见情况：

### 情况 A：站点已通过「连接 GitHub 仓库」部署

1. 打开 [Netlify 控制台](https://app.netlify.com/)
2. 进入你的「书架」站点
3. 在 **Deploys** 页面可以看到：
   - 每次执行 `git push` 后，Netlify 会自动检测并开始一次新部署
   - 若没有自动部署，可点击 **Trigger deploy** → **Deploy site** 手动触发

只要完成上面的 `git push`，Netlify 一般会在 1～2 分钟内用最新代码重新部署。

### 情况 B：还没用 GitHub，是「拖拽上传」部署的

1. 先完成「一、把新书架更新到 GitHub」
2. 登录 [Netlify](https://app.netlify.com/) → **Add new site** → **Import an existing project**
3. 选择 **GitHub**，授权后选中你的书架仓库
4. 构建设置一般可保持默认：
   - **Build command**：留空
   - **Publish directory**：填 `.` 或 `/`（因为当前是静态页面，根目录就是网站根目录）
5. 点击 **Deploy site**，等待部署完成

之后每次 `git push` 到该仓库，Netlify 都会自动重新部署。

---

## 三、常用 Git 命令速查

| 操作           | 命令 |
|----------------|------|
| 查看状态       | `git status` |
| 添加所有修改   | `git add .` |
| 提交           | `git commit -m "说明"` |
| 推送到 GitHub  | `git push origin main` |
| 拉取最新代码   | `git pull origin main` |

---

## 四、注意事项

- **Supabase 密钥**：当前 `src/storage.js` 里写的是前端可用的 anon key，推送到 GitHub 是常见做法；若仓库为公开，任何人都能看到该 key，RLS 已限制权限即可。若希望完全保密 key，可改用 Netlify 环境变量 + 构建时注入，需要再改一点代码。
- **分支名**：若仓库主分支是 `master`，上面所有 `main` 改成 `master` 即可。

完成「一」后，在 Netlify 的 Deploys 里确认最新一次部署成功，即可访问线上地址查看新书架与同步状态提示。

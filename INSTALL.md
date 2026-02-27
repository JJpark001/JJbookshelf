# 「在线书架」安装与使用指引（小白版）

这份文档假设你是前端 / Git / 云服务**零基础**，只要跟着一步一步做，就能在本地打开书架，并把它放到 GitHub 和阿里云上。

---

## 一、本地打开书架（离线使用）

### 1. 准备

- 你已经有这个项目文件夹（例如）：`d:\AIAIAIAIAI\在线书架`
- 里面有这些文件：
  - `index.html`
  - `README.md`
  - `INSTALL.md`（就是本文件）
  - `src\bookModel.js`
  - `src\main.js`
  - `src\storage.js`
  - `src\styles.css`

### 2. 打开方式（最简单）

1. 打开「此电脑」，找到文件夹：`d:\AIAIAIAIAI\在线书架`
2. 在里面找到 `index.html`
3. **双击** `index.html`（或右键选择「用 Chrome 打开」）
4. 看到标题「我的书架」，右上角有「添加」按钮，就说明成功了

> 说明：当前版本所有数据都保存在浏览器的 `localStorage` 中，所以：
> - 换一台电脑 / 浏览器会是一个新的空书架
> - 清除浏览器数据会把本地记录一起清掉

---

## 二、用 Git + GitHub 管理代码

### 1. 安装 Git（只做一次）

如果你已经安装好了 **Git for Windows** 并能在命令行里看到版本（`git --version`），可以跳过本节。

1. 打开浏览器访问：<https://git-scm.com/download/win>
2. 下载并运行安装程序
3. 安装过程中的**关键选项**：
   - 默认编辑器：选 **Notepad** 或 **Visual Studio Code**
   - 默认分支名：选「Override…」，下面输入框保持 `main`
   - PATH：选「**Git from the command line and also from 3rd-party software**」
   - HTTPS：选「Use the native Windows Secure Channel library」
   - 其他选项基本保持默认，**一路 Next 到 Install**

安装完成后，打开「命令提示符（CMD）」或「PowerShell」，输入：

```bash
git --version
```

能看到类似 `git version 2.53.0.windows.1` 就说明安装成功。

### 2. 在项目里初始化 Git 仓库

1. 打开 **CMD** 或 **PowerShell**
2. 进入项目目录（注意 `/d` 表示切换到 D 盘）：

```bash
cd /d d:\AIAIAIAIAI\在线书架
```

3. 初始化仓库并做第一次提交：

```bash
git init
git add .
git commit -m "feat: bookshelf web app v4"
```

### 3. 关联到 GitHub 仓库并推送

假设已经在 GitHub 上创建好了仓库：  
`https://github.com/JJpark001/JJbookshelf`

在同一个终端窗口（仍然在 `在线书架` 目录）执行：

```bash
git remote add origin https://github.com/JJpark001/JJbookshelf.git
git branch -M main
git push -u origin main
```

首次 `git push` 可能会弹出浏览器登录 GitHub，按提示完成即可。  
完成后，刷新 GitHub 仓库页面就能看到代码。

以后每次改完代码，只需要：

```bash
cd /d d:\AIAIAIAIAI\在线书架
git add .
git commit -m "your message"
git push
```

---

## 三、部署到阿里云 OSS（静态网站）

> 前提：你已有阿里云账号，并能登录控制台。

### 1. 创建 OSS Bucket

1. 登录阿里云控制台 → 搜索「对象存储 OSS」→ 进入
2. 左侧点击 **Bucket 列表** → **创建 Bucket**
3. 基本设置：
   - Bucket 名称：例如 `jjbookshelf`（必须全局唯一）
   - 地域：例如「华东1（杭州）」——就近即可
   - 存储类型：标准存储
   - 读写权限：**公共读**
4. 创建完成后，点进这个 Bucket。

### 2. 开启静态网站托管

1. 在 Bucket 左侧找到「静态页面」或「静态网站托管」（不同控制台版本名字略有差异）
2. 开启静态网站托管：
   - 默认首页：填 `index.html`
   - 默认 404 页面：也可以填 `index.html`（交给前端处理）
3. 保存。

### 3. 上传文件

1. 进入 Bucket → 文件管理
2. 点击「上传」，把本地项目中下列内容上传到 Bucket **根目录**：
   - `index.html`
   - 整个 `src` 文件夹
3. 上传完成后，Bucket 根目录下应该能看到：

```text
/
├─ index.html
└─ src/
   ├─ bookModel.js
   ├─ main.js
   ├─ storage.js
   └─ styles.css
```

### 4. 访问你的在线书架

1. 在 Bucket 的「概览」或「静态网站」设置页面中，找到提供的访问域名（类似：  
   `http://你的bucket名.oss-地域.aliyuncs.com`）
2. 用浏览器打开这个地址，就能看到部署在阿里云上的在线书架。

> 如果后续想绑定自己的域名（如 `bookshelf.yourdomain.com`），可以在 OSS 的「域名管理」中添加自定义域名，然后在你的域名 DNS 里配置 CNAME 指向该 Bucket。

---

## 四、小白常见问题

### 1. Git 提示 “not a git repository”

说明当前目录还不是 Git 仓库，或者你不在项目目录下。  
解决：

```bash
cd /d d:\AIAIAIAIAI\在线书架
git init
git add .
git commit -m "init"
```

### 2. `git: command not found` / `不是内部或外部命令`

说明 Git 没装好或者 PATH 没配置好：

1. 再次运行 Git 安装程序
2. 在「Adjusting your PATH environment」那一步选择：
   - **Git from the command line and also from 3rd-party software**
3. 安装完成后重新打开终端，执行：

```bash
git --version
```

看到版本号就说明成功。

---

## 五、遇到问题怎么办？

遇到任何一步卡住，可以：

- 把你在终端里看到的命令和报错信息截图  
- 或复制完整报错文本  

然后发给助手（或同事），对照这份 `INSTALL.md` 就可以快速定位问题。  


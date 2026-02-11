/**
 * 应用状态（只在内存中）
 */
const appState = {
  /** @type {import("./bookModel.js").Book[]} */
  books: [],
  /** @type {string} */
  search: "",
  /** @type {"全部" | "未读" | "在读" | "已读"} */
  statusFilter: "全部",
  /** @type {"createdAt-desc" | "createdAt-asc" | "rating-desc" | "progress-desc" | "title-asc"} */
  sortKey: "createdAt-desc",
  page: 1,
  pageSize: 10,
  /** @type {string | null} */
  editingId: null,
  /** @type {"light" | "dark"} */
  theme: "light",
  /** @type {{ id: string; message: string; time: number }[]} */
  logs: [],
};

/**
 * 初始化
 */
function init() {
  const metaTheme = localStorage.getItem("my-bookshelf-theme");
  if (metaTheme === "dark" || metaTheme === "light") {
    appState.theme = metaTheme;
  } else if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    appState.theme = "dark";
  }
  document.documentElement.setAttribute("data-theme", appState.theme);

  const { books } = window.BookshelfStorage.loadBooks();
  appState.books = books;

  // 读取本地操作日志
  try {
    const rawLogs = localStorage.getItem("my-bookshelf-logs");
    if (rawLogs) {
      const parsed = JSON.parse(rawLogs);
      if (Array.isArray(parsed)) {
        appState.logs = parsed;
      }
    }
  } catch {
    appState.logs = [];
  }

  renderApp();
}

/**
 * 渲染整个应用
 */
function renderApp() {
  const root = document.getElementById("app-root");
  if (!root) return;
  root.innerHTML = "";

  const appEl = document.createElement("div");
  appEl.className = "app";

  appEl.appendChild(renderHeader());
  appEl.appendChild(renderStatsSection());
  appEl.appendChild(renderBody());

  root.appendChild(appEl);

  // 如果正在编辑或添加，渲染弹窗
  if (window.__bookModalState) {
    renderModal(window.__bookModalState.mode, window.__bookModalState.book || null);
  }
}

/**
 * 头部
 */
function renderHeader() {
  const header = document.createElement("div");
  header.className = "app-header";

  const title = document.createElement("div");
  title.className = "app-title";
  const main = document.createElement("div");
  main.className = "app-title-main";
  main.textContent = "我的书架";
  const sub = document.createElement("div");
  sub.className = "app-title-sub";
  sub.textContent = "记录每一次阅读的开始与完成";
  title.appendChild(main);
  title.appendChild(sub);

  const actions = document.createElement("div");
  actions.className = "app-actions";

  const themeBtn = document.createElement("button");
  themeBtn.className = "btn-ghost btn";
  themeBtn.innerHTML =
    appState.theme === "dark"
      ? '<span class="icon">🌙</span><span class="text-sm">暗色</span>'
      : '<span class="icon">☀️</span><span class="text-sm">浅色</span>';
  themeBtn.onclick = () => {
    appState.theme = appState.theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", appState.theme);
    localStorage.setItem("my-bookshelf-theme", appState.theme);
    renderApp();
  };

  const addBtn = document.createElement("button");
  addBtn.className = "btn";
  addBtn.innerHTML =
    '<span class="icon">＋</span><span class="text-sm">添加</span>';
  addBtn.onclick = () => {
    openBookModal("create", null);
  };

  actions.appendChild(themeBtn);
  actions.appendChild(addBtn);

  header.appendChild(title);
  header.appendChild(actions);
  return header;
}

function renderStatsSection() {
  const { total, readCount, readingCount, unreadCount, readRate, avgRating } =
    window.BookModel.computeStats(appState.books);

  const wrap = document.createElement("div");
  wrap.className = "stats-grid";

  const card1 = document.createElement("div");
  card1.className = "stat-card";
  card1.innerHTML = `
    <div class="stat-label">书籍总数</div>
    <div class="stat-value">${total}</div>
    <div class="stat-extra">未读 ${unreadCount} · 在读 ${readingCount}</div>
  `;

  const card2 = document.createElement("div");
  card2.className = "stat-card";
  card2.innerHTML = `
    <div class="stat-label">已读比例</div>
    <div class="stat-value">${readRate}%</div>
    <div class="stat-extra">已读 ${readCount} 本</div>
  `;

  const card3 = document.createElement("div");
  card3.className = "stat-card";
  const stars = "★★★★★";
  const filled = Math.round(avgRating);
  card3.innerHTML = `
    <div class="stat-label">平均评分</div>
    <div class="stat-value">${avgRating ? avgRating.toFixed(1) : "—"}</div>
    <div class="stat-extra">
      <span class="rating-stars">
        ${stars
          .split("")
          .map((s, i) =>
            i < filled
              ? '<span style="color:#fbbf24">★</span>'
              : '<span style="color:#e5e7eb">★</span>',
          )
          .join("")}
      </span>
    </div>
  `;

  wrap.appendChild(card1);
  wrap.appendChild(card2);
  wrap.appendChild(card3);
  return wrap;
}

function renderBody() {
  const layout = document.createElement("div");
  layout.className = "body-layout";

  layout.appendChild(renderBookPanel());
  layout.appendChild(renderSidePanel());

  return layout;
}

function renderBookPanel() {
  const panel = document.createElement("div");
  panel.className = "book-panel";

  // 工具栏
  const toolbar = document.createElement("div");
  toolbar.className = "book-toolbar";

  const searchInput = document.createElement("input");
  searchInput.className = "input search-input";
  searchInput.placeholder = "搜索标题、作者、标签…";
  searchInput.value = appState.search;
  searchInput.oninput = (e) => {
    // 保持输入连续性，只更新状态并重绘列表区域
    appState.search = e.target.value;
    appState.page = 1;
    rerenderBookTable(panel);
  };

  const statusSelect = document.createElement("select");
  statusSelect.className = "select";
  ["全部", "未读", "在读", "已读"].forEach((s) => {
    const opt = document.createElement("option");
    opt.value = s;
    opt.textContent = s;
    statusSelect.appendChild(opt);
  });
  statusSelect.value = appState.statusFilter;
  statusSelect.onchange = (e) => {
    appState.statusFilter = e.target.value;
    appState.page = 1;
    renderApp();
  };

  const sortSelect = document.createElement("select");
  sortSelect.className = "select";
  [
    ["createdAt-desc", "最新添加"],
    ["createdAt-asc", "最早添加"],
    ["rating-desc", "评分从高到低"],
    ["progress-desc", "进度从高到低"],
    ["title-asc", "书名 A-Z"],
  ].forEach(([value, label]) => {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = label;
    sortSelect.appendChild(opt);
  });
  sortSelect.value = appState.sortKey;
  sortSelect.onchange = (e) => {
    appState.sortKey = e.target.value;
    appState.page = 1;
    renderApp();
  };

  toolbar.appendChild(searchInput);
  toolbar.appendChild(statusSelect);
  toolbar.appendChild(sortSelect);

  panel.appendChild(toolbar);

  // 表格（单独封装，便于局部重绘）
  const tableWrap = document.createElement("div");
  tableWrap.className = "book-table-wrap";
  tableWrap.appendChild(buildBookTable());
  panel.appendChild(tableWrap);

  return panel;
}

// 重新渲染列表和分页，而不影响搜索框光标
function rerenderBookTable(panel) {
  const wrap = panel.querySelector(".book-table-wrap");
  if (!wrap) return;
  wrap.innerHTML = "";
  wrap.appendChild(buildBookTable());
}

// 构建表格和分页 DOM 片段
function buildBookTable() {
  const table = document.createElement("table");
  table.className = "book-table";

  const thead = document.createElement("thead");
  thead.innerHTML = `
    <tr>
      <th>封面</th>
      <th>书籍</th>
      <th>状态</th>
      <th>评分</th>
      <th>进度</th>
      <th>标签</th>
      <th class="text-right">操作</th>
    </tr>
  `;

  const tbody = document.createElement("tbody");
  const { pageItems, page, pageCount, total } = getPagedBooks();

  if (!pageItems.length) {
    const tr = document.createElement("tr");
    tr.innerHTML =
      '<td class="table-empty" colspan="7">还没有书籍，点击右上角“添加”开始吧。</td>';
    tbody.appendChild(tr);
  } else {
    for (const book of pageItems) {
      const tr = document.createElement("tr");
      tr.className = "book-row";

      // 封面
      const tdCover = document.createElement("td");
      const cover = document.createElement("div");
      cover.className = "cover-thumb";
      if (book.cover) {
        const img = document.createElement("img");
        img.src = book.cover;
        img.alt = book.title;
        cover.appendChild(img);
      } else {
        cover.textContent = "无封面";
      }
      tdCover.appendChild(cover);

      // 书籍
      const tdTitle = document.createElement("td");
      tdTitle.className = "book-title-cell";
      const titleEl = document.createElement("div");
      titleEl.className = "book-title clickable";
      titleEl.textContent = book.title;
      attachInlineEdit(titleEl, book, "title");
      const authorEl = document.createElement("div");
      authorEl.className = "book-author clickable";
      authorEl.textContent = book.author || " ";
      attachInlineEdit(authorEl, book, "author");
      tdTitle.appendChild(titleEl);
      tdTitle.appendChild(authorEl);

      // 状态
      const tdStatus = document.createElement("td");
      tdStatus.className = "status-cell";
      const statusPill = document.createElement("span");
      statusPill.className = "status-pill";
      statusPill.dataset.status = book.status;
      statusPill.textContent = book.status;
      tdStatus.appendChild(statusPill);

      // 评分
      const tdRating = document.createElement("td");
      const ratingDiv = document.createElement("div");
      ratingDiv.className =
        "rating-stars" + (book.rating ? "" : " muted");
      const stars = "★★★★★".split("");
      ratingDiv.innerHTML = stars
        .map((s, i) =>
          i < book.rating
            ? '<span>★</span>'
            : '<span style="color:#e5e7eb">★</span>',
        )
        .join("");
      tdRating.appendChild(ratingDiv);

      // 进度
      const tdProgress = document.createElement("td");
      const bar = document.createElement("div");
      bar.className = "progress-bar";
      const inner = document.createElement("div");
      inner.className = "progress-bar-inner";
      inner.style.width = `${book.progress}%`;
      bar.appendChild(inner);
      const text = document.createElement("div");
      text.className = "progress-text";
      if (book.totalPages > 0) {
        text.textContent = `${book.currentPage}/${book.totalPages} · ${book.progress}%`;
      } else {
        text.textContent = "未设置总页数";
      }
      tdProgress.appendChild(bar);
      tdProgress.appendChild(text);

      // 标签
      const tdTags = document.createElement("td");
      tdTags.className = "tags-cell";
      const tagList = document.createElement("div");
      tagList.className = "tag-list";
      if (book.tags.length) {
        for (const t of book.tags) {
          const span = document.createElement("span");
          span.className = "tag";
          span.textContent = t;
          tagList.appendChild(span);
        }
      } else {
        const span = document.createElement("span");
        span.className = "text-xs text-muted nowrap";
        span.textContent = "无标签";
        tagList.appendChild(span);
      }
      tdTags.appendChild(tagList);

      // 操作
      const tdActions = document.createElement("td");
      tdActions.className = "text-right actions-cell";
      const btnGroup = document.createElement("div");
      btnGroup.className = "flex gap-1 justify-between";

      const editBtn = document.createElement("button");
      editBtn.className = "btn-ghost btn";
      editBtn.style.padding = "2px 10px";
      editBtn.innerHTML = '<span class="text-xs">编辑</span>';
      editBtn.onclick = () => {
        openBookModal("edit", book);
      };

      const copyBtn = document.createElement("button");
      copyBtn.className = "btn-ghost btn";
      copyBtn.style.padding = "2px 10px";
      copyBtn.innerHTML = '<span class="text-xs">复制</span>';
      copyBtn.onclick = () => {
        const newTitle = getNextCopyTitle(book.title || "未命名书籍");
        const newBook = window.BookModel.createBook({
          ...book,
          id: undefined,
          title: newTitle,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        appState.books = [newBook, ...appState.books];
        window.BookshelfStorage.saveBooks(appState.books);
        pushLog(`复制书籍「${book.title}」为「${newBook.title}」`);
        renderApp();
      };

      const delBtn = document.createElement("button");
      delBtn.className = "btn-ghost btn";
      delBtn.style.padding = "2px 10px";
      delBtn.innerHTML = '<span class="text-xs" style="color:#dc2626">删除</span>';
      delBtn.onclick = () => {
        if (confirm(`删除「${book.title}」？`)) {
          appState.books = appState.books.filter((b) => b.id !== book.id);
          window.BookshelfStorage.saveBooks(appState.books);
          pushLog(`删除书籍「${book.title}」`);
          renderApp();
        }
      };

      btnGroup.appendChild(editBtn);
      btnGroup.appendChild(copyBtn);
      btnGroup.appendChild(delBtn);
      tdActions.appendChild(btnGroup);

      tr.appendChild(tdCover);
      tr.appendChild(tdTitle);
      tr.appendChild(tdStatus);
      tr.appendChild(tdRating);
      tr.appendChild(tdProgress);
      tr.appendChild(tdTags);
      tr.appendChild(tdActions);

      tbody.appendChild(tr);
    }
  }

  table.appendChild(thead);
  table.appendChild(tbody);
  const container = document.createElement("div");
  container.appendChild(table);

  // 分页
  if (total > 0) {
    const pagination = document.createElement("div");
    pagination.className = "pagination";

    const info = document.createElement("div");
    info.textContent = `第 ${page}/${pageCount} 页 · 共 ${total} 本`;

    const prevBtn = document.createElement("button");
    prevBtn.className = "btn-ghost btn";
    prevBtn.textContent = "上一页";
    prevBtn.disabled = page <= 1;
    prevBtn.onclick = () => {
      if (appState.page > 1) {
        appState.page--;
        renderApp();
      }
    };

    const nextBtn = document.createElement("button");
    nextBtn.className = "btn-ghost btn";
    nextBtn.textContent = "下一页";
    nextBtn.disabled = page >= pageCount;
    nextBtn.onclick = () => {
      if (appState.page < pageCount) {
        appState.page++;
        renderApp();
      }
    };

    pagination.appendChild(info);
    pagination.appendChild(prevBtn);
    pagination.appendChild(nextBtn);

    container.appendChild(pagination);
  }

  return container;
}

// 计算复制后的下一个书名，如：
// "书名" -> "书名 (2)"
// "书名 (2)" -> "书名 (3)"，以此类推
function getNextCopyTitle(originalTitle) {
  const trimmed = (originalTitle || "").trim() || "未命名书籍";
  // 匹配末尾的 " (数字)" 后缀
  const match = trimmed.match(/^(.*?)(?:\((\d+)\))?$/);
  const base = (match && match[1] ? match[1] : trimmed).trim();

  let maxIdx = 1;
  for (const b of appState.books) {
    if (!b.title) continue;
    const m = b.title.trim().match(/^(.+?)(?:\((\d+)\))?$/);
    if (!m) continue;
    const tBase = m[1].trim();
    const num = m[2] ? Number(m[2]) : 1;
    if (tBase === base && num > maxIdx) {
      maxIdx = num;
    }
  }

  const next = maxIdx + 1;
  return `${base} (${next})`;
}

// 行内编辑书名 / 作者
function attachInlineEdit(element, book, field) {
  element.addEventListener("click", () => {
    // 避免重复进入编辑状态
    if (element.dataset.editing === "true") return;
    element.dataset.editing = "true";

    const oldValue = (field === "title" ? book.title : book.author) || "";
    const input = document.createElement("input");
    input.className = "input";
    input.value = oldValue;
    input.style.width = "100%";

    // 清空原内容并挂载输入框
    element.innerHTML = "";
    element.appendChild(input);
    input.focus();
    input.select();

    const finish = (commit) => {
      if (commit) {
        const newVal = input.value.trim();
        if (newVal && newVal !== oldValue) {
          const patch =
            field === "title"
              ? { title: newVal }
              : { author: newVal };
          const updated = window.BookModel.updateBook(book, patch);
          appState.books = appState.books.map((b) =>
            b.id === book.id ? updated : b,
          );
          window.BookshelfStorage.saveBooks(appState.books);
          const label = field === "title" ? "书名" : "作者";
          pushLog(`修改「${label}」为「${newVal}」（书籍：${updated.title}）`);
        }
      }
      element.dataset.editing = "false";
      // 完成后整体刷新界面以保持视图一致
      renderApp();
    };

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        finish(true);
      } else if (e.key === "Escape") {
        e.preventDefault();
        finish(false);
      }
    });

    input.addEventListener("blur", () => finish(true));
  });
}

// 记录用户操作日志
function pushLog(message) {
  const entry = {
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    message,
    time: Date.now(),
  };
  appState.logs = [entry, ...appState.logs].slice(0, 50);
  try {
    localStorage.setItem("my-bookshelf-logs", JSON.stringify(appState.logs));
  } catch {
    // 忽略写入失败
  }
}

function renderSidePanel() {
  const side = document.createElement("div");
  side.className = "side-panel";

  // 简单状态概览
  const statusCard = document.createElement("div");
  statusCard.className = "card";
  statusCard.innerHTML = `
    <div class="card-header">
      <div class="card-title">阅读状态</div>
    </div>
  `;
  const body = document.createElement("div");
  const { readCount, readingCount, unreadCount } = window.BookModel.computeStats(
    appState.books,
  );
  body.innerHTML = `
    <div class="chip-row mt-1">
      <span class="chip">未读 ${unreadCount}</span>
      <span class="chip">在读 ${readingCount}</span>
      <span class="chip">已读 ${readCount}</span>
    </div>
  `;
  statusCard.appendChild(body);

  // 未来扩展区域：阅读日历、标签云等
  const hintCard = document.createElement("div");
  hintCard.className = "card";
  hintCard.innerHTML = `
    <div class="card-header">
      <div>
        <div class="card-title">小提示</div>
        <div class="card-subtitle">本版本已做数据结构标准化与迁移</div>
      </div>
    </div>
    <div class="text-xs text-muted">
      - 所有书籍都采用统一 Book 模型。<br />
      - 支持从旧 localStorage 自动迁移。<br />
      - 后续可扩展阅读日历、批量操作等功能。
    </div>
  `;

  side.appendChild(statusCard);
  side.appendChild(hintCard);

  // 最近操作日志
  const logCard = document.createElement("div");
  logCard.className = "card";
  const logHeader = document.createElement("div");
  logHeader.className = "card-header";
  logHeader.innerHTML = `
    <div>
      <div class="card-title">最近操作</div>
      <div class="card-subtitle">仅保留最近 20 条</div>
    </div>
  `;
  const logBody = document.createElement("div");
  logBody.className = "text-xs text-muted";

  if (!appState.logs.length) {
    logBody.textContent = "暂无操作记录。";
  } else {
    const list = document.createElement("div");
    list.className = "log-list";
    const logsToShow = appState.logs
      .slice()
      .sort((a, b) => b.time - a.time)
      .slice(0, 10);
    for (const item of logsToShow) {
      const row = document.createElement("div");
      row.className = "log-item";
      const date = new Date(item.time);
      const timeText = `${String(date.getHours()).padStart(2, "0")}:${String(
        date.getMinutes(),
      ).padStart(2, "0")}`;
      row.textContent = `[${timeText}] ${item.message}`;
      list.appendChild(row);
    }
    logBody.appendChild(list);
  }

  logCard.appendChild(logHeader);
  logCard.appendChild(logBody);

  side.appendChild(logCard);
  return side;
}

/**
 * @returns {{ pageItems: import("./bookModel.js").Book[]; page: number; pageCount: number; total: number }}
 */
function getPagedBooks() {
  let items = [...appState.books];

  if (appState.search) {
    const keyword = appState.search.toLowerCase();
    items = items.filter((b) => {
      const inTitle = (b.title || "").toLowerCase().includes(keyword);
      const inAuthor = (b.author || "").toLowerCase().includes(keyword);
      const inTags = (b.tags || [])
        .join(" ")
        .toLowerCase()
        .includes(keyword);
      return inTitle || inAuthor || inTags;
    });
  }

  if (appState.statusFilter !== "全部") {
    items = items.filter((b) => b.status === appState.statusFilter);
  }

  // 排序
  const key = appState.sortKey;
  items.sort((a, b) => {
    switch (key) {
      case "createdAt-asc":
        return a.createdAt - b.createdAt;
      case "rating-desc":
        return (b.rating || 0) - (a.rating || 0);
      case "progress-desc":
        return (b.progress || 0) - (a.progress || 0);
      case "title-asc":
        return (a.title || "").localeCompare(b.title || "", "zh-Hans-CN");
      case "createdAt-desc":
      default:
        return b.createdAt - a.createdAt;
    }
  });

  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / appState.pageSize));
  const page = Math.min(appState.page, pageCount);
  const start = (page - 1) * appState.pageSize;
  const end = start + appState.pageSize;
  const pageItems = items.slice(start, end);
  return { pageItems, page, pageCount, total };
}

// -------------- 弹窗及表单 ----------------

/**
 * @typedef {"create" | "edit"} BookModalMode
 */

/**
 * @typedef {{ mode: BookModalMode; book: import("./bookModel.js").Book | null }} BookModalState
 */

/**
 * 保存在 window 上，避免频繁传参
 * @type {BookModalState | null}
 */
window.__bookModalState = null;

/**
 * @param {BookModalMode} mode
 * @param {import("./bookModel.js").Book | null} book
 */
function openBookModal(mode, book) {
  window.__bookModalState = { mode, book };
  renderModal(mode, book);
}

function closeBookModal() {
  window.__bookModalState = null;
  const existed = document.querySelector(".modal-backdrop");
  if (existed && existed.parentElement) {
    existed.parentElement.removeChild(existed);
  }
}

/**
 * @param {BookModalMode} mode
 * @param {import("./bookModel.js").Book | null} book
 */
function renderModal(mode, book) {
  const existed = document.querySelector(".modal-backdrop");
  if (existed && existed.parentElement) {
    existed.parentElement.removeChild(existed);
  }

  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.onclick = (e) => {
    if (e.target === backdrop) {
      closeBookModal();
    }
  };

  const modal = document.createElement("div");
  modal.className = "modal";

  const header = document.createElement("div");
  header.className = "modal-header";
  const hTitle = document.createElement("div");
  hTitle.className = "card-title";
  hTitle.textContent = mode === "create" ? "添加书籍" : "编辑书籍";
  const closeBtn = document.createElement("button");
  closeBtn.className = "btn-ghost btn";
  closeBtn.style.padding = "4px 8px";
  closeBtn.textContent = "✕";
  closeBtn.onclick = () => closeBookModal();
  header.appendChild(hTitle);
  header.appendChild(closeBtn);

  const body = document.createElement("div");
  body.className = "modal-body";

  // 表单结构
  const form = document.createElement("form");
  form.className = "form-grid";
  form.onsubmit = (e) => {
    e.preventDefault();
  };

  // 左侧：基础信息
  const left = document.createElement("div");
  left.className = "form-section";

  // 标题
  const titleField = createInputField(
    "书名",
    "必填",
    "text",
    book ? book.title : "",
  );
  titleField.input.required = true;

  // 作者
  const authorField = createInputField(
    "作者",
    "",
    "text",
    book ? book.author : "",
  );

  // 状态
  const statusField = document.createElement("div");
  statusField.className = "form-field";
  const statusLabelRow = document.createElement("div");
  statusLabelRow.className = "form-label-row";
  const statusLabel = document.createElement("div");
  statusLabel.className = "form-label";
  statusLabel.textContent = "阅读状态";
  const statusHint = document.createElement("div");
  statusHint.className = "form-label-hint";
  statusHint.textContent = "可随时在列表中调整";
  statusLabelRow.appendChild(statusLabel);
  statusLabelRow.appendChild(statusHint);

  const statusSelect = document.createElement("select");
  statusSelect.className = "select";
  ["未读", "在读", "已读"].forEach((s) => {
    const opt = document.createElement("option");
    opt.value = s;
    opt.textContent = s;
    statusSelect.appendChild(opt);
  });
  statusSelect.value = book ? book.status : "未读";

  statusField.appendChild(statusLabelRow);
  statusField.appendChild(statusSelect);

  // 标签
  const tagField = document.createElement("div");
  tagField.className = "form-field";
  const tagLabelRow = document.createElement("div");
  tagLabelRow.className = "form-label-row";
  const tagLabel = document.createElement("div");
  tagLabel.className = "form-label";
  tagLabel.textContent = "标签";
  const tagHint = document.createElement("div");
  tagHint.className = "form-label-hint";
  tagHint.textContent = "用逗号或空格分隔，如：技术, 心理, 小说";
  tagLabelRow.appendChild(tagLabel);
  tagLabelRow.appendChild(tagHint);

  const tagInput = document.createElement("textarea");
  tagInput.className = "textarea";
  tagInput.placeholder = "例如：技术, 心理, 小说";
  tagInput.value = book ? book.tags.join(" ") : "";

  tagField.appendChild(tagLabelRow);
  tagField.appendChild(tagInput);

  left.appendChild(titleField.wrapper);
  left.appendChild(authorField.wrapper);
  left.appendChild(statusField);
  left.appendChild(tagField);

  // 右侧：封面 & 评分 & 进度
  const right = document.createElement("div");
  right.className = "form-section";

  // 封面
  const coverField = document.createElement("div");
  coverField.className = "form-field";
  const coverLabelRow = document.createElement("div");
  coverLabelRow.className = "form-label-row";
  const coverLabel = document.createElement("div");
  coverLabel.className = "form-label";
  coverLabel.textContent = "封面";
  const coverHint = document.createElement("div");
  coverHint.className = "form-label-hint";
  coverHint.textContent = "支持图片 URL 或本地上传";
  coverLabelRow.appendChild(coverLabel);
  coverLabelRow.appendChild(coverHint);

  const coverPreview = document.createElement("div");
  coverPreview.className = "cover-preview";
  let coverValue = book && book.cover ? book.cover : "";
  updateCoverPreview(coverPreview, coverValue, book ? book.title : "");

  const coverUrlInput = document.createElement("input");
  coverUrlInput.className = "input";
  coverUrlInput.placeholder = "图片 URL（可选）";
  coverUrlInput.value = coverValue;
  coverUrlInput.onblur = () => {
    coverValue = coverUrlInput.value.trim();
    updateCoverPreview(coverPreview, coverValue, titleField.input.value);
  };

  const uploadRow = document.createElement("div");
  uploadRow.className = "flex gap-2 mt-1";
  const uploadInput = document.createElement("input");
  uploadInput.type = "file";
  uploadInput.accept = "image/*";
  uploadInput.style.fontSize = "11px";
  uploadInput.onchange = () => {
    const file = uploadInput.files && uploadInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        coverValue = reader.result;
        coverUrlInput.value = coverValue;
        updateCoverPreview(coverPreview, coverValue, titleField.input.value);
      }
    };
    reader.readAsDataURL(file);
  };
  uploadRow.appendChild(uploadInput);

  coverField.appendChild(coverLabelRow);
  coverField.appendChild(coverPreview);
  coverField.appendChild(coverUrlInput);
  coverField.appendChild(uploadRow);

  // 评分
  const ratingField = document.createElement("div");
  ratingField.className = "form-field";
  const ratingLabelRow = document.createElement("div");
  ratingLabelRow.className = "form-label-row";
  const ratingLabel = document.createElement("div");
  ratingLabel.className = "form-label";
  ratingLabel.textContent = "评分";
  const ratingHint = document.createElement("div");
  ratingHint.className = "form-label-hint";
  ratingHint.textContent = "可不填，后续在列表中调整";
  ratingLabelRow.appendChild(ratingLabel);
  ratingLabelRow.appendChild(ratingHint);

  const starInput = document.createElement("div");
  starInput.className = "star-input";
  let ratingValue = book ? book.rating : 0;
  const starSpans = [];
  for (let i = 1; i <= 5; i++) {
    const span = document.createElement("span");
    span.textContent = "★";
    span.dataset.active = i <= ratingValue ? "true" : "false";
    span.onclick = () => {
      ratingValue = ratingValue === i ? 0 : i;
      starSpans.forEach((s, idx) => {
        s.dataset.active = idx + 1 <= ratingValue ? "true" : "false";
      });
    };
    starSpans.push(span);
    starInput.appendChild(span);
  }

  ratingField.appendChild(ratingLabelRow);
  ratingField.appendChild(starInput);

  // 进度
  const progressField = document.createElement("div");
  progressField.className = "form-field";
  const progressLabelRow = document.createElement("div");
  progressLabelRow.className = "form-label-row";
  const progressLabel = document.createElement("div");
  progressLabel.className = "form-label";
  progressLabel.textContent = "阅读进度";
  const progressHint = document.createElement("div");
  progressHint.className = "form-label-hint";
  progressHint.textContent = "填写当前页与总页数，系统自动计算百分比";
  progressLabelRow.appendChild(progressLabel);
  progressLabelRow.appendChild(progressHint);

  const pgRow = document.createElement("div");
  pgRow.className = "flex gap-2";
  const currentInput = document.createElement("input");
  currentInput.className = "input";
  currentInput.type = "number";
  currentInput.min = "0";
  currentInput.placeholder = "当前页";
  currentInput.value = book ? String(book.currentPage || 0) : "";

  const totalInput = document.createElement("input");
  totalInput.className = "input";
  totalInput.type = "number";
  totalInput.min = "0";
  totalInput.placeholder = "总页数";
  totalInput.value = book ? String(book.totalPages || 0) : "";

  const percentText = document.createElement("div");
  percentText.className = "text-xs text-muted mt-1";
  function updatePercentText() {
    const c = Number(currentInput.value || 0);
    const t = Number(totalInput.value || 0);
    const p = window.BookModel.computeProgress(c, t);
    if (t > 0) {
      percentText.textContent = `当前进度约 ${p}%`;
    } else {
      percentText.textContent = "未设置总页数时，不会显示进度条百分比";
    }
  }
  currentInput.oninput = updatePercentText;
  totalInput.oninput = updatePercentText;
  updatePercentText();

  pgRow.appendChild(currentInput);
  pgRow.appendChild(totalInput);

  progressField.appendChild(progressLabelRow);
  progressField.appendChild(pgRow);
  progressField.appendChild(percentText);

  right.appendChild(coverField);
  right.appendChild(ratingField);
  right.appendChild(progressField);

  form.appendChild(left);
  form.appendChild(right);

  body.appendChild(form);

  const footer = document.createElement("div");
  footer.className = "modal-footer";
  const cancelBtn = document.createElement("button");
  cancelBtn.className = "btn-ghost btn";
  cancelBtn.textContent = "取消";
  cancelBtn.onclick = () => closeBookModal();

  const okBtn = document.createElement("button");
  okBtn.className = "btn";
  okBtn.textContent = mode === "create" ? "添加" : "保存";
  okBtn.onclick = () => {
    const errors = [];
    if (!titleField.input.value.trim()) {
      errors.push("书名为必填项");
    }
    const current = Number(currentInput.value || 0);
    const total = Number(totalInput.value || 0);
    if (current < 0 || total < 0) {
      errors.push("页数不能为负数");
    }
    if (total && current > total) {
      errors.push("当前页不能大于总页数");
    }
    if (errors.length) {
      alert(errors.join("\n"));
      return;
    }

    const tags = parseTags(tagInput.value);

    const raw = {
      title: titleField.input.value,
      author: authorField.input.value,
      cover: coverValue,
      status: /** @type {import("./bookModel.js").Book["status"]} */ (
        statusSelect.value
      ),
      tags,
      rating: /** @type {import("./bookModel.js").Book["rating"]} */ (
        ratingValue
      ),
      currentPage: current,
      totalPages: total,
    };

    if (mode === "create") {
      const book = window.BookModel.createBook(raw);
      appState.books = [book, ...appState.books];
      pushLog(`添加书籍「${book.title}」`);
    } else if (mode === "edit" && book) {
      const updated = window.BookModel.updateBook(book, raw);
      appState.books = appState.books.map((b) =>
        b.id === book.id ? updated : b,
      );
      pushLog(`编辑书籍「${updated.title}」`);
    }

    window.BookshelfStorage.saveBooks(appState.books);
    closeBookModal();
    renderApp();
  };

  footer.appendChild(cancelBtn);
  footer.appendChild(okBtn);

  modal.appendChild(header);
  modal.appendChild(body);
  modal.appendChild(footer);

  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);
}

function createInputField(label, hint, type, value) {
  const wrapper = document.createElement("div");
  wrapper.className = "form-field";
  const labelRow = document.createElement("div");
  labelRow.className = "form-label-row";
  const labelEl = document.createElement("div");
  labelEl.className = "form-label";
  labelEl.textContent = label;
  const hintEl = document.createElement("div");
  hintEl.className = "form-label-hint";
  hintEl.textContent = hint;
  labelRow.appendChild(labelEl);
  labelRow.appendChild(hintEl);
  const input = document.createElement("input");
  input.className = "input";
  input.type = type;
  input.value = value || "";
  wrapper.appendChild(labelRow);
  wrapper.appendChild(input);
  return { wrapper, input };
}

function updateCoverPreview(container, src, title) {
  container.innerHTML = "";
  if (src) {
    const img = document.createElement("img");
    img.src = src;
    img.alt = title || "封面";
    container.appendChild(img);
  } else {
    container.textContent = "无封面";
  }
}

function parseTags(raw) {
  if (!raw) return [];
  return raw
    .split(/[,，\s]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

// 供简单测试使用
window.__bookshelfDebug = {
  appState,
  BookModel: window.BookModel,
  BookshelfStorage: window.BookshelfStorage,
};

window.addEventListener("DOMContentLoaded", init);

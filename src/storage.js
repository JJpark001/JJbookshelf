const STORAGE_KEY = "my-bookshelf-books";
const META_KEY = "my-bookshelf-meta";

// Supabase 配置（使用你的项目 URL 和 anon key）
const SUPABASE_URL = "https://quwcathfmcsyimbrfeyl.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1d2NhdGhmbWNzeWltYnJmZXlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxODI1MjMsImV4cCI6MjA4Nzc1ODUyM30.HKn1LFdiyvWgxKKyk5LHpAX24L4YbHfggkKodYqN8ZU";

// Supabase 客户端
let supabaseClient = null;
if (window.supabase && SUPABASE_URL && SUPABASE_KEY) {
  supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY,
  );
}

/**
 * @typedef {Object} StoragePayload
 * @property {number} version
 * @property {any[]} items
 */

/**
 * 加载并迁移本地存储数据（原有本地方案）
 * @returns {{ books: import("./bookModel.js").Book[], version: number }}
 */
function loadBooks() {
  const DATA_VERSION = window.BookModel.DATA_VERSION;

  if (typeof localStorage === "undefined") {
    return { books: [], version: DATA_VERSION };
  }
  /** @type {StoragePayload | null} */
  let payload = null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      payload = JSON.parse(raw);
    }
  } catch {
    payload = null;
  }

  let version = DATA_VERSION;
  /** @type {any[]} */
  let items = [];

  if (payload && typeof payload === "object") {
    version =
      typeof payload.version === "number" && payload.version > 0
        ? payload.version
        : 1;
    if (Array.isArray(payload.items)) {
      items = payload.items;
    }
  } else {
    // 兼容旧版本只存数组的情况
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const maybeArr = JSON.parse(raw);
        if (Array.isArray(maybeArr)) {
          items = maybeArr;
        }
      }
    } catch {
      items = [];
    }
  }

  const books = items
    .map((x) => window.BookModel.migrateBook(x))
    .filter((b) => b !== null);

  persistMeta({ lastLoadedAt: Date.now(), count: books.length });

  return { books, version };
}

/**
 * 从 Supabase 拉取书籍列表
 * @returns {Promise<{ books: import("./bookModel.js").Book[]; version: number; loadStatus: "success" | "failed" | "offline" }>}
 */
async function loadBooksFromSupabase() {
  const DATA_VERSION = window.BookModel.DATA_VERSION;

  if (!supabaseClient) {
    const local = loadBooks();
    return { ...local, loadStatus: "offline" };
  }

  const { data, error } = await supabaseClient
    .from("books")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("从 Supabase 加载失败，退回本地数据", error);
    const local = loadBooks();
    return { ...local, loadStatus: "failed" };
  }

  const books = (data || [])
    .map((row) => {
      // tags 在表里是 text，我们兼容字符串和数组两种情况
      let tags = row.tags;
      if (Array.isArray(tags)) {
        // do nothing
      } else if (typeof tags === "string" && tags.trim()) {
        tags = tags
          .split(/[,，\s]+/)
          .map((x) => x.trim())
          .filter(Boolean);
      } else {
        tags = [];
      }

      return window.BookModel.migrateBook({
        ...row,
        tags,
        currentPage: row.current_page ?? row.currentPage,
        totalPages: row.total_pages ?? row.totalPages,
      });
    })
    .filter((b) => b !== null);

  // 拉取成功后，同步一份到本地，方便离线使用（不等待同步结果，仅本地）
  const payload = {
    version: DATA_VERSION,
    items: books,
  };
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      persistMeta({ lastLoadedAt: Date.now(), count: books.length });
    } catch (err) {
      console.error("保存书架到本地失败", err);
    }
  }

  return { books, version: DATA_VERSION, loadStatus: "success" };
}

/**
 * 保存数据到 localStorage，并同步到 Supabase
 * @param {import("./bookModel.js").Book[]} books
 * @returns {Promise<{ syncStatus: "success" | "failed" | "offline" }>}
 */
async function saveBooks(books) {
  const DATA_VERSION = window.BookModel.DATA_VERSION;

  if (typeof localStorage !== "undefined") {
    /** @type {StoragePayload} */
    const payload = {
      version: DATA_VERSION,
      items: books,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      persistMeta({ lastSavedAt: Date.now(), count: books.length });
    } catch (err) {
      console.error("保存书架失败", err);
    }
  }

  if (!supabaseClient) {
    return { syncStatus: "offline" };
  }

  const result = await syncBooksToSupabase(books);
  return {
    syncStatus: result.ok ? "success" : "failed",
  };
}

/**
 * 把当前 books 全量同步到 Supabase 的 books 表
 * （简单做法：先删再插，适合个人项目）
 * @param {import("./bookModel.js").Book[]} books
 * @returns {Promise<{ ok: boolean }>}
 */
async function syncBooksToSupabase(books) {
  if (!supabaseClient) return { ok: false };

  const { error: delError } = await supabaseClient
    .from("books")
    .delete()
    .neq("id", "");
  if (delError) {
    console.error("删除远程旧数据失败", delError);
    return { ok: false };
  }

  if (!books.length) return { ok: true };

  const rows = books.map((b) => ({
    id: b.id,
    title: b.title,
    author: b.author,
    cover: b.cover,
    status: b.status,
    tags: Array.isArray(b.tags) ? b.tags.join(",") : "",
    rating: b.rating,
    current_page: b.currentPage,
    total_pages: b.totalPages,
    progress: b.progress,
    created_at: new Date(b.createdAt).toISOString(),
    updated_at: new Date(b.updatedAt).toISOString(),
  }));

  const { error: insError } = await supabaseClient
    .from("books")
    .insert(rows);
  if (insError) {
    console.error("插入远程数据失败", insError);
    return { ok: false };
  }
  return { ok: true };
}

/**
 * @param {{ lastLoadedAt?: number; lastSavedAt?: number; count?: number }} patch
 */
function persistMeta(patch) {
  if (typeof localStorage === "undefined") return;
  let meta = {};
  try {
    const raw = localStorage.getItem(META_KEY);
    if (raw) meta = JSON.parse(raw) || {};
  } catch {
    meta = {};
  }
  const next = { ...meta, ...patch };
  try {
    localStorage.setItem(META_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

// 暴露到全局，供主应用使用
window.BookshelfStorage = {
  loadBooks,
  saveBooks,
  loadBooksFromSupabase,
};

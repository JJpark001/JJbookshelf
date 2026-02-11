const STORAGE_KEY = "my-bookshelf-books";
const META_KEY = "my-bookshelf-meta";

/**
 * @typedef {Object} StoragePayload
 * @property {number} version
 * @property {any[]} items
 */

/**
 * 加载并迁移本地存储数据
 * @returns {{ books: import("./bookModel.js").Book[], version: number }}
 */
function loadBooks() {
  if (typeof localStorage === "undefined") {
    return { books: [], version: window.BookModel.DATA_VERSION };
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

  let version = window.BookModel.DATA_VERSION;
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
 * 保存数据到 localStorage
 * @param {import("./bookModel.js").Book[]} books
 */
function saveBooks(books) {
  if (typeof localStorage === "undefined") return;
  /** @type {StoragePayload} */
  const payload = {
    version: window.BookModel.DATA_VERSION,
    items: books,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    persistMeta({ lastSavedAt: Date.now(), count: books.length });
  } catch (err) {
    console.error("保存书架失败", err);
  }
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
};

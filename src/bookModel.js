/**
 * @typedef {"未读" | "在读" | "已读"} BookStatus
 */

/**
 * @typedef {0 | 1 | 2 | 3 | 4 | 5} BookRating
 */

/**
 * @typedef {Object} Book
 * @property {string} id
 * @property {string} title
 * @property {string} author
 * @property {string} cover // url or base64
 * @property {BookStatus} status
 * @property {string[]} tags
 * @property {BookRating} rating
 * @property {number} currentPage
 * @property {number} totalPages
 * @property {number} progress
 * @property {number} createdAt
 * @property {number} updatedAt
 */

// 不再使用 ES Module，在浏览器中挂到 window.BookModel
const DATA_VERSION = 1;

/**
 * 计算进度，返回 0-100 的整数
 * @param {number} current
 * @param {number} total
 */
function computeProgress(current, total) {
  if (!total || total <= 0) return 0;
  if (current <= 0) return 0;
  if (current >= total) return 100;
  return Math.round((current / total) * 100);
}

/**
 * 创建标准化的 Book 对象
 * @param {Partial<Book>} raw
 * @returns {Book}
 */
function createBook(raw) {
  const now = Date.now();
  const totalPages = safeInt(raw.totalPages, 0);
  const currentPage = Math.min(
    safeInt(raw.currentPage, 0),
    Math.max(totalPages, 0),
  );

  const progress =
    typeof raw.progress === "number"
      ? clamp(Math.round(raw.progress), 0, 100)
      : computeProgress(currentPage, totalPages);

  return {
    id: raw.id || generateId(),
    title: (raw.title || "").trim() || "未命名书籍",
    author: (raw.author || "").trim() || " ",
    cover: raw.cover || "",
    status: normalizeStatus(raw.status),
    tags: Array.isArray(raw.tags)
      ? raw.tags.map((t) => String(t).trim()).filter(Boolean)
      : [],
    rating: normalizeRating(raw.rating),
    currentPage,
    totalPages,
    progress,
    createdAt: typeof raw.createdAt === "number" ? raw.createdAt : now,
    updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : now,
  };
}

/**
 * 对历史书籍数据做迁移与修复
 * @param {any} raw
 * @returns {Book | null}
 */
function migrateBook(raw) {
  if (!raw || typeof raw !== "object") return null;
  try {
    return createBook(raw);
  } catch {
    return null;
  }
}

/**
 * 复制并更新部分字段
 * @param {Book} book
 * @param {Partial<Book>} patch
 * @returns {Book}
 */
function updateBook(book, patch) {
  const merged = { ...book, ...patch };
  // 不继承旧的 progress 字段，统一按当前页/总页数重新计算
  const { progress: _ignoreProgress, ...rest } = merged;
  return createBook({
    ...rest,
    id: book.id,
    createdAt: book.createdAt,
    updatedAt: Date.now(),
  });
}

/**
 * 简单的统计
 * @param {Book[]} books
 */
function computeStats(books) {
  const total = books.length;
  if (!total) {
    return {
      total: 0,
      readCount: 0,
      readingCount: 0,
      unreadCount: 0,
      readRate: 0,
      avgRating: 0,
    };
  }
  let readCount = 0;
  let readingCount = 0;
  let ratingSum = 0;
  let ratingCount = 0;
  for (const b of books) {
    if (b.status === "已读") readCount++;
    if (b.status === "在读") readingCount++;
    if (b.rating && b.rating > 0) {
      ratingSum += b.rating;
      ratingCount++;
    }
  }
  const unreadCount = total - readCount - readingCount;
  return {
    total,
    readCount,
    readingCount,
    unreadCount,
    readRate: total ? Math.round((readCount / total) * 100) : 0,
    avgRating: ratingCount ? ratingSum / ratingCount : 0,
  };
}

function generateId() {
  return (
    "b_" +
    Date.now().toString(36) +
    "_" +
    Math.random().toString(36).slice(2, 8)
  );
}

function safeInt(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.floor(n);
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

/**
 * @param {any} status
 * @returns {BookStatus}
 */
function normalizeStatus(status) {
  if (status === "在读" || status === "已读" || status === "未读") {
    return status;
  }
  return "未读";
}

/**
 * @param {any} rating
 * @returns {BookRating}
 */
function normalizeRating(rating) {
  const n = Number(rating);
  if (!Number.isFinite(n)) return 0;
  const r = Math.round(clamp(n, 0, 5));
  return /** @type {BookRating} */ (r);
}

// 暴露到全局，供其他脚本使用
window.BookModel = {
  DATA_VERSION,
  computeProgress,
  createBook,
  migrateBook,
  updateBook,
  computeStats,
};

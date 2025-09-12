function parsePagination(query) {
  const page = Math.max(1, parseInt(query.page ?? '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize ?? '10', 10)));
  const offset = (page - 1) * pageSize;
  return { page, pageSize, offset };
}

module.exports = { parsePagination };

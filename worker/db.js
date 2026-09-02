// worker/db.js
// Cloudflare D1 异步数据访问辅助层
// D1 的 SQL 语法与 SQLite 兼容，主要差异：
//   - 所有操作都是异步（返回 Promise）
//   - 通过 env.DB.prepare(sql).bind(...params) 构造语句
//   - .first() / .all() / .run() 分别取首行 / 多行 / 执行写操作
//   - .bind() 不接受 undefined，需转成 null
//   - 事务用 env.DB.batch([...])

// 将 undefined 转为 null（D1 bind 不支持 undefined）
export function bindParams(params) {
  return params.map(p => (p === undefined ? null : p))
}

// 取首行（无则返回 null）
export async function first(env, sql, ...params) {
  return await env.DB.prepare(sql).bind(...bindParams(params)).first()
}

// 取多行（返回数组）
export async function all(env, sql, ...params) {
  const { results } = await env.DB.prepare(sql).bind(...bindParams(params)).all()
  return results
}

// 执行写操作（INSERT/UPDATE/DELETE），返回 D1Result
export async function run(env, sql, ...params) {
  return await env.DB.prepare(sql).bind(...bindParams(params)).run()
}

// 返回最近插入的自增主键
export function lastRowId(result) {
  return result.meta.last_row_id
}

// worker/auth-util.js
// 用户隔离的安全基础：
//   1) 密码哈希（PBKDF2-SHA256，随机盐）——仅存哈希，不存明文
//   2) 会话令牌签发 / 校验——通过服务端 sessions 表识别"当前登录用户"，
//      彻底取代客户端自报 user_id 的不可信模型
import { first, run } from './db.js'

const enc = new TextEncoder()
const PBKDF2_ITERATIONS = 100000
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 天
// 在线状态：活跃时间戳写入节流间隔（避免每次请求都写库）
const ACTIVE_THROTTLE_MS = 45 * 1000

function hex(bytes) {
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
}
function hexToBytes(hexStr) {
  const a = new Uint8Array(hexStr.length / 2)
  for (let i = 0; i < a.length; i++) a[i] = parseInt(hexStr.substr(i * 2, 2), 16)
  return a
}
function bytesToBase64Url(bytes) {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function randomBytes(n) {
  const a = new Uint8Array(n)
  crypto.getRandomValues(a)
  return a
}

async function pbkdf2(password, saltHex) {
  const salt = hexToBytes(saltHex)
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    256
  )
  return hex(new Uint8Array(bits))
}

// 生成密码哈希，存储格式：pbkdf2$<saltHex>$<hashHex>
export async function hashPassword(password) {
  const salt = randomBytes(16)
  const hash = await pbkdf2(String(password), hex(salt))
  return `pbkdf2$${hex(salt)}$${hash}`
}

// 校验密码（常量时间比较，防时序攻击）
export async function verifyPassword(password, stored) {
  if (!stored || typeof stored !== 'string') return false
  const parts = stored.split('$')
  if (parts.length !== 3 || parts[0] !== 'pbkdf2') return false
  const calc = await pbkdf2(String(password), parts[1])
  const expected = parts[2]
  if (calc.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < calc.length; i++) diff |= calc.charCodeAt(i) ^ expected.charCodeAt(i)
  return diff === 0
}

// 生成随机会话令牌并写入 sessions 表，返回 token
export async function createSession(env, userId) {
  const token = bytesToBase64Url(randomBytes(32))
  const now = Date.now()
  await run(
    env,
    'INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?,?,?,?)',
    token,
    userId,
    new Date(now).toISOString(),
    new Date(now + SESSION_TTL_MS).toISOString()
  )
  return token
}

// 刷新用户最近活跃时间（在线状态），带节流：仅当上次活跃早于阈值时才写库
// 这样受保护的接口每次请求都调用也不会造成频繁写库
export async function touchActive(env, userId) {
  const now = new Date().toISOString()
  const cutoff = new Date(Date.now() - ACTIVE_THROTTLE_MS).toISOString()
  await run(
    env,
    'UPDATE users SET last_active_at = ? WHERE id = ? AND (last_active_at IS NULL OR last_active_at < ?)',
    now,
    userId,
    cutoff
  )
}

// 从请求 Authorization: Bearer <token> 解析当前登录用户；无效/过期返回 null
// 校验通过后顺便刷新该用户的在线活跃时间（任何登录态请求都会更新在线状态）
export async function currentUser(env, c) {
  const header = c.req.header('authorization') || ''
  if (!header.startsWith('Bearer ')) return null
  const token = header.slice(7).trim()
  if (!token) return null
  const s = await first(
    env,
    'SELECT * FROM sessions WHERE token = ? AND expires_at > ?',
    token,
    new Date().toISOString()
  )
  if (!s) return null
  const user = await first(
    env,
    'SELECT id, group_name, game_name, game_uid, created_at, last_active_at, is_admin FROM users WHERE id = ?',
    s.user_id
  )
  if (user) await touchActive(env, user.id)
  return user
}

// 返回当前登录用户，且必须是管理员（is_admin=1），否则返回 null
// 用于后台接口的前置鉴权
// eslint-disable-next-line no-unused-vars
export async function currentAdmin(env, c) {
  const user = await currentUser(env, c)
  if (user && Number(user.is_admin) === 1) return user
  return null
}

// 删除当前请求对应的会话（登出）
export async function deleteSession(env, c) {
  const header = c.req.header('authorization') || ''
  if (!header.startsWith('Bearer ')) return
  const token = header.slice(7).trim()
  if (token) await run(env, 'DELETE FROM sessions WHERE token = ?', token)
}

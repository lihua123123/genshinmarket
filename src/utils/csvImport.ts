// CSV 解析工具：使用原生 FileReader / 字符串处理实现
export interface CsvRow {
  category: string
  item_name: string
  quantity: number
}

// 解析 CSV 文本，格式：类别,道具名称,数量
export function parseCSV(text: string): CsvRow[] {
  const rows: CsvRow[] = []
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0)
  for (let i = 0; i < lines.length; i++) {
    const parts = parseLine(lines[i])
    if (parts.length < 2) continue
    const hasQty = parts[2] !== undefined && parts[2].trim() !== ''
    const qtyNum = Number((parts[2] || '1').trim())
    // 跳过表头行：数量字段存在但非数字（如"数量"），通常出现在第一行
    if (i === 0 && hasQty && isNaN(qtyNum)) continue
    rows.push({
      category: parts[0].trim(),
      item_name: parts[1].trim(),
      quantity: isNaN(qtyNum) ? 0 : qtyNum
    })
  }
  return rows
}

// 处理带引号字段与引号转义的单行解析
function parseLine(line: string): string[] {
  const result: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (c === ',' && !inQuotes) {
      result.push(cur)
      cur = ''
    } else {
      cur += c
    }
  }
  result.push(cur)
  return result
}

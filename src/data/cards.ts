// 月谕圣牌（《原神》幻想真境剧诗玩法中的塔罗牌收藏品）
//
// 信息来源：原神官方 wiki（幻想真境剧诗·月谕圣牌）
// - 「月谕圣牌」是一整套塔罗「大阿卡那」牌，共 22 张。
// - 每期幻想真境剧诗完成两个圣牌挑战、并成功通过第 10 幕演出挑战后可抽取一次。
// - 22 张牌分别对应大阿卡那的 22 个牌面。
export const MOON_CARD_NAMES: string[] = [
  // 设计决策：愚者（大阿卡那 0 号）在 wiki 中列为「二十二·愚者」，故排在最后一位
  '魔法师', '女祭司', '女皇', '皇帝', '圣职者',
  '恋人', '战车', '力量', '隐者', '命运之轮', '正义',
  '倒吊人', '死神', '节制', '魔鬼', '塔', '星',
  '月亮', '太阳', '审判', '世界', '愚者'
]

// 去重后的名称列表（供下拉选项 / 搜索建议使用）
export const UNIQUE_MOON_CARD_NAMES: string[] = Array.from(new Set(MOON_CARD_NAMES))

// 月谕圣牌介绍文案
export const MOON_CARD_DESCRIPTION =
  '「月谕圣牌」是《原神》幻想真境剧诗玩法中的一整套塔罗「大阿卡那」牌，共 22 张。' +
  '每期幻想真境剧诗完成圣牌挑战、通关第 10 幕演出挑战后，可抽取一次对应圣牌。'

// 其他道具材料分类与名称（自动生成，来源 materials.csv）
import { MATERIAL_CATEGORIES, MATERIAL_CATEGORY_ORDER } from './materials'

// 道具类别预设选项：月谕圣牌 + 全部材料分类
export const PRESET_CATEGORIES: string[] = ['月谕圣牌', ...MATERIAL_CATEGORY_ORDER]

// 根据类别返回预设的道具名称列表（用于下拉选择 / 搜索建议）
export function getPresetNames(category: string): string[] {
  if (category === '月谕圣牌') return UNIQUE_MOON_CARD_NAMES
  return MATERIAL_CATEGORIES[category] || []
}


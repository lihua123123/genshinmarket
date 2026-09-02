// 标签组件：根据内容自动配色
export default function Tag({ label }: { label: string }) {
  const colorClass =
    label === '余货' ? 'tag-yuhuo' : label === '寻找' ? 'tag-xunzhao' : 'tag-default'
  return <span className={`tag ${colorClass}`}>{label}</span>
}

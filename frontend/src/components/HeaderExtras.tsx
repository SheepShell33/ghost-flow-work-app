import { useEffect, useState } from 'react'
import { getSchedulerStatus } from '../api/schedules'

/** Header 右侧区域：调度器实时状态 + 单秒时钟 + 版本号 */
export default function HeaderExtras() {
  const [running, setRunning] = useState<boolean | null>(null)
  const [jobs, setJobs] = useState(0)
  const [now, setNow] = useState(() => new Date())

  // 单秒时钟，独立组件内更新避免整块布局重渲染
  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(tick)
  }, [])

  useEffect(() => {
    getSchedulerStatus()
      .then((s) => { setRunning(s.running); setJobs(s.jobs.length) })
      .catch(() => setRunning(null))
  }, [])

  const pad = (n: number) => String(n).padStart(2, '0')
  const clock = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`

  return (
    <span className="ghost-header-extra">
      {running !== null && (
        <span className="ghost-header-status">
          <span className={`ghost-status-dot ${running ? 'ghost-status-dot--running' : 'ghost-status-dot--error'}`} />
          <span className="ghost-mono" style={{ color: 'var(--ghost-text-secondary)', fontSize: 13 }}>
            {running ? `调度器运行中 · ${jobs} 任务` : '调度器已停止'}
          </span>
        </span>
      )}
      <span className="ghost-mono ghost-dim" style={{ fontSize: 13 }}>{clock}</span>
      <span style={{ color: 'var(--ghost-text-dim)', fontSize: 13 }}>v0.1</span>
    </span>
  )
}

import { useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import './TimelineChart.css'

function TimelineChart({ timelineData }) {
  const [viewMode, setViewMode] = useState('weekly')

  if (!timelineData || !timelineData[viewMode]) {
    return null
  }

  const data = timelineData[viewMode]

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="custom-tooltip">
          <p className="tooltip-label">{payload[0].payload.date}</p>
          <p className="tooltip-value">{payload[0].value} plays</p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="timeline-chart-container">
      <div className="timeline-header">
        <h2>Listening Timeline</h2>
        <div className="view-mode-buttons">
          <button
            className={`view-mode-btn ${viewMode === 'daily' ? 'active' : ''}`}
            onClick={() => setViewMode('daily')}
          >
            Daily
          </button>
          <button
            className={`view-mode-btn ${viewMode === 'weekly' ? 'active' : ''}`}
            onClick={() => setViewMode('weekly')}
          >
            Weekly
          </button>
          <button
            className={`view-mode-btn ${viewMode === 'monthly' ? 'active' : ''}`}
            onClick={() => setViewMode('monthly')}
          >
            Monthly
          </button>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <AreaChart
          data={data}
          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorPlays" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#1db954" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#1db954" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
          <XAxis
            dataKey="date"
            stroke="#8a8fa3"
            style={{ fontSize: '12px' }}
          />
          <YAxis
            stroke="#8a8fa3"
            style={{ fontSize: '12px' }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="plays"
            stroke="#1db954"
            fillOpacity={1}
            fill="url(#colorPlays)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export default TimelineChart

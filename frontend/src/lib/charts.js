import {
  ArcElement, BarElement, CategoryScale, Chart as ChartJS, Filler, Legend, LinearScale, LineElement, PointElement, Tooltip,
} from 'chart.js'

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, LineElement, PointElement, Tooltip, Legend, Filler)
ChartJS.defaults.font.family = '"IBM Plex Sans", system-ui, sans-serif'
ChartJS.defaults.color = '#9aabc4'
ChartJS.defaults.borderColor = 'rgba(58, 83, 120, 0.25)'

export const SEV_COLORS = { critical: '#ff4d6d', high: '#ff8a3d', medium: '#f5c84c', low: '#4cc9f0' }
export const SERIES = ['#22d3ee', '#2f7bff', '#e0377f', '#a78bfa', '#34d399', '#f5c84c', '#ff8a3d', '#4cc9f0', '#f472b6', '#94a3b8']

export const tooltip = {
  backgroundColor: '#0b1628',
  borderColor: '#21385c',
  borderWidth: 1,
  titleColor: '#e6ecf5',
  bodyColor: '#c5d1e2',
  padding: 10,
  cornerRadius: 8,
  boxPadding: 4,
}

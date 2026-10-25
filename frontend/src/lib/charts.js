import { ArcElement, BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, Tooltip } from 'chart.js'

// Only what the dashboard's bar and doughnut charts use, so the rest of Chart.js is tree-shaken away.
ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend)
ChartJS.defaults.font.family = '-apple-system, "Inter Variable", system-ui, sans-serif'
ChartJS.defaults.color = 'rgba(255,255,255,0.64)'
ChartJS.defaults.borderColor = 'rgba(255,255,255,0.08)'

export const SEV_COLORS = { critical: '#ff5a52', high: '#ffa726', medium: '#f5c84c', low: '#5cc8ff' }
export const SERIES = ['#ffffff', '#bdbdbd', '#8e8e93', '#5cc8ff', '#3ddc84', '#f5c84c', '#ffa726', '#ff5a52', '#636366', '#d4d4d4']

export const tooltip = {
  backgroundColor: '#1a1a1a',
  borderColor: 'rgba(255,255,255,0.14)',
  borderWidth: 1,
  titleColor: '#ffffff',
  bodyColor: 'rgba(255,255,255,0.8)',
  padding: 10,
  cornerRadius: 8,
  boxPadding: 4,
}

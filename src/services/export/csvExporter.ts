import { RouteData } from '../../context/AppContext';

function escapeCsv(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

export function generateCsv(routeData: RouteData): string {
  const { nutritionPoints, distanceKm, estimatedTime } = routeData;
  const sorted = [...nutritionPoints].sort((a, b) => a.distanceKm - b.distanceKm);

  const headers = [
    'Distance (km)',
    'Est. Time',
    'Brand',
    'Product',
    'Category',
    'Carbs (g)',
    'Calories',
    'Sodium (mg)',
    'Caffeine (mg)',
    'Price (ZAR)',
  ];

  const lines: string[] = [headers.join(',')];

  // Parse total time for time estimates
  const timeParts = (estimatedTime || '3:00:00').split(':').map(Number);
  const totalHours = timeParts[0] + (timeParts[1] || 0) / 60 + (timeParts[2] || 0) / 3600;
  const avgSpeed = distanceKm / totalHours;

  let totalCarbs = 0;
  let totalCalories = 0;
  let totalSodium = 0;
  let totalCaffeine = 0;
  let totalCost = 0;

  for (const point of sorted) {
    const estTimeHours = point.distanceKm / avgSpeed;
    const h = Math.floor(estTimeHours);
    const m = Math.floor((estTimeHours - h) * 60);
    const timeStr = `${h}:${m.toString().padStart(2, '0')}`;

    const row = [
      point.distanceKm.toFixed(1),
      timeStr,
      escapeCsv(point.product.brand),
      escapeCsv(point.product.name),
      point.product.category || '',
      point.product.carbs.toString(),
      point.product.calories.toString(),
      point.product.sodium.toString(),
      point.product.caffeine.toString(),
      point.product.priceZAR ? point.product.priceZAR.toFixed(2) : '0',
    ];

    lines.push(row.join(','));

    totalCarbs += point.product.carbs;
    totalCalories += point.product.calories;
    totalSodium += point.product.sodium;
    totalCaffeine += point.product.caffeine;
    totalCost += point.product.priceZAR || 0;
  }

  // Summary row
  lines.push('');
  lines.push([
    'TOTAL', '', '', '',
    `${sorted.length} items`,
    totalCarbs.toString(),
    totalCalories.toString(),
    totalSodium.toString(),
    totalCaffeine.toString(),
    totalCost.toFixed(2),
  ].join(','));

  return lines.join('\n');
}

export function downloadCsv(routeData: RouteData): void {
  const csvContent = generateCsv(routeData);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(routeData.name || 'racefuel-plan').replace(/\s+/g, '_')}_nutrition.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { RouteData } from '../../context/AppContext';

export function downloadPdf(routeData: RouteData): void {
  const { name, distanceKm, elevationGain, estimatedTime, nutritionPoints } = routeData;
  const sorted = [...nutritionPoints].sort((a, b) => a.distanceKm - b.distanceKm);

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Parse time for estimates
  const timeParts = (estimatedTime || '3:00:00').split(':').map(Number);
  const totalHours = timeParts[0] + (timeParts[1] || 0) / 60 + (timeParts[2] || 0) / 3600;
  const avgSpeed = distanceKm / totalHours;

  // === HEADER ===
  doc.setFillColor(10, 10, 10);
  doc.rect(0, 0, pageWidth, 35, 'F');

  doc.setTextColor(255, 107, 0);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('RACEFUEL', 14, 16);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.text('Race Day Nutrition Sheet', 14, 24);

  doc.setFontSize(9);
  doc.setTextColor(160, 160, 160);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 30);

  // === ROUTE INFO ===
  let y = 45;
  doc.setTextColor(40, 40, 40);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(name || 'Nutrition Plan', 14, y);

  y += 10;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(
    `${distanceKm.toFixed(1)}km  |  ${elevationGain}m gain  |  Est. ${estimatedTime}`,
    14, y
  );

  // === NUTRITION TARGETS ===
  y += 15;
  const totalCarbs = sorted.reduce((sum, p) => sum + p.product.carbs, 0);
  const totalCalories = sorted.reduce((sum, p) => sum + p.product.calories, 0);
  const totalSodium = sorted.reduce((sum, p) => sum + p.product.sodium, 0);
  const totalCaffeine = sorted.reduce((sum, p) => sum + p.product.caffeine, 0);
  const totalCost = sorted.reduce((sum, p) => sum + (p.product.priceZAR || 0), 0);
  const carbsPerHour = totalHours > 0 ? Math.round(totalCarbs / totalHours) : 0;

  doc.setFillColor(245, 245, 245);
  doc.rect(14, y - 5, pageWidth - 28, 20, 'F');

  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text('CARBS/HR', 20, y);
  doc.text('TOTAL CARBS', 55, y);
  doc.text('SODIUM', 95, y);
  doc.text('CAFFEINE', 130, y);
  doc.text('CALORIES', 165, y);

  y += 7;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 40, 40);
  doc.text(`${carbsPerHour}g`, 20, y);
  doc.text(`${totalCarbs}g`, 55, y);
  doc.text(`${totalSodium}mg`, 95, y);
  doc.text(`${totalCaffeine}mg`, 130, y);
  doc.text(`${totalCalories}`, 165, y);

  // === NUTRITION TIMELINE TABLE ===
  y += 20;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 40, 40);
  doc.text('NUTRITION TIMELINE', 14, y);

  y += 5;

  const tableData = sorted.map((point) => {
    const estTimeHours = point.distanceKm / avgSpeed;
    const h = Math.floor(estTimeHours);
    const m = Math.floor((estTimeHours - h) * 60);
    const timeStr = `${h}:${m.toString().padStart(2, '0')}`;

    return [
      `${point.distanceKm.toFixed(1)}km`,
      timeStr,
      `${point.product.brand} ${point.product.name}`,
      `${point.product.carbs}g`,
      `${point.product.sodium}mg`,
      point.product.caffeine > 0 ? `${point.product.caffeine}mg` : '-',
      `R${(point.product.priceZAR || 0).toFixed(2)}`,
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [['Distance', 'Time', 'Product', 'Carbs', 'Sodium', 'Caff.', 'Price']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [10, 10, 10],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [40, 40, 40],
    },
    alternateRowStyles: {
      fillColor: [248, 248, 248],
    },
    margin: { left: 14, right: 14 },
  });

  // @ts-expect-error autoTable extends jsPDF with lastAutoTable
  y = doc.lastAutoTable.finalY + 15;

  // === PACKING CHECKLIST ===
  // Check if we need a new page
  if (y > 230) {
    doc.addPage();
    y = 20;
  }

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 40, 40);
  doc.text('PACKING CHECKLIST', 14, y);
  y += 5;

  // Group by product
  const grouped = new Map<string, { product: typeof sorted[0]['product']; quantity: number }>();
  for (const point of sorted) {
    const key = point.product.id;
    const existing = grouped.get(key);
    if (existing) {
      existing.quantity++;
    } else {
      grouped.set(key, { product: point.product, quantity: 1 });
    }
  }

  const checklistData = Array.from(grouped.values()).map(({ product, quantity }) => [
    `[ ]`,
    `${quantity}x`,
    `${product.brand} ${product.name}`,
    `${product.carbs * quantity}g carbs`,
    `R${((product.priceZAR || 0) * quantity).toFixed(2)}`,
  ]);

  // Add total row
  checklistData.push(['', '', 'TOTAL', `${totalCarbs}g`, `R${totalCost.toFixed(2)}`]);

  autoTable(doc, {
    startY: y,
    body: checklistData,
    theme: 'plain',
    bodyStyles: {
      fontSize: 9,
      textColor: [40, 40, 40],
    },
    columnStyles: {
      0: { cellWidth: 12 },
      1: { cellWidth: 14, fontStyle: 'bold' },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 30, halign: 'right' },
      4: { cellWidth: 30, halign: 'right', fontStyle: 'bold' },
    },
    margin: { left: 14, right: 14 },
  });

  // === FOOTER ===
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(160, 160, 160);
    doc.text(
      'Generated by RACEFUEL — Not a substitute for professional sports nutrition advice',
      pageWidth / 2, 290, { align: 'center' }
    );
  }

  // Download
  doc.save(`${(name || 'racefuel-plan').replace(/\s+/g, '_')}_raceday.pdf`);
}

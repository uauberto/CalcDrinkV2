
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Event, Company, Drink, StaffMember } from '../types.ts';

export const generateProposalPDF = (
  event: Event,
  company: Company,
  fullDrinks: Drink[],
  staff: StaffMember[]
) => {
  const doc: any = new jsPDF();
  
  // Cores da Marca (Laranja e Cinza Escuro)
  const primaryColor = [234, 88, 12]; // orange-600
  const secondaryColor = [31, 41, 55]; // gray-800
  
  // 1. Cabeçalho
  doc.setFillColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.rect(0, 0, 210, 40, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text(company.name, 15, 20);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Responsável: ${company.responsibleName}`, 15, 28);
  doc.text(`Contato: ${company.email} | ${company.phone}`, 15, 34);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.text("PROPOSTA DE EVENTO", 195, 25, { align: 'right' });

  // 2. Detalhes do Evento
  const start = new Date(event.startTime);
  const end = new Date(event.endTime);
  const duration = (end.getTime() - start.getTime()) / (1000 * 60 * 60);

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`Evento: ${event.name}`, 15, 55);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Data: ${start.toLocaleDateString('pt-BR')}`, 15, 62);
  doc.text(`Horário: ${start.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})} às ${end.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}`, 15, 68);
  doc.text(`Duração: ${duration.toFixed(1)} horas`, 15, 74);
  doc.text(`Convidados: ${event.numAdults} Adultos, ${event.numChildren} Crianças`, 15, 80);

  // 3. Carta de Drinks (Tabela)
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text("CARTA DE DRINKS SELECIONADA", 15, 95);

  const drinksData = fullDrinks.map(d => [d.name]);

  autoTable(doc, {
    startY: 100,
    head: [['Nome do Drink']],
    body: drinksData,
    theme: 'grid',
    headStyles: { fillColor: primaryColor, textColor: 255 },
    styles: { fontSize: 10, cellPadding: 3 },
  });

  let currentY = (doc as any).lastAutoTable.finalY + 15;

  // 4. Equipe (Staff)
  if (staff && staff.length > 0) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text("EQUIPE OPERACIONAL", 15, currentY);

    const staffData = staff.map(s => [s.role, `R$ ${s.cost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`]);

    autoTable(doc, {
      startY: currentY + 5,
      head: [['Função', 'Custo Estimado']],
      body: staffData,
      theme: 'grid',
      headStyles: { fillColor: secondaryColor, textColor: 255 },
      styles: { fontSize: 10, cellPadding: 3 },
    });

    currentY = (doc as any).lastAutoTable.finalY + 15;
  }

  // 5. Valor Total
  doc.setFillColor(240, 240, 240);
  doc.rect(120, currentY, 75, 30, 'F'); // Box background

  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text("VALOR TOTAL ESTIMADO", 157, currentY + 10, { align: 'center' });

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  
  const finalPrice = event.simulatedCosts?.finalPrice || 0;
  doc.text(`R$ ${finalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 157, currentY + 22, { align: 'center' });

  // 6. Rodapé
  const pageHeight = doc.internal.pageSize.height;
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.setFont('helvetica', 'normal');
  doc.text(`Documento gerado em ${new Date().toLocaleString('pt-BR')} por ${company.responsibleName}`, 105, pageHeight - 10, { align: 'center' });
  doc.text("CalculaDrink - Gestão Inteligente de Bares", 105, pageHeight - 6, { align: 'center' });

  doc.save(`Proposta_${event.name.replace(/\s+/g, '_')}.pdf`);
};

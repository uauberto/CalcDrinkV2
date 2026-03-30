
import React, { useState, useRef } from 'react';
import type { Ingredient, StockEntry, Company } from '../types.ts';
import { PackagePlus, History, X, AlertTriangle, MinusCircle, Upload, FileSpreadsheet } from 'lucide-react';
import { useLocalStorage } from '../hooks/useLocalStorage.ts';
import { api } from '../lib/supabase.ts';
import { ENABLE_DATABASE } from '../config.ts';
import Papa from 'papaparse';

interface StockManagerProps {
  ingredients: Ingredient[];
  setIngredients: React.Dispatch<React.SetStateAction<Ingredient[]>>;
  company: Company;
}

const StockManager: React.FC<StockManagerProps> = ({ ingredients, setIngredients, company }) => {
  const [addStockModal, setAddStockModal] = useState<Ingredient | null>(null);
  const [historyModal, setHistoryModal] = useState<Ingredient | null>(null);
  const [adjustStockModal, setAdjustStockModal] = useState<Ingredient | null>(null);
  const [adjustmentAmount, setAdjustmentAmount] = useState<number>(0);
  
  // Persist new entry form data
  const [newEntry, setNewEntry] = useLocalStorage<{date: string, quantity: number, price: number}>(`${company.id}_stock_new`, { date: new Date().toISOString().split('T')[0], quantity: 0, price: 0 });
  
  const [searchTerm, setSearchTerm] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importLoading, setImportLoading] = useState(false);

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const handleAddStockEntry = async () => {
    if (!addStockModal || newEntry.quantity <= 0 || newEntry.price <= 0) return;

    const newStockEntry: StockEntry = {
      id: crypto.randomUUID(),
      date: newEntry.date,
      quantity: newEntry.quantity,
      price: newEntry.price,
      remainingQuantity: newEntry.quantity,
    };

    // 1. Create the updated ingredient object
    const targetIngredientIndex = ingredients.findIndex(i => i.id === addStockModal.id);
    if (targetIngredientIndex === -1) return;

    const targetIngredient = ingredients[targetIngredientIndex];
    const updatedIngredient: Ingredient = {
        ...targetIngredient,
        stockEntries: [...targetIngredient.stockEntries, newStockEntry]
    };

    // 2. Update Local State (Optimistic UI)
    setIngredients(prev => prev.map(ing => ing.id === updatedIngredient.id ? updatedIngredient : ing));

    // 3. Persist to Database
    if (ENABLE_DATABASE) {
        try {
            await api.ingredients.save(company.id, updatedIngredient);
        } catch (error) {
            console.error("Failed to save stock entry:", error);
            // Optionally revert state here if strict consistency is needed
            alert("Erro ao salvar no banco de dados. Verifique sua conexão.");
        }
    }

    setAddStockModal(null);
    setNewEntry({ date: new Date().toISOString().split('T')[0], quantity: 0, price: 0 });
  };
  
  const handleAdjustStock = async () => {
    if (!adjustStockModal || adjustmentAmount <= 0) return;

    const totalStock = calculateStockInfo(adjustStockModal).totalStock;
    if (adjustmentAmount > totalStock) {
        alert("A quantidade a ser removida é maior que o estoque atual.");
        return;
    }

    // 1. Clone and perform FIFO logic
    const targetIngredientIndex = ingredients.findIndex(i => i.id === adjustStockModal.id);
    if (targetIngredientIndex === -1) return;

    // Deep copy to avoid mutating state directly before setting it
    const updatedIngredient: Ingredient = JSON.parse(JSON.stringify(ingredients[targetIngredientIndex]));
    
    let quantityToRemove = adjustmentAmount;
    
    // Sort entries by date to ensure FIFO (Oldest first)
    updatedIngredient.stockEntries.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    for (const entry of updatedIngredient.stockEntries) {
        if (quantityToRemove <= 0) break;

        const amountToDeduct = Math.min(quantityToRemove, entry.remainingQuantity);
        entry.remainingQuantity -= amountToDeduct;
        quantityToRemove -= amountToDeduct;
    }

    // 2. Update Local State
    setIngredients(prev => prev.map(ing => ing.id === updatedIngredient.id ? updatedIngredient : ing));

    // 3. Persist to Database
    if (ENABLE_DATABASE) {
        try {
            await api.ingredients.save(company.id, updatedIngredient);
        } catch (error) {
            console.error("Failed to adjust stock:", error);
            alert("Erro ao atualizar estoque no banco de dados.");
        }
    }

    setAdjustStockModal(null);
    setAdjustmentAmount(0);
  };


  const calculateStockInfo = (ingredient: Ingredient) => {
    const totalStock = ingredient.stockEntries.reduce((sum, entry) => sum + entry.remainingQuantity, 0);
    const totalValue = ingredient.stockEntries.reduce((sum, entry) => {
      const costPerUnit = entry.quantity > 0 ? entry.price / entry.quantity : 0;
      return sum + costPerUnit * entry.remainingQuantity;
    }, 0);
    const avgCost = totalStock > 0 ? totalValue / totalStock : 0;
    return { totalStock, avgCost, totalValue };
  };

   // --- CSV IMPORT LOGIC ---
   const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportLoading(true);

    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
            let successCount = 0;
            let errorCount = 0;
            const updatedIngredientsMap = new Map<string, Ingredient>();

            // Clone ingredients to map for quick access and updates
            ingredients.forEach(ing => updatedIngredientsMap.set(ing.name.toLowerCase(), { ...ing }));

            for (const row of results.data as any[]) {
                const name = row['Insumo'] || row['insumo'] || row['Ingredient'];
                const date = row['Data'] || row['data'] || row['Date'];
                const quantity = parseFloat(row['Quantidade'] || row['quantidade'] || row['Quantity']);
                const price = parseFloat(row['Preco'] || row['preco'] || row['Price']);

                if (name && quantity > 0 && price >= 0) {
                    const ingredient = updatedIngredientsMap.get(name.toLowerCase());
                    
                    if (ingredient) {
                        const newEntry: StockEntry = {
                            id: crypto.randomUUID(),
                            date: date || new Date().toISOString().split('T')[0],
                            quantity: quantity,
                            price: price,
                            remainingQuantity: quantity
                        };
                        
                        ingredient.stockEntries.push(newEntry);
                        updatedIngredientsMap.set(name.toLowerCase(), ingredient);
                        successCount++;
                    } else {
                        console.warn(`Insumo não encontrado: ${name}`);
                        errorCount++;
                    }
                } else {
                    errorCount++;
                }
            }

            // Conver map back to array
            const newIngredientsList = Array.from(updatedIngredientsMap.values());
            
            // Update State
            setIngredients(newIngredientsList);

            // Save to DB (Bulk or loop)
            if (ENABLE_DATABASE) {
                // Note: Ideally we should have a bulk update API, but for now we loop through changed items
                // To avoid hammering the API, we only save ingredients that actually changed.
                // For simplicity in this context, we might just alert user or save all.
                // Let's try to save only the modified ones
                for (const ing of newIngredientsList) {
                     // Check if it was modified (basic check)
                     const original = ingredients.find(i => i.id === ing.id);
                     if (original && original.stockEntries.length !== ing.stockEntries.length) {
                         await api.ingredients.save(company.id, ing);
                     }
                }
            }

            alert(`Importação concluída!\nEntradas adicionadas: ${successCount}\nErros/Insumos não encontrados: ${errorCount}`);
            setImportLoading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        },
        error: (error) => {
            console.error(error);
            alert("Erro ao ler arquivo CSV.");
            setImportLoading(false);
        }
    });
  };

  const filteredIngredients = ingredients.filter(ing =>
    ing.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Add Stock Modal */}
      {addStockModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
            <div className="flex justify-between items-center p-4 border-b border-gray-700">
              <h3 className="text-xl font-bold text-orange-400">Adicionar Entrada: {addStockModal.name}</h3>
              <button onClick={() => setAddStockModal(null)} className="text-gray-400 hover:text-white"><X size={24} /></button>
            </div>
            <div className="p-6 space-y-4">
              <input type="date" value={newEntry.date} onChange={e => setNewEntry({...newEntry, date: e.target.value})} className="w-full bg-gray-700 text-white border border-gray-600 rounded-md px-3 py-2" />
              <input type="number" placeholder={`Quantidade em ${addStockModal.unit}`} value={newEntry.quantity || ''} onChange={e => setNewEntry({...newEntry, quantity: parseFloat(e.target.value)})} className="w-full bg-gray-700 text-white border border-gray-600 rounded-md px-3 py-2" />
              <input type="number" placeholder="Preço Total (R$)" value={newEntry.price || ''} onChange={e => setNewEntry({...newEntry, price: parseFloat(e.target.value)})} className="w-full bg-gray-700 text-white border border-gray-600 rounded-md px-3 py-2" />
              <button onClick={handleAddStockEntry} className="w-full px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-500">Adicionar</button>
            </div>
          </div>
        </div>
      )}
      
      {/* History Modal */}
      {historyModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-gray-700">
              <h3 className="text-xl font-bold text-orange-400">Histórico de Entradas: {historyModal.name}</h3>
              <button onClick={() => setHistoryModal(null)} className="text-gray-400 hover:text-white"><X size={24} /></button>
            </div>
            <div className="p-6 overflow-y-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="p-2">Data</th><th className="p-2">Qtd. Comprada</th><th className="p-2">Preço Pago</th><th className="p-2">Qtd. Restante</th>
                  </tr>
                </thead>
                <tbody>
                  {historyModal.stockEntries.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(entry => (
                    <tr key={entry.id} className="border-b border-gray-700 text-sm">
                      <td className="p-2">{new Date(entry.date).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</td>
                      <td className="p-2">{entry.quantity} {historyModal.unit}</td>
                      <td className="p-2">{formatCurrency(entry.price)}</td>
                      <td className="p-2 font-semibold">{entry.remainingQuantity} {historyModal.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Adjust Stock Modal */}
      {adjustStockModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
            <div className="flex justify-between items-center p-4 border-b border-gray-700">
              <h3 className="text-xl font-bold text-orange-400">Ajustar Estoque: {adjustStockModal.name}</h3>
              <button onClick={() => setAdjustStockModal(null)} className="text-gray-400 hover:text-white"><X size={24} /></button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-gray-300">Estoque atual: {calculateStockInfo(adjustStockModal).totalStock.toFixed(2)} {adjustStockModal.unit}</p>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Quantidade a remover (FIFO)</label>
                <input type="number" placeholder={`Quantidade em ${adjustStockModal.unit}`} value={adjustmentAmount || ''} onChange={e => setAdjustmentAmount(parseFloat(e.target.value))} className="w-full bg-gray-700 text-white border border-gray-600 rounded-md px-3 py-2" />
              </div>
              <button onClick={handleAdjustStock} className="w-full px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-500">Confirmar Ajuste</button>
            </div>
          </div>
        </div>
      )}

      <div className="p-6 bg-gray-800 rounded-lg shadow-md">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center w-full">
                 <h2 className="text-2xl font-bold text-orange-400 whitespace-nowrap">Controle de Estoque</h2>
                 <input type="text" placeholder="Buscar insumo..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full sm:w-64 bg-gray-700 text-white border border-gray-600 rounded-md px-3 py-2" />
            </div>
            
            <div className="flex gap-2">
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileUpload} 
                    accept=".csv" 
                    className="hidden" 
                />
                <button 
                    onClick={() => fileInputRef.current?.click()} 
                    disabled={importLoading}
                    className="flex items-center gap-2 px-3 py-2 bg-green-700 text-white rounded-md hover:bg-green-600 transition-colors text-sm whitespace-nowrap"
                    title="CSV: Insumo, Data, Quantidade, Preco"
                >
                    {importLoading ? <div className="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent"></div> : <Upload size={16} />}
                    Importar Estoque
                </button>
                 <a 
                    href="data:text/csv;charset=utf-8,Insumo,Data,Quantidade,Preco%0AVodka,2024-01-10,5,200%0AAçúcar,2024-01-12,2,10" 
                    download="modelo_estoque.csv"
                    className="flex items-center gap-2 px-3 py-2 bg-gray-700 text-gray-300 rounded-md hover:bg-gray-600 transition-colors text-sm whitespace-nowrap"
                    title="Baixar Modelo CSV"
                >
                    <FileSpreadsheet size={16} />
                    Modelo
                </a>
            </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left hidden md:table">
            <thead><tr className="border-b border-gray-700"><th className="p-3">Nome</th><th className="p-3">Estoque Atual</th><th className="p-3">Custo Médio</th><th className="p-3">Valor em Estoque</th><th className="p-3">Ações</th></tr></thead>
            <tbody>
              {filteredIngredients.map(ing => {
                const { totalStock, avgCost, totalValue } = calculateStockInfo(ing);
                const isLowStock = ing.lowStockThreshold && totalStock < ing.lowStockThreshold;
                return (
                  <tr key={ing.id} className={`border-b border-gray-700 ${isLowStock ? 'bg-red-900/30' : 'hover:bg-gray-700/50'}`}>
                    <td className="p-3 font-medium flex items-center gap-2">{ing.name} {isLowStock && <span title="Estoque baixo!"><AlertTriangle className="text-red-400" size={16} /></span>}</td>
                    <td className="p-3 font-medium">{totalStock.toFixed(2)} {ing.unit}</td>
                    <td className="p-3">{formatCurrency(avgCost)} / {ing.unit}</td>
                    <td className="p-3 font-semibold">{formatCurrency(totalValue)}</td>
                    <td className="p-3"><div className="flex gap-2"><button onClick={() => setAddStockModal(ing)} className="p-2 text-green-400 hover:text-green-300" title="Adicionar Estoque"><PackagePlus size={18} /></button><button onClick={() => setHistoryModal(ing)} className="p-2 text-blue-400 hover:text-blue-300" title="Ver Histórico"><History size={18} /></button><button onClick={() => setAdjustStockModal(ing)} className="p-2 text-yellow-400 hover:text-yellow-300" title="Ajustar Estoque"><MinusCircle size={18} /></button></div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="md:hidden space-y-3">
            {filteredIngredients.map(ing => {
              const { totalStock, avgCost, totalValue } = calculateStockInfo(ing);
              const isLowStock = ing.lowStockThreshold && totalStock < ing.lowStockThreshold;
              return (
                <div key={ing.id} className={`p-4 rounded-lg ${isLowStock ? 'bg-red-900/50' : 'bg-gray-700/50'}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-bold text-white flex items-center gap-2">{ing.name} {isLowStock && <AlertTriangle className="text-red-400" size={16} />}</p>
                      <p className="text-sm text-gray-300 mt-1">Estoque: <span className="font-semibold">{totalStock.toFixed(2)} {ing.unit}</span></p>
                      <p className="text-sm text-gray-300">Valor Total: <span className="font-semibold">{formatCurrency(totalValue)}</span></p>
                      <p className="text-xs text-gray-400">Custo Médio: {formatCurrency(avgCost)} / {ing.unit}</p>
                    </div>
                    <div className="flex gap-1"><button onClick={() => setAddStockModal(ing)} className="p-2 text-green-400" title="Adicionar Estoque"><PackagePlus size={20} /></button><button onClick={() => setHistoryModal(ing)} className="p-2 text-blue-400" title="Ver Histórico"><History size={20} /></button><button onClick={() => setAdjustStockModal(ing)} className="p-2 text-yellow-400" title="Ajustar Estoque"><MinusCircle size={20} /></button></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StockManager;

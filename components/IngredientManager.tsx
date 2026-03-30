
import React, { useState, useRef } from 'react';
import type { Ingredient, Company } from '../types.ts';
import { Plus, Trash2, Edit, Upload, FileSpreadsheet, HelpCircle } from 'lucide-react';
import { useLocalStorage } from '../hooks/useLocalStorage.ts';
import { api } from '../lib/supabase.ts';
import { ENABLE_DATABASE } from '../config.ts';
import Papa from 'papaparse';

interface IngredientManagerProps {
  ingredients: Ingredient[];
  setIngredients: React.Dispatch<React.SetStateAction<Ingredient[]>>;
  company: Company;
}

const IngredientManager: React.FC<IngredientManagerProps> = ({ ingredients, setIngredients, company }) => {
  // Persist form state
  const [newIngredient, setNewIngredient] = useLocalStorage<Omit<Ingredient, 'id' | 'stockEntries'>>(`${company.id}_ing_new`, {
    name: '',
    unit: 'ml',
    isAlcoholic: false,
    lowStockThreshold: 0,
  });
  
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importLoading, setImportLoading] = useState(false);

  const handleAddIngredient = async () => {
    if (newIngredient.name) {
       let updatedList = [...ingredients];
       let savedIngredient: Ingredient | null = null;

       if (isEditing) {
        const editedIngredient = { ...ingredients.find(i => i.id === isEditing)!, ...newIngredient };
        // Save to DB
        if (ENABLE_DATABASE) {
             await api.ingredients.save(company.id, editedIngredient);
        }
        updatedList = ingredients.map(ing => ing.id === isEditing ? editedIngredient : ing);
        setIsEditing(null);
      } else {
        const newItem: Ingredient = { ...newIngredient, id: crypto.randomUUID(), stockEntries: [] };
        // Save to DB
        if (ENABLE_DATABASE) {
             await api.ingredients.save(company.id, newItem);
        }
        updatedList = [...ingredients, newItem];
      }
      
      setIngredients(updatedList);
      setNewIngredient({ name: '', unit: 'ml', isAlcoholic: false, lowStockThreshold: 0 });
    }
  };

  const handleEdit = (ingredient: Ingredient) => {
    setIsEditing(ingredient.id);
    setNewIngredient({
        name: ingredient.name,
        unit: ingredient.unit,
        isAlcoholic: ingredient.isAlcoholic,
        lowStockThreshold: ingredient.lowStockThreshold || 0,
    });
  };

  const handleDelete = async (id: string) => {
    if (confirm("Tem certeza que deseja excluir este insumo?")) {
        if (ENABLE_DATABASE) {
            await api.ingredients.delete(id);
        }
        setIngredients(ingredients.filter(ing => ing.id !== id));
    }
  };
  
  const handleCancelEdit = () => {
    setIsEditing(null);
    setNewIngredient({ name: '', unit: 'ml', isAlcoholic: false, lowStockThreshold: 0 });
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
            const importedIngredients: Ingredient[] = [];
            let successCount = 0;
            let errorCount = 0;

            for (const row of results.data as any[]) {
                // Mapeamento flexível de colunas
                const name = row['Nome'] || row['nome'] || row['Name'];
                const unit = row['Unidade'] || row['unidade'] || row['Unit'];
                const isAlcoholicRaw = row['Alcoolico'] || row['alcoolico'] || row['Alcoholic'] || 'não';
                const thresholdRaw = row['Alerta'] || row['alerta'] || row['LowStock'] || '0';

                if (name && unit) {
                    const newIng: Ingredient = {
                        id: crypto.randomUUID(),
                        name: name,
                        unit: unit.toLowerCase(),
                        isAlcoholic: String(isAlcoholicRaw).toLowerCase().includes('s') || String(isAlcoholicRaw).toLowerCase() === 'true',
                        lowStockThreshold: parseFloat(thresholdRaw) || 0,
                        stockEntries: []
                    };
                    
                    // Save individually to DB to ensure ID consistency
                    if (ENABLE_DATABASE) {
                        try {
                             await api.ingredients.save(company.id, newIng);
                             importedIngredients.push(newIng);
                             successCount++;
                        } catch (err) {
                            console.error("Erro ao salvar importado:", err);
                            errorCount++;
                        }
                    } else {
                        importedIngredients.push(newIng);
                        successCount++;
                    }
                } else {
                    errorCount++;
                }
            }

            setIngredients(prev => [...prev, ...importedIngredients]);
            alert(`Importação concluída!\nSucessos: ${successCount}\nErros/Inválidos: ${errorCount}`);
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

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-6">
      <div className="p-6 bg-gray-800 rounded-lg shadow-md">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
            <h2 className="text-2xl font-bold text-orange-400">{isEditing ? 'Editar Insumo' : 'Adicionar Novo Insumo'}</h2>
            <div className="flex gap-2">
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileUpload} 
                    accept=".csv" 
                    className="hidden" 
                />
                <button 
                    onClick={triggerFileInput} 
                    disabled={importLoading}
                    className="flex items-center gap-2 px-3 py-2 bg-green-700 text-white rounded-md hover:bg-green-600 transition-colors text-sm"
                    title="CSV: Nome, Unidade, Alcoolico, Alerta"
                >
                    {importLoading ? <div className="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent"></div> : <Upload size={16} />}
                    Importar CSV
                </button>
                <a 
                    href="data:text/csv;charset=utf-8,Nome,Unidade,Alcoolico,Alerta%0AVodka,ml,sim,1000%0AAçúcar,kg,nao,5" 
                    download="modelo_insumos.csv"
                    className="flex items-center gap-2 px-3 py-2 bg-gray-700 text-gray-300 rounded-md hover:bg-gray-600 transition-colors text-sm"
                    title="Baixar Modelo CSV"
                >
                    <FileSpreadsheet size={16} />
                    Modelo
                </a>
            </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
          <input
            type="text"
            placeholder="Nome do Insumo"
            value={newIngredient.name}
            onChange={(e) => setNewIngredient({ ...newIngredient, name: e.target.value })}
            className="w-full bg-gray-700 text-white border border-gray-600 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          <select
            value={newIngredient.unit}
            onChange={(e) => setNewIngredient({ ...newIngredient, unit: e.target.value as Ingredient['unit'] })}
            className="w-full bg-gray-700 text-white border border-gray-600 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option value="ml">ml</option>
            <option value="l">l</option>
            <option value="g">g</option>
            <option value="kg">kg</option>
            <option value="un">un</option>
          </select>
          <input
            type="number"
            placeholder="Alerta de Estoque Baixo"
            value={newIngredient.lowStockThreshold || ''}
            onChange={(e) => setNewIngredient({ ...newIngredient, lowStockThreshold: parseFloat(e.target.value) })}
            className="w-full bg-gray-700 text-white border border-gray-600 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
           <div className="flex items-center justify-start h-full">
            <label className="flex items-center gap-2 cursor-pointer text-gray-300">
              <input
                type="checkbox"
                checked={newIngredient.isAlcoholic}
                onChange={(e) => setNewIngredient({ ...newIngredient, isAlcoholic: e.target.checked })}
                className="h-5 w-5 rounded bg-gray-700 border-gray-600 text-orange-600 focus:ring-orange-500"
              />
              É Alcoólico?
            </label>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-4">
            {isEditing && (
                <button onClick={handleCancelEdit} className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-500 transition-colors">
                    Cancelar
                </button>
            )}
            <button onClick={handleAddIngredient} className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-500 transition-colors">
                <Plus size={18} />
                {isEditing ? 'Salvar Alterações' : 'Adicionar Insumo'}
            </button>
        </div>
      </div>

      <div className="p-6 bg-gray-800 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold mb-4 text-orange-400">Lista de Insumos</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left hidden md:table">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="p-3">Nome</th>
                <th className="p-3">Unidade</th>
                <th className="p-3">Alcoólico</th>
                <th className="p-3">Alerta de Estoque Baixo</th>
                <th className="p-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {ingredients.length > 0 ? ingredients.map(ing => {
                return (
                  <tr key={ing.id} className="border-b border-gray-700 hover:bg-gray-700/50">
                    <td className="p-3 font-medium">{ing.name}</td>
                    <td className="p-3 text-gray-300">{ing.unit}</td>
                    <td className="p-3 text-gray-300">{ing.isAlcoholic ? 'Sim' : 'Não'}</td>
                    <td className="p-3 text-gray-300">{ing.lowStockThreshold ? `${ing.lowStockThreshold} ${ing.unit}` : 'N/A'}</td>
                    <td className="p-3">
                      <div className="flex gap-2">
                        <button onClick={() => handleEdit(ing)} className="p-2 text-blue-400 hover:text-blue-300" title="Editar Insumo"><Edit size={18} /></button>
                        <button onClick={() => handleDelete(ing.id)} className="p-2 text-red-400 hover:text-red-300" title="Excluir Insumo"><Trash2 size={18} /></button>
                      </div>
                    </td>
                  </tr>
                )
              }) : (
                <tr>
                  <td colSpan={5} className="p-3 text-center text-gray-500">Nenhum insumo cadastrado.</td>
                </tr>
              )}
            </tbody>
          </table>
          {/* Mobile view */}
           <div className="md:hidden space-y-3">
              {ingredients.length > 0 ? ingredients.map(ing => {
                return (
                  <div key={ing.id} className="bg-gray-700/50 p-4 rounded-lg">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-bold text-white">{ing.name}</p>
                        <p className="text-sm text-gray-300 mt-1">
                          Unidade: {ing.unit}
                        </p>
                        <p className="text-sm text-gray-300">
                          Alcoólico: {ing.isAlcoholic ? 'Sim' : 'Não'}
                        </p>
                        <p className="text-sm text-gray-300">
                          Alerta: {ing.lowStockThreshold ? `${ing.lowStockThreshold} ${ing.unit}` : 'N/A'}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleEdit(ing)} className="p-2 text-blue-400 hover:text-blue-300" title="Editar Insumo"><Edit size={18} /></button>
                        <button onClick={() => handleDelete(ing.id)} className="p-2 text-red-400 hover:text-red-300" title="Excluir Insumo"><Trash2 size={18} /></button>
                      </div>
                    </div>
                  </div>
                )
              }) : (
                 <p className="p-3 text-center text-gray-500">Nenhum insumo cadastrado.</p>
              )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default IngredientManager;

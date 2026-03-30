
import React, { useState, useMemo, useRef } from 'react';
import type { Drink, DrinkIngredient, Ingredient, Company } from '../types.ts';
import { Plus, Trash2, Edit, X, TrendingUp, DollarSign, AlertCircle, Upload, FileSpreadsheet } from 'lucide-react';
import { useLocalStorage } from '../hooks/useLocalStorage.ts';
import { api } from '../lib/supabase.ts';
import { ENABLE_DATABASE } from '../config.ts';
import Papa from 'papaparse';

interface DrinkManagerProps {
  drinks: Drink[];
  setDrinks: React.Dispatch<React.SetStateAction<Drink[]>>;
  ingredients: Ingredient[];
  company: Company;
}

const DrinkManager: React.FC<DrinkManagerProps> = ({ drinks, setDrinks, ingredients, company }) => {
  const [isModalOpen, setIsModalOpen] = useLocalStorage<boolean>(`${company.id}_drink_modal_open`, false);
  const [drinkName, setDrinkName] = useLocalStorage<string>(`${company.id}_drink_name`, '');
  const [recipe, setRecipe] = useLocalStorage<DrinkIngredient[]>(`${company.id}_drink_recipe`, []);
  const [consumptionEstimate, setConsumptionEstimate] = useLocalStorage<{adults: number, children: number}>(`${company.id}_drink_estimate`, { adults: 0.5, children: 0 });
  const [editingDrink, setEditingDrink] = useState<Drink | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importLoading, setImportLoading] = useState(false);

  const ingredientCostMap = useMemo(() => {
    const map = new Map<string, number>();
    ingredients.forEach(ing => {
      const totalStock = ing.stockEntries.reduce((sum, entry) => sum + entry.remainingQuantity, 0);
      const totalValue = ing.stockEntries.reduce((sum, entry) => {
        const costPerUnit = entry.quantity > 0 ? entry.price / entry.quantity : 0;
        return sum + costPerUnit * entry.remainingQuantity;
      }, 0);
      const avgCost = totalStock > 0 ? totalValue / totalStock : 0;
      map.set(ing.id, avgCost);
    });
    return map;
  }, [ingredients]);

  const calculateDrinkCost = (drink: Drink): number => {
      return drink.ingredients.reduce((total, item) => {
          const costPerUnit = ingredientCostMap.get(item.ingredientId) || 0;
          return total + (costPerUnit * item.quantity);
      }, 0);
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const openModalForNew = () => {
    setEditingDrink(null);
    setDrinkName('');
    setRecipe([]);
    setConsumptionEstimate({ adults: 0.5, children: 0 });
    setIsModalOpen(true);
  };

  const openModalForEdit = (drink: Drink) => {
    setEditingDrink(drink);
    setDrinkName(drink.name);
    setRecipe(JSON.parse(JSON.stringify(drink.ingredients)));
    setConsumptionEstimate(drink.consumptionEstimate);
    setIsModalOpen(true);
  };
  
  const closeModal = () => {
    setIsModalOpen(false);
    setEditingDrink(null);
    setDrinkName('');
    setRecipe([]);
    setConsumptionEstimate({ adults: 0.5, children: 0 });
  };

  const handleAddIngredientToRecipe = () => {
    if (ingredients.length > 0) {
      setRecipe([...recipe, { ingredientId: ingredients[0].id, quantity: 0 }]);
    }
  };

  const handleRecipeChange = (index: number, field: 'ingredientId' | 'quantity', value: string) => {
    const newRecipe = [...recipe];
    if (field === 'quantity') {
      newRecipe[index][field] = parseFloat(value) || 0;
    } else {
      newRecipe[index][field] = value;
    }
    setRecipe(newRecipe);
  };

  const handleRemoveIngredientFromRecipe = (index: number) => {
    setRecipe(recipe.filter((_, i) => i !== index));
  };

  const currentRecipeIsAlcoholic = useMemo(() => {
    return recipe.some(di => {
      const ing = ingredients.find(i => i.id === di.ingredientId);
      return ing?.isAlcoholic;
    });
  }, [recipe, ingredients]);

  const handleSaveDrink = async () => {
    if (!drinkName || recipe.length === 0) return;
    
    const finalConsumptionEstimate = {
      adults: consumptionEstimate.adults,
      children: currentRecipeIsAlcoholic ? 0 : consumptionEstimate.children,
    };

    const newDrink: Drink = {
        id: editingDrink ? editingDrink.id : crypto.randomUUID(),
        name: drinkName,
        ingredients: recipe.filter(r => r.quantity > 0 && r.ingredientId),
        consumptionEstimate: finalConsumptionEstimate,
    };

    // 1. Update Local State
    if (editingDrink) {
        setDrinks(drinks.map(d => d.id === editingDrink.id ? newDrink : d));
    } else {
        setDrinks([...drinks, newDrink]);
    }

    // 2. Persist to Database
    if (ENABLE_DATABASE) {
        try {
            await api.drinks.save(company.id, newDrink);
        } catch (error) {
            console.error("Failed to save drink:", error);
            alert("Erro ao salvar drink no banco de dados.");
        }
    }

    closeModal();
  };
  
  const handleDeleteDrink = async (id: string) => {
    if (confirm("Tem certeza que deseja excluir este drink?")) {
        setDrinks(drinks.filter(d => d.id !== id));
        if (ENABLE_DATABASE) {
            await api.drinks.delete(id);
        }
    }
  };

  // --- CSV IMPORT ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportLoading(true);

    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
            const importedMap = new Map<string, Drink>();
            // Map ingredient names to IDs. Explicitly type the Map to avoid unknown errors.
            const ingNameMap = new Map<string, string>();
            ingredients.forEach(i => ingNameMap.set(i.name.toLowerCase(), i.id));

            for (const row of results.data as any[]) {
                const drinkName = String(row['Drink'] || row['drink'] || '');
                const ingName = String(row['Insumo'] || row['insumo'] || '');
                const qty = parseFloat(String(row['Quantidade'] || row['quantidade'] || '0'));
                
                if (drinkName && ingName && qty > 0) {
                    const ingId = ingNameMap.get(ingName.toLowerCase());
                    if (ingId) {
                        if (!importedMap.has(drinkName)) {
                            importedMap.set(drinkName, {
                                id: crypto.randomUUID(),
                                name: drinkName,
                                ingredients: [],
                                consumptionEstimate: { adults: 0.5, children: 0 }
                            });
                        }
                        importedMap.get(drinkName)?.ingredients.push({ ingredientId: ingId, quantity: qty });
                    }
                }
            }

            // Save all drinks
            const newDrinks = Array.from(importedMap.values());
            setDrinks(prev => [...prev, ...newDrinks]);

            if (ENABLE_DATABASE) {
                for (const drink of newDrinks) {
                    await api.drinks.save(company.id, drink);
                }
            }

            alert(`${newDrinks.length} drinks importados com sucesso!`);
            setImportLoading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    });
  };

  const getIngredientInfo = (id: string) => ingredients.find(i => i.id === id);
  const isDrinkAlcoholic = (drink: Drink) => drink.ingredients.some(di => getIngredientInfo(di.ingredientId)?.isAlcoholic);

  return (
    <div className="space-y-6">
      <div className="flex justify-end gap-2">
         <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".csv" className="hidden" />
         <button 
            onClick={() => fileInputRef.current?.click()} 
            disabled={importLoading}
            className="flex items-center gap-2 px-3 py-2 bg-green-700 text-white rounded-md hover:bg-green-600 text-sm"
            title="CSV: Drink, Insumo, Quantidade"
        >
            {importLoading ? <div className="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent"></div> : <Upload size={16} />}
            Importar Drinks
        </button>
        <button onClick={openModalForNew} className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-500">
          <Plus size={18} /> Adicionar Novo Drink
        </button>
      </div>

      <div className="p-6 bg-gray-800 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold mb-4 text-orange-400">Lista de Drinks</h2>
        <div className="space-y-4">
          {drinks.length > 0 ? drinks.map(drink => {
            const estimatedCost = calculateDrinkCost(drink);
            const hasZeroCostIngredients = estimatedCost === 0 && drink.ingredients.length > 0;

            return (
              <div key={drink.id} className="bg-gray-700/50 p-4 rounded-lg flex flex-col md:flex-row justify-between items-start gap-4">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-lg font-bold text-white">{drink.name}</h3>
                    {isDrinkAlcoholic(drink) && <span className="text-xs font-bold bg-red-800 text-white px-2 py-0.5 rounded-full">Alcoólico</span>}
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-4 mt-2">
                     <div className="flex items-center gap-2 text-xs text-amber-300 bg-amber-900/20 px-2 py-1 rounded">
                        <TrendingUp size={14}/>
                        <span>Adultos: <strong>{drink.consumptionEstimate.adults}</strong></span>
                        <span>Crianças: <strong>{drink.consumptionEstimate.children}</strong></span>
                    </div>

                    <div className={`flex items-center gap-2 text-sm px-2 py-1 rounded font-mono ${hasZeroCostIngredients ? 'bg-gray-600 text-gray-400' : 'bg-green-900/30 text-green-400'}`}>
                        <DollarSign size={14} />
                        <span>Custo Base: <strong>{formatCurrency(estimatedCost)}</strong></span>
                        {hasZeroCostIngredients && <span title="Custo zerado: verifique se há estoque." className="text-yellow-500 cursor-help"><AlertCircle size={14}/></span>}
                    </div>
                  </div>

                  <ul className="list-disc list-inside mt-3 text-sm text-gray-300">
                    {drink.ingredients.map((ing, index) => {
                      const ingredientInfo = getIngredientInfo(ing.ingredientId);
                      return <li key={index}>{ing.quantity} {ingredientInfo?.unit} de {ingredientInfo?.name}</li>;
                    })}
                  </ul>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => openModalForEdit(drink)} className="p-2 text-blue-400 hover:text-blue-300"><Edit size={18} /></button>
                  <button onClick={() => handleDeleteDrink(drink.id)} className="p-2 text-red-400 hover:text-red-300"><Trash2 size={18} /></button>
                </div>
              </div>
            );
          }) : (
             <p className="text-center text-gray-500">Nenhum drink cadastrado.</p>
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-gray-700">
              <h3 className="text-xl font-bold text-orange-400">{editingDrink ? 'Editar Drink' : 'Adicionar Novo Drink'}</h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-white"><X size={24} /></button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto">
              <input type="text" placeholder="Nome do Drink" value={drinkName} onChange={e => setDrinkName(e.target.value)} className="w-full bg-gray-700 text-white border border-gray-600 rounded-md px-3 py-2" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <input type="number" step="0.1" min="0" placeholder="Consumo Adultos" value={consumptionEstimate.adults} onChange={e => setConsumptionEstimate(prev => ({ ...prev, adults: parseFloat(e.target.value) || 0 }))} className="w-full bg-gray-700 text-white border border-gray-600 rounded-md px-3 py-2" />
                  <input type="number" step="0.1" min="0" placeholder="Consumo Crianças" value={currentRecipeIsAlcoholic ? 0 : consumptionEstimate.children} onChange={e => setConsumptionEstimate(prev => ({ ...prev, children: parseFloat(e.target.value) || 0 }))} disabled={currentRecipeIsAlcoholic} className="w-full bg-gray-700 text-white border border-gray-600 rounded-md px-3 py-2 disabled:bg-gray-600" />
              </div>
              <div>
                <h4 className="text-lg font-semibold text-gray-200 mb-2">Receita</h4>
                {recipe.map((r, index) => (
                    <div key={index} className="flex items-center gap-3 p-2 bg-gray-700/50 rounded mb-2">
                        <select value={r.ingredientId} onChange={e => handleRecipeChange(index, 'ingredientId', e.target.value)} className="flex-1 bg-gray-600 text-white border border-gray-500 rounded-md px-3 py-2">
                            {ingredients.map(ing => <option key={ing.id} value={ing.id}>{ing.name}</option>)}
                        </select>
                        <input type="number" placeholder="Qtd" value={r.quantity || ''} onChange={e => handleRecipeChange(index, 'quantity', e.target.value)} className="w-24 bg-gray-600 text-white border border-gray-500 rounded-md px-3 py-2" />
                        <span className="text-gray-400 w-8">{getIngredientInfo(r.ingredientId)?.unit}</span>
                        <button onClick={() => handleRemoveIngredientFromRecipe(index)} className="p-2 text-red-400 hover:text-red-300"><Trash2 size={18} /></button>
                    </div>
                ))}
                <button onClick={handleAddIngredientToRecipe} disabled={ingredients.length === 0} className="mt-2 flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-600 text-white rounded-md hover:bg-gray-500">
                    <Plus size={16} /> Adicionar Insumo
                </button>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-auto p-4 border-t border-gray-700 bg-gray-800 rounded-b-lg">
                <button onClick={closeModal} className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-500">Cancelar</button>
                <button onClick={handleSaveDrink} className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-500">{editingDrink ? 'Salvar' : 'Adicionar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DrinkManager;

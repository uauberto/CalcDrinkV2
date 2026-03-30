
import React, { useState, useMemo } from 'react';
import type { Drink, Ingredient, StaffMember, Event, Company } from '../types.ts';
import { Plus, Trash2, Users, Target, BarChart2, Save, X, Clock, RotateCcw } from 'lucide-react';
import { useLocalStorage } from '../hooks/useLocalStorage.ts';

interface SimulatorProps {
  drinks: Drink[];
  ingredients: Ingredient[];
  setEvents: React.Dispatch<React.SetStateAction<Event[]>>;
  company: Company;
}

const Simulator: React.FC<SimulatorProps> = ({ drinks, ingredients, setEvents, company }) => {
  // Persist Simulation State using useLocalStorage prefixed with company ID
  const [selectedDrinks, setSelectedDrinks] = useLocalStorage<string[]>(`${company.id}_sim_selectedDrinks`, []);
  const [numAdults, setNumAdults] = useLocalStorage<number>(`${company.id}_sim_numAdults`, 40);
  const [numChildren, setNumChildren] = useLocalStorage<number>(`${company.id}_sim_numChildren`, 10);
  const [eventDuration, setEventDuration] = useLocalStorage<number>(`${company.id}_sim_eventDuration`, 4); // in hours
  const [staff, setStaff] = useLocalStorage<StaffMember[]>(`${company.id}_sim_staff`, []);
  const [profitMargin, setProfitMargin] = useLocalStorage<number>(`${company.id}_sim_profitMargin`, 100);

  // Temporary UI state (doesn't need persistence)
  const [newStaffMember, setNewStaffMember] = useState({ role: '', cost: 0 });
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [newEventDetails, setNewEventDetails] = useState({ name: '', startDateTime: '', endDateTime: '' });

  const ingredientMap = useMemo(() => new Map(ingredients.map(i => [i.id, i])), [ingredients]);

  const ingredientCostData = useMemo(() => {
    const map = new Map<string, { avgCost: number }>();
    ingredients.forEach(ing => {
      const totalStock = ing.stockEntries.reduce((sum, entry) => sum + entry.remainingQuantity, 0);
      const totalValue = ing.stockEntries.reduce((sum, entry) => {
        const costPerUnit = entry.quantity > 0 ? entry.price / entry.quantity : 0;
        return sum + costPerUnit * entry.remainingQuantity;
      }, 0);
      const avgCost = totalStock > 0 ? totalValue / totalStock : 0;
      map.set(ing.id, { avgCost });
    });
    return map;
  }, [ingredients]);

  const isDrinkAlcoholic = (drink: Drink): boolean => {
    return drink.ingredients.some(di => ingredientMap.get(di.ingredientId)?.isAlcoholic);
  };

  const costs = useMemo(() => {
    let ingredientCost = 0;
    const totalPeople = numAdults + numChildren;
    if (totalPeople > 0 && eventDuration > 0 && selectedDrinks.length > 0) {
      for (const drinkId of selectedDrinks) {
        const drink = drinks.find(d => d.id === drinkId);
        if (drink) {
          const drinkIsAlcoholic = isDrinkAlcoholic(drink);
          
          const adultServings = numAdults * eventDuration * drink.consumptionEstimate.adults;
          const childrenServings = drinkIsAlcoholic ? 0 : (numChildren * eventDuration * drink.consumptionEstimate.children);
          const totalServings = adultServings + childrenServings;

          if (totalServings > 0) {
            for (const drinkIngredient of drink.ingredients) {
              const costInfo = ingredientCostData.get(drinkIngredient.ingredientId);
              if (costInfo) {
                ingredientCost += costInfo.avgCost * drinkIngredient.quantity * totalServings;
              }
            }
          }
        }
      }
    }

    const operationalCost = staff.reduce((acc, curr) => acc + curr.cost, 0);
    const totalCost = ingredientCost + operationalCost;
    const profit = ingredientCost * (profitMargin / 100);
    const finalPrice = totalCost + profit;
    
    return {
      ingredientCost,
      operationalCost,
      totalCost,
      profit,
      finalPrice,
    };
  }, [selectedDrinks, numAdults, numChildren, eventDuration, staff, profitMargin, drinks, ingredientCostData, ingredientMap]);

  const handleToggleDrink = (drinkId: string) => {
    setSelectedDrinks(prev =>
      prev.includes(drinkId) ? prev.filter(id => id !== drinkId) : [...prev, drinkId]
    );
  };

  const handleAddStaff = () => {
    if (newStaffMember.role && newStaffMember.cost > 0) {
      setStaff([...staff, { ...newStaffMember, id: crypto.randomUUID() }]);
      setNewStaffMember({ role: '', cost: 0 });
    }
  };

  const handleRemoveStaff = (id: string) => {
    setStaff(staff.filter(s => s.id !== id));
  };
  
  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  const handleSaveAsEvent = () => {
    const totalPeople = numAdults + numChildren;
    if (!newEventDetails.name || !newEventDetails.startDateTime || !newEventDetails.endDateTime || selectedDrinks.length === 0 || totalPeople <= 0) {
        alert("Preencha todos os campos do evento (nome, data de início e fim) e certifique-se de que há drinks e convidados selecionados.");
        return;
    }

    const startDateTime = new Date(newEventDetails.startDateTime);
    const endDateTime = new Date(newEventDetails.endDateTime);

    if (endDateTime <= startDateTime) {
      alert("A data de término deve ser posterior à data de início.");
      return;
    }

    const newEvent: Event = {
        id: crypto.randomUUID(),
        name: newEventDetails.name,
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
        status: 'planned',
        numAdults: numAdults,
        numChildren: numChildren,
        selectedDrinks: selectedDrinks,
        staff: staff, // Save current staff configuration to event
        simulatedCosts: costs,
    };

    setEvents(prevEvents => [...prevEvents, newEvent].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()));
    
    setIsSaveModalOpen(false);
    setNewEventDetails({ name: '', startDateTime: '', endDateTime: '' });
    
    // Optional: We could reset the simulator here, but often users want to keep it to make another version
    // If reset needed:
    // setSelectedDrinks([]);
    // setStaff([]);
  };

  const handleClearSimulation = () => {
    if (window.confirm("Tem certeza que deseja limpar todos os dados da simulação atual?")) {
        setSelectedDrinks([]);
        setNumAdults(40);
        setNumChildren(10);
        setEventDuration(4);
        setStaff([]);
        setProfitMargin(100);
        setNewStaffMember({ role: '', cost: 0 });
    }
  };

  const chartData = [
    { name: 'Insumos', value: costs.ingredientCost, fill: '#f97316' },
    { name: 'Operacional', value: costs.operationalCost, fill: '#fbbf24' },
    { name: 'Lucro', value: costs.profit, fill: '#60a5fa' },
  ];

  return (
    <>
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
         <h2 className="text-2xl font-bold text-white hidden sm:block">Simulador de Custos</h2>
         <button 
            onClick={handleClearSimulation}
            className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-gray-300 rounded-md hover:bg-gray-600 hover:text-white transition-colors border border-gray-600 w-full sm:w-auto justify-center"
            title="Resetar todos os campos para o padrão"
         >
            <RotateCcw size={18} />
            Limpar Simulação
         </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Coluna de Configuração */}
        <div className="lg:col-span-1 space-y-6">
          {/* Seleção de Drinks */}
          <div className="bg-gray-800 p-6 rounded-lg shadow-md">
            <h3 className="text-xl font-semibold mb-4 text-orange-400">1. Selecione os Drinks</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
              {drinks.map(drink => (
                <label key={drink.id} className="flex items-center space-x-3 p-2 rounded-md hover:bg-gray-700/50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedDrinks.includes(drink.id)}
                    onChange={() => handleToggleDrink(drink.id)}
                    className="h-5 w-5 rounded bg-gray-700 border-gray-600 text-orange-600 focus:ring-orange-500"
                  />
                  <div>
                    <span className="text-white">{drink.name}</span>
                    <p className="text-xs text-amber-400">A: {drink.consumptionEstimate.adults}, C: {drink.consumptionEstimate.children}</p>
                  </div>
                </label>
              ))}
              {drinks.length === 0 && <p className="text-gray-500 text-center">Cadastre drinks na aba 'Drinks'.</p>}
            </div>
          </div>

          {/* Parâmetros do Evento */}
          <div className="bg-gray-800 p-6 rounded-lg shadow-md space-y-6">
            <h3 className="text-xl font-semibold text-orange-400">2. Parâmetros do Evento</h3>
            <div>
              <label htmlFor="numAdults" className="block text-lg font-medium mb-2">Número de Adultos</label>
              <div className="flex items-center gap-3">
                <Users className="text-gray-400" />
                <input id="numAdults" type="range" min="0" max="500" value={numAdults} onChange={e => setNumAdults(Number(e.target.value))} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer" />
                <span className="text-lg font-bold w-12 text-center">{numAdults}</span>
              </div>
            </div>
             <div>
              <label htmlFor="numChildren" className="block text-lg font-medium mb-2">Número de Crianças</label>
              <div className="flex items-center gap-3">
                <Users className="text-gray-400" />
                <input id="numChildren" type="range" min="0" max="200" value={numChildren} onChange={e => setNumChildren(Number(e.target.value))} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer" />
                <span className="text-lg font-bold w-12 text-center">{numChildren}</span>
              </div>
            </div>
            <div>
              <label htmlFor="eventDuration" className="block text-lg font-medium mb-2">Duração do Evento (horas)</label>
              <div className="flex items-center gap-3">
                <Clock className="text-gray-400" />
                <input id="eventDuration" type="range" min="1" max="12" step="0.5" value={eventDuration} onChange={e => setEventDuration(Number(e.target.value))} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer" />
                <span className="text-lg font-bold w-12 text-center">{eventDuration}h</span>
              </div>
            </div>
          </div>

          {/* Custos Operacionais */}
          <div className="bg-gray-800 p-6 rounded-lg shadow-md">
              <h3 className="text-xl font-semibold mb-4 text-orange-400">3. Custos Operacionais (Equipe)</h3>
              <div className="flex flex-col sm:flex-row gap-2 mb-4">
                  <input type="text" placeholder="Função" value={newStaffMember.role} onChange={e => setNewStaffMember({...newStaffMember, role: e.target.value})} className="flex-1 bg-gray-700 text-white border border-gray-600 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500" />
                  <input type="number" placeholder="Custo" value={newStaffMember.cost || ''} onChange={e => setNewStaffMember({...newStaffMember, cost: Number(e.target.value)})} className="w-full sm:w-28 bg-gray-700 text-white border border-gray-600 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500" />
                  <button onClick={handleAddStaff} className="p-2 bg-orange-600 text-white rounded-md hover:bg-orange-500"><Plus/></button>
              </div>
              <div className="space-y-2">
                  {staff.map(member => (
                      <div key={member.id} className="flex justify-between items-center bg-gray-700/50 p-2 rounded">
                          <span>{member.role}</span>
                          <span>{formatCurrency(member.cost)}</span>
                          <button onClick={() => handleRemoveStaff(member.id)} className="text-red-400 hover:text-red-300"><Trash2 size={16}/></button>
                      </div>
                  ))}
              </div>
          </div>

          {/* Margem de Lucro */}
          <div className="bg-gray-800 p-6 rounded-lg shadow-md">
            <label htmlFor="profitMargin" className="block text-xl font-semibold mb-4 text-orange-400">4. Margem de Lucro Desejada</label>
            <div className="flex items-center gap-3">
              <Target className="text-gray-400" />
              <input
                  id="profitMargin"
                  type="range"
                  min="0"
                  max="300"
                  value={profitMargin}
                  onChange={e => setProfitMargin(Number(e.target.value))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-lg font-bold w-16 text-center">{profitMargin}%</span>
            </div>
          </div>
        </div>
        
        {/* Coluna de Resultados */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-gray-800 p-6 rounded-lg shadow-md">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-6 gap-4">
              <h2 className="text-2xl font-bold text-orange-400 flex items-center gap-3"><BarChart2/>Resultado da Simulação</h2>
              <button 
                onClick={() => setIsSaveModalOpen(true)} 
                disabled={selectedDrinks.length === 0 || (numAdults + numChildren) <= 0 || eventDuration <= 0}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-500 transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed">
                  <Save size={18} />
                  Salvar como Evento
              </button>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-center mb-8">
                  <div className="bg-gray-700/50 p-4 rounded-lg">
                      <p className="text-sm text-gray-400">Custo Total</p>
                      <p className="text-2xl font-bold text-white">{formatCurrency(costs.totalCost)}</p>
                  </div>
                  <div className="bg-orange-900/50 border border-orange-500 p-4 rounded-lg">
                      <p className="text-sm text-orange-300">Valor a Cobrar</p>
                      <p className="text-3xl font-bold text-orange-400">{formatCurrency(costs.finalPrice)}</p>
                  </div>
            </div>

              <div className="space-y-4 mb-8">
                <div className="flex justify-between items-center p-3 bg-gray-700/30 rounded-md">
                    <span className="font-medium text-gray-300">Custo com Insumos</span>
                    <span className="font-bold text-lg text-orange-400">{formatCurrency(costs.ingredientCost)}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-700/30 rounded-md">
                    <span className="font-medium text-gray-300">Custo Operacional</span>
                    <span className="font-bold text-amber-400">{formatCurrency(costs.operationalCost)}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-700/30 rounded-md">
                    <span className="font-medium text-gray-300">Lucro Estimado</span>
                    <span className="font-bold text-lg text-blue-400">{formatCurrency(costs.profit)}</span>
                </div>
            </div>

            <div className="w-full mt-8">
              <h4 className="text-lg font-semibold mb-4 text-center text-gray-300">Composição do Preço Final</h4>
              <div className="space-y-4">
                {chartData.map((data, index) => {
                  const percentage = costs.finalPrice > 0 ? (data.value / costs.finalPrice) * 100 : 0;
                  return (
                    <div key={index} className="flex items-center gap-4">
                      <div className="w-24 text-sm text-gray-400 text-right">{data.name}</div>
                      <div className="flex-1 h-8 bg-gray-700 rounded-full overflow-hidden relative">
                        <div 
                          className="h-full rounded-full transition-all duration-500 ease-out"
                          style={{ width: `${percentage}%`, backgroundColor: data.fill }}
                        />
                      </div>
                      <div className="w-32 text-sm font-medium text-white">
                        {formatCurrency(data.value)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        </div>
      </div>

      {isSaveModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
            <div className="flex justify-between items-center p-4 border-b border-gray-700">
              <h3 className="text-xl font-bold text-orange-400">Salvar Simulação como Evento</h3>
              <button onClick={() => setIsSaveModalOpen(false)} className="text-gray-400 hover:text-white"><X size={24} /></button>
            </div>
            <div className="p-6 space-y-4">
               <div>
                  <label htmlFor="eventName" className="block text-sm font-medium text-gray-300 mb-1">Nome do Evento</label>
                  <input id="eventName" type="text" value={newEventDetails.name} onChange={e => setNewEventDetails({...newEventDetails, name: e.target.value})} className="w-full bg-gray-700 text-white border border-gray-600 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500" placeholder="Ex: Aniversário da Maria" />
              </div>
              <div>
                  <label htmlFor="startDateTime" className="block text-sm font-medium text-gray-300 mb-1">Início do Evento</label>
                  <input id="startDateTime" type="datetime-local" value={newEventDetails.startDateTime} onChange={e => setNewEventDetails({...newEventDetails, startDateTime: e.target.value})} className="w-full bg-gray-700 text-white border border-gray-600 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
              <div>
                  <label htmlFor="endDateTime" className="block text-sm font-medium text-gray-300 mb-1">Fim do Evento</label>
                  <input id="endDateTime" type="datetime-local" value={newEventDetails.endDateTime} onChange={e => setNewEventDetails({...newEventDetails, endDateTime: e.target.value})} className="w-full bg-gray-700 text-white border border-gray-600 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
              <div className="pt-2 text-sm text-gray-400 border-t border-gray-700 mt-4">
                <p className="font-semibold text-gray-200 mt-2">Resumo da Simulação:</p>
                <p><strong>Drinks:</strong> {selectedDrinks.length} selecionados</p>
                <p><strong>Adultos:</strong> {numAdults}</p>
                <p><strong>Crianças:</strong> {numChildren}</p>
                 <p><strong>Duração:</strong> {eventDuration} horas</p>
                <p><strong>Valor Final Orçado:</strong> {formatCurrency(costs.finalPrice)}</p>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-4 border-t border-gray-700">
              <button onClick={() => setIsSaveModalOpen(false)} className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-500">Cancelar</button>
              <button onClick={handleSaveAsEvent} className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-500">Salvar Evento</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Simulator;

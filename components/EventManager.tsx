
import React, { useState, useMemo } from 'react';
import type { Event, Drink, Ingredient, Company } from '../types.ts';
import { Plus, Trash2, CheckSquare, X, Users, Calendar, DollarSign, Clock, FileText } from 'lucide-react';
import { generateProposalPDF } from '../utils/pdfGenerator.ts';
import { useLocalStorage } from '../hooks/useLocalStorage.ts';
import { api } from '../lib/supabase.ts';
import { ENABLE_DATABASE } from '../config.ts';

interface EventManagerProps {
  events: Event[];
  setEvents: React.Dispatch<React.SetStateAction<Event[]>>;
  drinks: Drink[];
  ingredients: Ingredient[];
  setIngredients: React.Dispatch<React.SetStateAction<Ingredient[]>>;
  company: Company;
}

const EventManager: React.FC<EventManagerProps> = ({ events, setEvents, drinks, ingredients, setIngredients, company }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newEvent, setNewEvent] = useLocalStorage<{
    name: string; startDateTime: string; endDateTime: string; numAdults: number; numChildren: number; selectedDrinks: string[];
  }>(`${company.id}_event_new`, {
    name: '', startDateTime: '', endDateTime: '', numAdults: 10, numChildren: 0, selectedDrinks: [],
  });
  
  const drinkMap = useMemo(() => new Map(drinks.map(d => [d.id, d])), [drinks]);
  const ingredientMap = useMemo(() => new Map(ingredients.map(i => [i.id, i])), [ingredients]);
  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

  const handleSaveEvent = async () => {
    if (newEvent.name && newEvent.startDateTime && newEvent.endDateTime && newEvent.selectedDrinks.length > 0) {
      const startDateTime = new Date(newEvent.startDateTime);
      const endDateTime = new Date(newEvent.endDateTime);
       if (endDateTime <= startDateTime) { alert("Data fim deve ser maior que início."); return; }

      const event: Event = {
        id: crypto.randomUUID(),
        name: newEvent.name,
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
        status: 'planned',
        numAdults: newEvent.numAdults,
        numChildren: newEvent.numChildren,
        selectedDrinks: newEvent.selectedDrinks,
      };

      setEvents([...events, event].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()));
      
      if (ENABLE_DATABASE) {
          await api.events.save(company.id, event);
      }

      setNewEvent({ name: '', startDateTime: '', endDateTime: '', numAdults: 10, numChildren: 0, selectedDrinks: [] });
      closeModal();
    } else {
        alert("Preencha todos os campos.");
    }
  };

  const isDrinkAlcoholic = (drink: Drink) => drink.ingredients.some(di => ingredientMap.get(di.ingredientId)?.isAlcoholic);

  const handleCompleteEvent = async (eventId: string) => {
    const event = events.find(e => e.id === eventId);
    if (!event || event.status === 'completed') return;

    const ingredientUsage = new Map<string, number>();
    const durationInHours = (new Date(event.endTime).getTime() - new Date(event.startTime).getTime()) / (1000 * 60 * 60);
    if (durationInHours <= 0) return;

    for (const drinkId of event.selectedDrinks) {
        const drink = drinkMap.get(drinkId);
        if (drink) {
            const drinkIsAlcoholic = isDrinkAlcoholic(drink);
            const totalServings = (event.numAdults * durationInHours * drink.consumptionEstimate.adults) + 
                                  (drinkIsAlcoholic ? 0 : (event.numChildren * durationInHours * drink.consumptionEstimate.children));
            if (totalServings > 0) {
              for (const recipeItem of drink.ingredients) {
                  const currentUsage = ingredientUsage.get(recipeItem.ingredientId) || 0;
                  ingredientUsage.set(recipeItem.ingredientId, currentUsage + (recipeItem.quantity * totalServings));
              }
            }
        }
    }

    // Clone ingredients to update stock
    const newIngredients = JSON.parse(JSON.stringify(ingredients)) as Ingredient[];
    for (const ing of newIngredients) {
        if (ingredientUsage.has(ing.id)) {
          let needed = ingredientUsage.get(ing.id) ?? 0;
          ing.stockEntries.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
          for (const entry of ing.stockEntries) {
            if (needed <= 0) break;
            const deduct = Math.min(needed, entry.remainingQuantity);
            entry.remainingQuantity -= deduct;
            needed -= deduct;
          }
          // Save ingredient stock update
          if (ENABLE_DATABASE) await api.ingredients.save(company.id, ing);
        }
    }
    setIngredients(newIngredients);

    // Update event status
    const updatedEvent = { ...event, status: 'completed' as const };
    setEvents(prev => prev.map(e => (e.id === eventId ? updatedEvent : e)));
    
    if (ENABLE_DATABASE) {
        await api.events.save(company.id, updatedEvent);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (confirm("Excluir este evento?")) {
      setEvents(events.filter(e => e.id !== eventId));
      if (ENABLE_DATABASE) await api.events.delete(eventId);
    }
  };

  const handleGeneratePDF = (event: Event) => {
    const fullDrinks = event.selectedDrinks.map(id => drinks.find(d => d.id === id)).filter((d): d is Drink => d !== undefined);
    generateProposalPDF(event, company, fullDrinks, event.staff || []);
  };
  
  const handleToggleDrink = (drinkId: string) => {
    setNewEvent(prev => ({
        ...prev, selectedDrinks: prev.selectedDrinks.includes(drinkId) ? prev.selectedDrinks.filter(id => id !== drinkId) : [...prev.selectedDrinks, drinkId]
    }));
  };

  const StatusBadge = ({ status }: { status: Event['status'] }) => {
    return <span className={`px-2 py-1 text-xs font-bold rounded-full ${status === 'completed' ? 'bg-green-500 text-white' : 'bg-amber-500 text-white'}`}>{status === 'completed' ? 'Concluído' : 'Planejado'}</span>;
  };
  
  const formatDateTime = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const formatCurrency = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button onClick={openModal} className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-500">
          <Plus size={18} /> Adicionar Novo Evento
        </button>
      </div>
      <div className="p-6 bg-gray-800 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold mb-4 text-orange-400">Próximos Eventos</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.length > 0 ? events.map(event => {
            const duration = (new Date(event.endTime).getTime() - new Date(event.startTime).getTime()) / (1000 * 60 * 60);
            return (
              <div key={event.id} className="bg-gray-700/50 rounded-lg p-5 flex flex-col">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-lg font-bold text-white">{event.name}</h3>
                  <StatusBadge status={event.status} />
                </div>
                <div className="space-y-3 text-sm text-gray-300 mb-4">
                    <p className="flex items-center gap-2"><Calendar size={14} /> {formatDateTime(event.startTime)}</p>
                    <p className="flex items-center gap-2"><Clock size={14} /> Duração: {duration.toFixed(1)} horas</p>
                    <p className="flex items-center gap-2"><Users size={14} /> {event.numAdults} Adultos, {event.numChildren} Crianças</p>
                    {event.simulatedCosts && <p className="flex items-center gap-2 font-semibold text-orange-300"><DollarSign size={14} /> Orçado: {formatCurrency(event.simulatedCosts.finalPrice)}</p>}
                </div>
                 <div className="mt-auto pt-4 flex gap-2 justify-end flex-wrap">
                  <button onClick={() => handleGeneratePDF(event)} className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-600/20 text-blue-400 border border-blue-500/50 rounded-md hover:bg-blue-600 hover:text-white"><FileText size={14} /> PDF</button>
                  {event.status === 'planned' && <button onClick={() => handleCompleteEvent(event.id)} className="flex items-center gap-1 px-3 py-1.5 text-xs bg-green-600 text-white rounded-md hover:bg-green-500"><CheckSquare size={14} /> Concluir</button>}
                  <button onClick={() => handleDeleteEvent(event.id)} className="flex items-center gap-1 px-3 py-1.5 text-xs bg-red-600 text-white rounded-md hover:bg-red-500"><Trash2 size={14} /> Excluir</button>
                </div>
              </div>
            )
          }) : <p className="text-center text-gray-500 col-span-full">Nenhum evento agendado.</p>}
        </div>
      </div>
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
           <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-gray-700">
              <h3 className="text-xl font-bold text-orange-400">Adicionar Novo Evento</h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-white"><X size={24} /></button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto">
              <input type="text" placeholder="Nome do Evento" value={newEvent.name} onChange={e => setNewEvent({...newEvent, name: e.target.value})} className="w-full bg-gray-700 text-white border border-gray-600 rounded-md px-3 py-2" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <input type="datetime-local" value={newEvent.startDateTime} onChange={e => setNewEvent({...newEvent, startDateTime: e.target.value})} className="w-full bg-gray-700 text-white border border-gray-600 rounded-md px-3 py-2" />
                 <input type="datetime-local" value={newEvent.endDateTime} onChange={e => setNewEvent({...newEvent, endDateTime: e.target.value})} className="w-full bg-gray-700 text-white border border-gray-600 rounded-md px-3 py-2" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input type="number" placeholder="Nº de Adultos" value={newEvent.numAdults} onChange={e => setNewEvent({...newEvent, numAdults: parseInt(e.target.value)})} className="w-full bg-gray-700 text-white border border-gray-600 rounded-md px-3 py-2" />
                <input type="number" placeholder="Nº de Crianças" value={newEvent.numChildren} onChange={e => setNewEvent({...newEvent, numChildren: parseInt(e.target.value)})} className="w-full bg-gray-700 text-white border border-gray-600 rounded-md px-3 py-2" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-200 mb-2">Selecione os Drinks</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-2 bg-gray-700/50 rounded">
                    {drinks.map(drink => (
                         <label key={drink.id} className="flex items-center space-x-2 p-2 rounded-md hover:bg-gray-600 cursor-pointer">
                            <input type="checkbox" checked={newEvent.selectedDrinks.includes(drink.id)} onChange={() => handleToggleDrink(drink.id)} className="h-4 w-4 rounded bg-gray-700 border-gray-600 text-orange-600" />
                            <span className="text-white text-sm">{drink.name}</span>
                        </label>
                    ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-4 border-t border-gray-700 mt-auto">
              <button onClick={closeModal} className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-500">Cancelar</button>
              <button onClick={handleSaveEvent} className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-500">Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EventManager;


import React, { useState, useEffect } from 'react';
import type { Drink, Ingredient, Event, Company } from '../types.ts';
import { useLocalStorage } from '../hooks/useLocalStorage.ts';
import { api } from '../lib/supabase.ts';
import { ENABLE_DATABASE } from '../config.ts';
import IngredientManager from './IngredientManager.tsx';
import DrinkManager from './DrinkManager.tsx';
import Simulator from './Simulator.tsx';
import EventManager from './EventManager.tsx';
import StockManager from './StockManager.tsx';
import { Martini, Droplets, Calculator, Calendar, Package, LogOut, Shield, ArrowLeft, Loader2 } from 'lucide-react';

type Tab = 'ingredients' | 'drinks' | 'simulator' | 'events' | 'stock';

interface DashboardProps {
    company: Company;
    onLogout: () => void;
    isMasterAdmin?: boolean;
    onSwitchToAdmin?: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ company, onLogout, isMasterAdmin, onSwitchToAdmin }) => {
  const [activeTab, setActiveTab] = useLocalStorage<Tab>(`${company.id}_active_tab`, 'simulator');
  const [loadingData, setLoadingData] = useState(false);
  
  const [ingredients, setIngredients] = useLocalStorage<Ingredient[]>(`${company.id}_ingredients`, []);
  const [drinks, setDrinks] = useLocalStorage<Drink[]>(`${company.id}_drinks`, []);
  const [events, setEvents] = useLocalStorage<Event[]>(`${company.id}_events`, []);

  // CARREGAR DADOS DO SUPABASE AO INICIAR
  useEffect(() => {
      if (ENABLE_DATABASE && company) {
          const fetchData = async () => {
              setLoadingData(true);
              try {
                  // Carrega tudo em paralelo
                  const [loadedIngredients, loadedDrinks, loadedEvents] = await Promise.all([
                      api.ingredients.list(company.id),
                      api.drinks.list(company.id),
                      api.events.list(company.id)
                  ]);

                  // Atualiza estados
                  if (loadedIngredients.length > 0) setIngredients(loadedIngredients);
                  if (loadedDrinks.length > 0) setDrinks(loadedDrinks);
                  if (loadedEvents.length > 0) setEvents(loadedEvents);
                  
              } catch (error) {
                  console.error("Erro ao carregar dados:", error);
              } finally {
                  setLoadingData(false);
              }
          };
          fetchData();
      }
  }, [company.id]);

  const renderContent = () => {
    if (loadingData && ingredients.length === 0 && drinks.length === 0) {
        return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-orange-500" size={40}/></div>;
    }

    switch (activeTab) {
      case 'ingredients':
        return <IngredientManager ingredients={ingredients} setIngredients={setIngredients} company={company} />;
      case 'stock':
        return <StockManager ingredients={ingredients} setIngredients={setIngredients} company={company} />;
      case 'drinks':
        return <DrinkManager drinks={drinks} setDrinks={setDrinks} ingredients={ingredients} company={company} />;
      case 'simulator':
        return <Simulator drinks={drinks} ingredients={ingredients} setEvents={setEvents} company={company} />;
      case 'events':
        return <EventManager events={events} setEvents={setEvents} drinks={drinks} ingredients={ingredients} setIngredients={setIngredients} company={company} />;
      default:
        return null;
    }
  };

  const TabButton = ({ tab, label, icon }: { tab: Tab; label: string; icon: React.ReactNode }) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={`flex-1 flex items-center justify-center gap-2 px-2 sm:px-4 py-3 text-sm md:text-base font-medium rounded-t-lg transition-colors focus:outline-none focus:ring-2 focus:ring-orange-400 ${
        activeTab === tab ? 'bg-gray-800 text-orange-400' : 'text-gray-400 hover:bg-gray-700 hover:text-white'
      }`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );

  const getRoleLabel = (role: string) => {
      switch(role) {
          case 'admin': return 'Administrador';
          case 'manager': return 'Gerente';
          case 'bartender': return 'Bartender';
          default: return role;
      }
  }

  const LogoCD = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M 45 15 A 35 35 0 1 0 45 85" stroke="currentColor" strokeWidth="14" strokeLinecap="butt"/>
        <path d="M 55 15 L 55 85 A 35 35 0 0 0 55 15" stroke="currentColor" strokeWidth="14" strokeLinecap="butt"/>
    </svg>
  );

  return (
    <div className="min-h-screen bg-gray-900 font-sans">
      <header className="bg-gray-800 shadow-lg shadow-black/20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 flex-shrink-0 text-orange-600 bg-white/10 rounded-full p-0.5">
                <LogoCD className="w-full h-full" />
             </div>
            <div>
                <h1 className="text-xl md:text-2xl font-bold text-white tracking-wider leading-none">CalculaDrink</h1>
                <div className="flex items-center gap-2">
                    <p className="text-xs text-gray-400 font-medium">{company.name}</p>
                    <span className="bg-gray-700 text-orange-300 text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 uppercase font-bold tracking-wide">
                        <Shield size={10} /> {getRoleLabel(company.role)}
                    </span>
                </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {isMasterAdmin && onSwitchToAdmin && (
                <button onClick={onSwitchToAdmin} className="flex items-center gap-2 text-sm bg-orange-600/20 text-orange-400 hover:bg-orange-600 hover:text-white border border-orange-600/50 transition-colors px-3 py-2 rounded">
                    <ArrowLeft size={18} /> <span className="hidden sm:inline">Voltar para Admin</span>
                </button>
            )}
            <button onClick={onLogout} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors px-3 py-2 rounded hover:bg-gray-700" title="Sair da empresa">
                <span className="hidden sm:inline">Sair</span> <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>
      
      <main className="container mx-auto p-4 sm:p-6 lg:p-8">
        <div className="bg-gray-900 border-b border-gray-700 mb-6">
          <nav className="flex -mb-px overflow-x-auto">
            <TabButton tab="simulator" label="Simulador" icon={<Calculator size={18} />} />
            <TabButton tab="events" label="Eventos" icon={<Calendar size={18} />} />
            <TabButton tab="drinks" label="Drinks" icon={<Martini size={18} />} />
            <TabButton tab="ingredients" label="Insumos" icon={<Droplets size={18} />} />
            <TabButton tab="stock" label="Estoque" icon={<Package size={18} />} />
          </nav>
        </div>
        {renderContent()}
      </main>
    </div>
  );
};

export default Dashboard;

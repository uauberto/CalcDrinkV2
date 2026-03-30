
import React, { useState } from 'react';
import type { Company } from '../types.ts';
import { Check, CreditCard, Star, Loader2, LogOut } from 'lucide-react';

interface SubscriptionProps {
  company: Company;
  onSubscribe: (plan: 'monthly' | 'yearly') => Promise<void>;
  onLogout: () => void;
}

const Subscription: React.FC<SubscriptionProps> = ({ company, onSubscribe, onLogout }) => {
  const [isLoading, setIsLoading] = useState<'monthly' | 'yearly' | null>(null);
  
  const isOverdue = company.status === 'suspended' || (company.nextBillingDate && new Date(company.nextBillingDate) < new Date());

  const handleSelectPlan = async (plan: 'monthly' | 'yearly') => {
      setIsLoading(plan);
      try {
          // Execute the subscription logic
          await onSubscribe(plan);
          // Note: We don't explicitly set isLoading(false) here because 
          // if successful, the parent App component will unmount this 
          // view and mount the Dashboard immediately.
      } catch (error) {
          console.error("Erro ao assinar:", JSON.stringify(error, null, 2));
          setIsLoading(null);
      }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-12">
            {isOverdue ? (
                 <span className="inline-block py-1 px-3 rounded-full bg-red-500/20 text-red-400 text-sm font-bold mb-4 animate-pulse">
                    Assinatura Pendente / Vencida
                 </span>
            ) : (
                <span className="inline-block py-1 px-3 rounded-full bg-orange-500/20 text-orange-400 text-sm font-bold mb-4">
                    Planos & Preços
                 </span>
            )}
          <h1 className="text-4xl font-bold text-white mb-4">Escolha o plano ideal para o seu negócio</h1>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Desbloqueie todas as funcionalidades do CalculaDrink e comece a lucrar mais com seus eventos hoje mesmo.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Plano Mensal */}
          <div className={`bg-gray-800 rounded-2xl p-8 border border-gray-700 hover:border-orange-500 transition-all flex flex-col ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}>
            <h3 className="text-xl font-semibold text-white mb-2">Mensal</h3>
            <div className="flex items-baseline gap-1 mb-6">
              <span className="text-4xl font-bold text-white">R$ 49,90</span>
              <span className="text-gray-400">/mês</span>
            </div>
            <ul className="space-y-4 mb-8 flex-1">
              <li className="flex items-center gap-3 text-gray-300">
                <Check className="text-green-400" size={20} /> Cadastro ilimitado de drinks
              </li>
              <li className="flex items-center gap-3 text-gray-300">
                <Check className="text-green-400" size={20} /> Simulação de custos de eventos
              </li>
              <li className="flex items-center gap-3 text-gray-300">
                <Check className="text-green-400" size={20} /> Controle de estoque básico
              </li>
              <li className="flex items-center gap-3 text-gray-300">
                <Check className="text-green-400" size={20} /> Suporte por e-mail
              </li>
            </ul>
            <button 
              onClick={() => handleSelectPlan('monthly')}
              disabled={isLoading !== null}
              className="w-full bg-gray-700 hover:bg-orange-600 hover:text-white text-white font-bold py-3 px-4 rounded-lg transition-all flex items-center justify-center gap-2 disabled:cursor-not-allowed"
            >
              {isLoading === 'monthly' ? <Loader2 className="animate-spin" /> : null}
              {isLoading === 'monthly' ? 'Processando...' : 'Assinar Mensal'}
            </button>
          </div>

          {/* Plano Anual */}
          <div className={`bg-gray-800 rounded-2xl p-8 border-2 border-orange-500 relative flex flex-col transform md:-translate-y-4 shadow-xl shadow-orange-900/20 ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}>
            <div className="absolute top-0 right-0 bg-orange-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg rounded-tr-lg">
              MAIS POPULAR
            </div>
            <h3 className="text-xl font-semibold text-white mb-2 flex items-center gap-2">
                Anual <Star className="text-yellow-400 fill-yellow-400" size={16}/>
            </h3>
            <div className="flex items-baseline gap-1 mb-2">
              <span className="text-4xl font-bold text-white">R$ 39,90</span>
              <span className="text-gray-400">/mês</span>
            </div>
            <p className="text-sm text-green-400 mb-6 font-medium">Cobrado anualmente (R$ 478,80)</p>
            
            <ul className="space-y-4 mb-8 flex-1">
              <li className="flex items-center gap-3 text-white">
                <Check className="text-orange-500" size={20} /> <strong>Tudo do plano mensal</strong>
              </li>
               <li className="flex items-center gap-3 text-white">
                <Check className="text-orange-500" size={20} /> <strong>20% de desconto</strong>
              </li>
              <li className="flex items-center gap-3 text-white">
                <Check className="text-orange-500" size={20} /> Relatórios avançados
              </li>
              <li className="flex items-center gap-3 text-white">
                <Check className="text-orange-500" size={20} /> Suporte prioritário (WhatsApp)
              </li>
            </ul>
            <button 
              onClick={() => handleSelectPlan('yearly')}
              disabled={isLoading !== null}
              className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold py-3 px-4 rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg disabled:cursor-not-allowed"
            >
              {isLoading === 'yearly' ? <Loader2 className="animate-spin" /> : <CreditCard size={20} />}
              {isLoading === 'yearly' ? 'Processando...' : 'Assinar Anual'}
            </button>
          </div>
        </div>
        
        <div className="mt-12 text-center">
             <button 
                onClick={onLogout}
                disabled={isLoading !== null}
                className="flex items-center justify-center gap-2 text-gray-500 hover:text-gray-300 text-sm transition-colors mx-auto"
            >
                <LogOut size={16} />
                Sair e cancelar processo
            </button>
        </div>
      </div>
    </div>
  );
};

export default Subscription;

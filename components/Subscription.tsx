import React, { useState, useEffect } from 'react';
import type { Company, SystemSettings } from '../types.ts';
import { api } from '../lib/supabase.ts';
import { Check, CreditCard, Star, Loader2, LogOut, Copy, ExternalLink, ShieldCheck } from 'lucide-react';

interface SubscriptionProps {
  company: Company;
  onSubscribe: (plan: 'monthly' | 'yearly') => Promise<void>;
  onLogout: () => void;
}

const Subscription: React.FC<SubscriptionProps> = ({ company, onSubscribe, onLogout }) => {
  const [isLoading, setIsLoading] = useState<'monthly' | 'yearly' | null>(null);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [showPixModal, setShowPixModal] = useState<'monthly' | 'yearly' | null>(null);
  const [pixCopied, setPixCopied] = useState(false);
  
  const isOverdue = company.status === 'suspended' || (company.nextBillingDate && new Date(company.nextBillingDate) < new Date());

  useEffect(() => {
     const fetchSettings = async () => {
         const data = await api.admin.getSettings();
         if (data) {
             setSettings(data);
         } else {
             // Fallbacks if not configured
             setSettings({ id: '1', monthlyPrice: 49.90, yearlyPrice: 39.90, paymentMethod: 'pix', pixKey: 'financeiro@calculadrink.com.br', paymentLinkMonthly: '', paymentLinkYearly: '', paymentInstructions: 'Realize a transferência via PIX e aguarde aprovação.' });
         }
     }
     fetchSettings();
  },[]);

  const formatPrice = (price: number) => {
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price);
  };

  const handleSelectPlan = async (plan: 'monthly' | 'yearly') => {
      if (!settings) return;
      
      if (settings.paymentMethod === 'none') {
          // Free access / instant approval
          setIsLoading(plan);
          try {
              await onSubscribe(plan);
          } catch (error) {
              console.error(error);
              setIsLoading(null);
          }
      } else if (settings.paymentMethod === 'link') {
          // Redirect to external gateway
          const link = plan === 'monthly' ? settings.paymentLinkMonthly : settings.paymentLinkYearly;
          if (link) {
              window.open(link, '_blank');
              alert("Você foi redirecionado para a página de pagamento seguro. Após pagar, sua conta será liberada pelo administrador em breve.");
          } else {
              alert("Nenhum link configurado para este plano.");
          }
      } else if (settings.paymentMethod === 'pix') {
          // Show PIX Instructions
          setShowPixModal(plan);
      }
  };

  const handleConfirmPixPayment = async () => {
       if (!showPixModal) return;
       setIsLoading(showPixModal);
       try {
           // Em vez de onSubscribe(que ativa), nós apenas avisamos e deixamos o usuário preso até o admin aprovar.
           // Mas a regra de negócio atual onSubscribe ativa diretamente na base. Precisamos alterar App.tsx depois ou avisar.
           // Se chamarmos onSubscribe ele ganha "Active" falso. Como o PIX é manual, a gente pode NÃO chamar onSubscribe,
           // apenas agradecer e pedir pra ele aguardar. 
           alert("Recebemos sua confirmação! O administrador irá processar sua liberação em alguns minutos. Atualize a página mais tarde.");
           setShowPixModal(null);
           setIsLoading(null);
       } catch (error) {
           console.error(error);
           setIsLoading(null);
       }
  }

  const copyPix = () => {
      if(settings?.pixKey) {
          navigator.clipboard.writeText(settings.pixKey);
          setPixCopied(true);
          setTimeout(() => setPixCopied(false), 3000);
      }
  }

  if (!settings) {
      return (
         <div className="min-h-screen bg-gray-900 flex flex-col justify-center items-center">
            <Loader2 className="animate-spin text-orange-500 mb-4" size={48} />
            <p className="text-gray-400">Carregando planos...</p>
         </div>
      );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4">
      <div className="max-w-4xl w-full relative">
        <div className="text-center mb-12">
            {isOverdue ? (
                 <span className="inline-block py-1 px-3 rounded-full bg-red-500/20 text-red-400 text-sm font-bold mb-4 animate-pulse">
                    Assinatura Pendente ou Vencida
                 </span>
            ) : (
                <span className="inline-block py-1 px-3 rounded-full bg-orange-500/20 text-orange-400 text-sm font-bold mb-4">
                    Planos & Preços
                 </span>
            )}
            
          <h1 className="text-4xl font-bold text-white mb-4">Escolha o plano ideal para o seu negócio</h1>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Desbloqueie todas as funcionalidades restritas do sistema e comece a lucrar mais de imediato.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Plano Mensal */}
          <div className={`bg-gray-800 rounded-2xl p-8 border border-gray-700 hover:border-orange-500 transition-all flex flex-col ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}>
            <h3 className="text-xl font-semibold text-white mb-2">Mensal</h3>
            <div className="flex items-baseline gap-1 mb-6">
              <span className="text-4xl font-bold text-white">{formatPrice(settings.monthlyPrice)}</span>
              <span className="text-gray-400">/mês</span>
            </div>
            <ul className="space-y-4 mb-8 flex-1">
              <li className="flex items-center gap-3 text-gray-300">
                <Check className="text-green-400" size={20} /> Todas as simulações e cálculos
              </li>
              <li className="flex items-center gap-3 text-gray-300">
                <Check className="text-green-400" size={20} /> Controle analítico de fichas
              </li>
              <li className="flex items-center gap-3 text-gray-300">
                <Check className="text-green-400" size={20} /> Cadastro ilimitado
              </li>
              <li className="flex items-center gap-3 text-gray-300">
                <Check className="text-green-400" size={20} /> Suporte básico
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
              <span className="text-4xl font-bold text-white">{formatPrice(settings.yearlyPrice)}</span>
              <span className="text-gray-400">/mês</span>
            </div>
            <p className="text-sm text-green-400 mb-6 font-medium">Cobrado anualmente ({formatPrice(settings.yearlyPrice * 12)})</p>
            
            <ul className="space-y-4 mb-8 flex-1">
              <li className="flex items-center gap-3 text-white">
                <Check className="text-orange-500" size={20} /> <strong>Tudo do plano mensal</strong>
              </li>
               <li className="flex items-center gap-3 text-white">
                <Check className="text-orange-500" size={20} /> <strong>Até 20% de economia anual</strong>
              </li>
              <li className="flex items-center gap-3 text-white">
                <Check className="text-orange-500" size={20} /> Suporte Prioritário
              </li>
              <li className="flex items-center gap-3 text-white">
                <Check className="text-orange-500" size={20} /> Relatórios Financeiros VIP
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
                Sair e Cancelar
            </button>
        </div>

        {/* PIX Modal */}
        {showPixModal && (
            <div className="fixed inset-0 bg-black/80 flex justify-center items-center z-50 p-4 backdrop-blur-sm">
                 <div className="bg-gray-800 rounded-2xl w-full max-w-md p-6 border border-gray-700 shadow-2xl">
                     <div className="text-center mb-6">
                         <div className="w-16 h-16 bg-blue-600/20 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-500/30">
                             <CreditCard size={32} />
                         </div>
                         <h2 className="text-2xl font-bold text-white mb-2">Pagamento via PIX</h2>
                         <p className="text-gray-400 text-sm">{settings.paymentInstructions}</p>
                     </div>

                     <div className="bg-gray-900 rounded-xl p-4 mb-6 border border-gray-700">
                         <p className="text-xs text-gray-500 uppercase font-bold mb-2">Valor da Transferência</p>
                         <p className="text-3xl font-extrabold text-orange-500 mb-4">
                             {showPixModal === 'monthly' ? formatPrice(settings.monthlyPrice) : formatPrice(settings.yearlyPrice * 12)}
                         </p>

                         <p className="text-xs text-gray-500 uppercase font-bold mb-2">Chave PIX (Copia e Cola)</p>
                         <div className="flex items-center gap-2">
                             <input 
                                readOnly 
                                value={settings.pixKey} 
                                className="flex-1 bg-gray-800 text-white font-mono text-sm px-3 py-2 rounded border border-gray-600 outline-none"
                             />
                             <button 
                                onClick={copyPix}
                                className={`p-2 rounded ${pixCopied ? 'bg-green-600' : 'bg-gray-700 hover:bg-gray-600'} text-white transition-colors`}
                                title="Copiar Chave"
                             >
                                 {pixCopied ? <Check size={20} /> : <Copy size={20} />}
                             </button>
                         </div>
                     </div>

                     <div className="flex gap-3">
                         <button 
                            onClick={() => setShowPixModal(null)}
                            className="flex-1 py-3 px-4 rounded-lg border border-gray-600 text-white font-bold hover:bg-gray-700 transition"
                         >
                             Mudar Plano
                         </button>
                         <button 
                            onClick={handleConfirmPixPayment}
                            className="flex-1 py-3 px-4 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-bold transition flex justify-center items-center gap-2"
                         >
                             <ShieldCheck size={20} /> Já transferi
                         </button>
                     </div>
                 </div>
            </div>
        )}

      </div>
    </div>
  );
};

export default Subscription;

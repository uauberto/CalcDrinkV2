import React, { useState, useEffect } from 'react';
import { api } from '../lib/supabase.ts';
import type { SystemSettings } from '../types.ts';
import { Save, Loader2, DollarSign, Link as LinkIcon, Edit3 } from 'lucide-react';

const SystemSettingsTab: React.FC = () => {
    const [settings, setSettings] = useState<SystemSettings | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        setIsLoading(true);
        try {
            const data = await api.admin.getSettings();
            if (data) {
                setSettings(data);
            } else {
                // Se não existir na base, criamos um default mock para a UI gerenciar e depois gravar
                setSettings({
                    id: '00000000-0000-0000-0000-000000000001',
                    monthlyPrice: 49.90,
                    yearlyPrice: 39.90,
                    paymentMethod: 'pix',
                    pixKey: '',
                    paymentLinkMonthly: '',
                    paymentLinkYearly: '',
                    paymentInstructions: 'Para confirmar sua assinatura, realize o pagamento via PIX correspondente ao plano escolhido. A liberação ocorrerá manualmente após a confirmação.'
                });
            }
        } catch (error) {
            console.error("Erro ao carregar configurações", error);
        }
        setIsLoading(false);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!settings) return;

        setIsSaving(true);
        try {
            const success = await api.admin.updateSettings(settings);
            if (success) {
                alert("Configurações salvas com sucesso!");
            } else {
                alert("Erro ao salvar no banco. Verifique o console.");
            }
        } catch (error) {
            console.error("Save error:", error);
            alert("Erro ao salvar as configurações.");
        }
        setIsSaving(false);
    };

    if (isLoading) {
        return (
            <div className="flex justify-center py-20">
                <Loader2 className="animate-spin text-orange-500" size={48} />
            </div>
        );
    }

    if (!settings) return null;

    return (
        <div className="max-w-4xl mx-auto">
            <div className="mb-8">
                <h2 className="text-2xl font-bold text-white mb-2">Configurações de Assinatura</h2>
                <p className="text-gray-400">Personalize os preços, métodos de cobrança e links exibidos na tela de pagamento para novos usuários.</p>
            </div>

            <form onSubmit={handleSave} className="space-y-6">
                
                {/* PREÇOS */}
                <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 shadow-md">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <DollarSign className="text-orange-500" /> Valores dos Planos
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Preço Mensal (R$)</label>
                            <input 
                                type="number" step="0.01" min="0" required
                                value={settings.monthlyPrice}
                                onChange={e => setSettings({...settings, monthlyPrice: parseFloat(e.target.value)})}
                                className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-4 py-2.5 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Preço Anual Mensalizado (R$)</label>
                            <p className="text-xs text-gray-500 mb-2">Insira o valor correspondente a 1 mês dentro do pacote anual.</p>
                            <input 
                                type="number" step="0.01" min="0" required
                                value={settings.yearlyPrice}
                                onChange={e => setSettings({...settings, yearlyPrice: parseFloat(e.target.value)})}
                                className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-4 py-2.5 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                            />
                        </div>
                    </div>
                </div>

                {/* MÉTODO DE PAGAMENTO */}
                <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 shadow-md">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <LinkIcon className="text-orange-500" /> Forma de Recebimento
                    </h3>
                    
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-300 mb-2">Selecione como quer receber o cliente</label>
                        <select
                            value={settings.paymentMethod}
                            onChange={(e) => setSettings({...settings, paymentMethod: e.target.value as any})}
                            className="bg-gray-900 border border-gray-700 text-white rounded-lg px-4 py-2.5 w-full max-w-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                        >
                            <option value="pix">PIX Manual (Você aprova no sistema)</option>
                            <option value="link">Link Externo (MercadoPago/Stripe)</option>
                            <option value="none">Sempre grátis / Desativar muro</option>
                        </select>
                    </div>

                    {settings.paymentMethod === 'pix' && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Chave PIX (E-mail, CPF, Telefone ou Aleatória)</label>
                                <input 
                                    type="text" 
                                    value={settings.pixKey}
                                    onChange={e => setSettings({...settings, pixKey: e.target.value})}
                                    placeholder="Ex: financeiro@calculadrink.com.br"
                                    className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-4 py-2.5 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 font-mono"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Instruções para o usuário</label>
                                <textarea 
                                    value={settings.paymentInstructions}
                                    lines={3}
                                    onChange={e => setSettings({...settings, paymentInstructions: e.target.value})}
                                    placeholder="Instruções de como mandar o comprovante..."
                                    className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-4 py-2.5 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                                />
                            </div>
                        </div>
                    )}

                    {settings.paymentMethod === 'link' && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Link de Pagamento MENSAL (ex: MercadoPago)</label>
                                <input 
                                    type="url" 
                                    value={settings.paymentLinkMonthly}
                                    onChange={e => setSettings({...settings, paymentLinkMonthly: e.target.value})}
                                    placeholder="https://mpago.la/..."
                                    className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-4 py-2.5 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 font-mono"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Link de Pagamento ANUAL (ex: MercadoPago)</label>
                                <input 
                                    type="url" 
                                    value={settings.paymentLinkYearly}
                                    onChange={e => setSettings({...settings, paymentLinkYearly: e.target.value})}
                                    placeholder="https://mpago.la/..."
                                    className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-4 py-2.5 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 font-mono"
                                />
                            </div>
                            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mt-2">
                                <p className="text-sm text-blue-300">
                                    <strong>Atenção:</strong> Ao clicar, o cliente será levado ao site de pagamentos. Você continuará precisando vir neste painel Master para aprovar (Ativar) a empresa manualmente quando receber a notificação do Mercado Pago/Gateway.
                                </p>
                            </div>
                        </div>
                    )}

                </div>

                <div className="flex justify-end pt-4">
                    <button 
                        type="submit" 
                        disabled={isSaving}
                        className="flex items-center gap-2 px-6 py-3 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-lg shadow-xl shadow-orange-900/20 hover:shadow-orange-600/40 transition-all disabled:opacity-50"
                    >
                        {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                        {isSaving ? 'Salvando...' : 'Salvar Alterações Globais'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default SystemSettingsTab;

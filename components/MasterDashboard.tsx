
import React, { useState, useEffect } from 'react';
import type { Company } from '../types.ts';
import { api } from '../lib/supabase.ts';
import { Shield, LogOut, CheckCircle, XCircle, Search, Building2, User, LayoutDashboard, Unlock, KeyRound, X, Mail, Phone, CreditCard, RefreshCw, Copy, Filter, Users, MoreHorizontal } from 'lucide-react';

interface MasterDashboardProps {
    adminUser: Company;
    onLogout: () => void;
    onSwitchToApp: () => void;
}

const MasterDashboard: React.FC<MasterDashboardProps> = ({ adminUser, onLogout, onSwitchToApp }) => {
    const [companies, setCompanies] = useState<Company[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'pending_approval' | 'active' | 'suspended' | 'waiting_payment'>('all');
    
    // Estado do Modal de Redefinição de Senha
    const [resetPasswordModal, setResetPasswordModal] = useState<{isOpen: boolean, companyId: string, email: string} | null>(null);
    const [manualPassword, setManualPassword] = useState('');

    // Estado do Modal de Gerenciamento de Usuários
    const [managingUsersCompany, setManagingUsersCompany] = useState<Company | null>(null);

    useEffect(() => {
        loadCompanies();
    }, []);

    const loadCompanies = async () => {
        setIsLoading(true);
        const data = await api.admin.listAllCompanies();
        setCompanies(data);
        setIsLoading(false);
    };

    // Função auxiliar para gerar senha aleatória
    const generateRandomPassword = () => {
        return Math.random().toString(36).slice(-8).toUpperCase();
    };

    const openResetModal = (company: Company) => {
        setManualPassword(generateRandomPassword()); // Já sugere uma ao abrir
        setResetPasswordModal({ isOpen: true, companyId: company.id, email: company.email });
    };

    const handleUpdateStatus = async (id: string, newStatus: Company['status']) => {
        let message = '';
        
        switch (newStatus) {
            case 'active':
                message = "⚠️ Tem certeza que deseja LIBERAR O ACESSO desta empresa manualmente (Gratuitamente)?";
                break;
            case 'suspended':
                message = "⛔ ATENÇÃO: Tem certeza que deseja SUSPENDER esta empresa? O usuário perderá o acesso imediatamente.";
                break;
            case 'waiting_payment':
                message = "✅ Tem certeza que deseja APROVAR o cadastro e liberar para pagamento?";
                break;
            default:
                message = "Tem certeza que deseja alterar o status desta empresa?";
        }

        if (!window.confirm(message)) return;

        const success = await api.admin.updateCompanyStatus(id, newStatus);
        if (success) {
            setCompanies(prev => prev.map(c => c.id === id ? { ...c, status: newStatus } : c));
            // Atualiza também o modal se estiver aberto
            if (managingUsersCompany && managingUsersCompany.id === id) {
                setManagingUsersCompany(prev => prev ? { ...prev, status: newStatus } : null);
            }
        } else {
            alert("Erro ao atualizar status.");
        }
    };

    const handleRoleChange = async (id: string, newRole: string) => {
        const roleName = newRole === 'admin' ? 'Administrador' : newRole === 'manager' ? 'Gerente' : 'Bartender';
        
        if (!window.confirm(`Tem certeza que deseja alterar o nível de acesso deste usuário para ${roleName.toUpperCase()}?`)) {
            // Se cancelar, precisamos forçar o re-render para voltar o select ao valor original
            // Uma forma simples é recarregar a lista ou usar um estado local forçado.
            // Aqui vamos recarregar a lista localmente para simplificar
            setCompanies([...companies]);
            return;
        }

        const success = await api.admin.updateCompanyRole(id, newRole);
        if (success) {
            setCompanies(prev => prev.map(c => c.id === id ? { ...c, role: newRole as any } : c));
             // Atualiza também o modal se estiver aberto
             if (managingUsersCompany && managingUsersCompany.id === id) {
                setManagingUsersCompany(prev => prev ? { ...prev, role: newRole as any } : null);
            }
        } else {
            alert("Erro ao atualizar cargo.");
        }
    };

    const handleConfirmResetPassword = async () => {
        if (!resetPasswordModal || !manualPassword) return;
        
        if (manualPassword.length < 4) {
            alert("A senha deve ter pelo menos 4 caracteres.");
            return;
        }

        const success = await api.admin.resetUserPassword(resetPasswordModal.companyId, manualPassword);
        
        if (success) {
            const subject = encodeURIComponent("Redefinição de Senha - CalculaDrink");
            const body = encodeURIComponent(`Olá,\n\nSua senha foi redefinida pelo administrador.\n\nNova Senha: ${manualPassword}\n\nAcesse em: https://uauberto.github.io/CalculaDrink/\n\nAtenciosamente,\nEquipe CalculaDrink`);
            
            // Pergunta se quer abrir o email
            if(window.confirm("Senha atualizada com sucesso!\n\nDeseja abrir o cliente de e-mail padrão para enviar a senha ao usuário?")) {
                 window.open(`mailto:${resetPasswordModal.email}?subject=${subject}&body=${body}`, '_blank');
            }
            
            setResetPasswordModal(null);
            setManualPassword('');
        } else {
            alert("Erro ao redefinir senha no banco de dados.");
        }
    };
    
    const copyToClipboard = () => {
        navigator.clipboard.writeText(manualPassword);
        alert("Senha copiada para a área de transferência!");
    }

    const filteredCompanies = companies.filter(c => {
        const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                              c.document.includes(searchTerm);
        
        if (filterStatus === 'all') return matchesSearch;
        return matchesSearch && c.status === filterStatus;
    });

    // Contadores para as abas
    const counts = {
        all: companies.length,
        pending: companies.filter(c => c.status === 'pending_approval').length,
        payment: companies.filter(c => c.status === 'waiting_payment').length,
        active: companies.filter(c => c.status === 'active').length,
        suspended: companies.filter(c => c.status === 'suspended').length,
    };

    const StatusBadge = ({ status }: { status: string }) => {
        switch (status) {
            case 'active': return <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs font-bold border border-green-500/30">ATIVO</span>;
            case 'pending_approval': return <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded text-xs font-bold border border-yellow-500/30">PENDENTE</span>;
            case 'waiting_payment': return <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs font-bold border border-blue-500/30">AGUARD. PAGTO</span>;
            case 'suspended': return <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs font-bold border border-red-500/30">SUSPENSO</span>;
            default: return <span className="px-2 py-1 bg-gray-500/20 text-gray-400 rounded text-xs font-bold border border-gray-500/30">{status}</span>;
        }
    };

    const ActionButtons = ({ company }: { company: Company }) => (
        <div className="flex items-center justify-end gap-2">
             {/* Ver Usuários */}
             <button 
                onClick={() => setManagingUsersCompany(company)}
                className="p-2 bg-gray-700 text-gray-300 hover:bg-orange-500 hover:text-white rounded-lg transition-colors text-xs font-bold"
                title="Gerenciar Usuários"
            >
                <Users size={16} />
            </button>

            {/* Redefinir Senha */}
            <button 
                onClick={() => openResetModal(company)}
                className="p-2 bg-gray-600/30 text-gray-300 hover:bg-orange-500 hover:text-white rounded-lg transition-colors text-xs font-bold"
                title="Redefinir Senha"
            >
                <KeyRound size={16} />
            </button>

            {/* Botão de Aprovar (Manda para Waiting Payment) */}
            {company.status === 'pending_approval' && (
                <button 
                    onClick={() => handleUpdateStatus(company.id, 'waiting_payment')}
                    className="p-2 bg-yellow-600/20 text-yellow-400 hover:bg-yellow-600 hover:text-white rounded-lg transition-colors text-xs font-bold flex items-center gap-1"
                    title="Aprovar Cadastro (Cobrar)"
                >
                    <CheckCircle size={16} />
                </button>
            )}

            {/* Botão de Liberar Acesso (Bypass Pagamento) */}
            {(company.status === 'pending_approval' || company.status === 'waiting_payment' || company.status === 'suspended') && (
                <button 
                    onClick={() => handleUpdateStatus(company.id, 'active')}
                    className="p-2 bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white rounded-lg transition-colors text-xs font-bold flex items-center gap-1"
                    title="Liberar Acesso Manualmente (Grátis)"
                >
                    <Unlock size={16} />
                </button>
            )}

            {/* Botão de Suspender */}
            {company.status === 'active' && (
                <button 
                    onClick={() => handleUpdateStatus(company.id, 'suspended')}
                    className="p-2 bg-red-600/20 text-red-400 hover:bg-red-600 hover:text-white rounded-lg transition-colors"
                    title="Suspender Acesso"
                >
                    <XCircle size={16} />
                </button>
            )}
        </div>
    );

    const FilterTab = ({ id, label, count, isActive }: { id: string, label: string, count: number, isActive: boolean }) => (
        <button 
            onClick={() => setFilterStatus(id as any)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                isActive 
                ? 'bg-orange-600 text-white shadow-lg shadow-orange-900/50' 
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
            }`}
        >
            {label}
            {count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white/20 text-white' : 'bg-gray-900 text-gray-500'}`}>
                    {count}
                </span>
            )}
        </button>
    );

    return (
        <div className="min-h-screen bg-gray-900 font-sans">
            <header className="bg-gray-800 shadow-lg border-b border-orange-600/30 sticky top-0 z-30">
                <div className="container mx-auto px-4 sm:px-6 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="bg-orange-600 p-2 rounded-lg">
                            <Shield className="text-white" size={24} />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-white tracking-wider hidden sm:block">Master Admin</h1>
                             <h1 className="text-xl font-bold text-white tracking-wider sm:hidden">Admin</h1>
                            <p className="text-xs text-orange-400 font-medium hidden sm:block">Gestão da Plataforma</p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2 sm:gap-4">
                        <button 
                            onClick={onSwitchToApp} 
                            className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg transition-all shadow-lg shadow-orange-900/20 hover:shadow-orange-600/40 text-sm font-bold transform active:scale-95"
                        >
                            <LayoutDashboard size={18} />
                            <span className="hidden md:inline">Acessar Meu Sistema</span>
                        </button>
                        <button 
                            onClick={onLogout} 
                            className="flex items-center gap-2 p-2 sm:px-3 text-gray-400 hover:text-white transition-colors text-sm border border-gray-700 hover:bg-gray-700 rounded-lg"
                        >
                            <LogOut size={18} /> <span className="hidden sm:inline">Sair</span>
                        </button>
                    </div>
                </div>
            </header>

            <main className="container mx-auto p-4 sm:p-6">
                {/* Top Control Bar */}
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-4">
                    <div className="w-full lg:w-auto">
                        <h2 className="text-xl md:text-2xl font-bold text-white mb-1">Empresas Cadastradas</h2>
                        <p className="text-gray-400 text-sm">Gerencie acessos e permissões</p>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                         <div className="relative flex-1 sm:w-64">
                            <Search className="absolute left-3 top-3 text-gray-500" size={18} />
                            <input 
                                type="text" 
                                placeholder="Buscar empresa..." 
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full bg-gray-800 text-white border border-gray-700 rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:border-orange-500"
                            />
                        </div>
                        <button 
                            onClick={loadCompanies}
                            className="p-2.5 bg-gray-800 text-gray-400 hover:text-white rounded-lg border border-gray-700 hover:bg-gray-700 transition-colors"
                            title="Atualizar Lista"
                        >
                            <RefreshCw size={20} className={isLoading ? "animate-spin" : ""} />
                        </button>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap gap-2 mb-6 overflow-x-auto pb-2">
                    <FilterTab id="all" label="Todos" count={counts.all} isActive={filterStatus === 'all'} />
                    <FilterTab id="pending_approval" label="Pendentes" count={counts.pending} isActive={filterStatus === 'pending_approval'} />
                    <FilterTab id="waiting_payment" label="Pagamento" count={counts.payment} isActive={filterStatus === 'waiting_payment'} />
                    <FilterTab id="active" label="Ativos" count={counts.active} isActive={filterStatus === 'active'} />
                    <FilterTab id="suspended" label="Suspensos" count={counts.suspended} isActive={filterStatus === 'suspended'} />
                </div>

                {isLoading ? (
                    <div className="flex justify-center py-20">
                         <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
                    </div>
                ) : (
                    <>
                        {/* MOBILE CARD VIEW (Visible on small screens) */}
                        <div className="grid grid-cols-1 gap-4 md:hidden">
                            {filteredCompanies.length === 0 && (
                                <div className="text-center py-10 bg-gray-800 rounded-xl border border-gray-700">
                                    <Filter className="mx-auto text-gray-600 mb-2" size={32} />
                                    <p className="text-gray-400">Nenhuma empresa encontrada com este filtro.</p>
                                </div>
                            )}
                            {filteredCompanies.map(company => (
                                <div key={company.id} className="bg-gray-800 rounded-xl border border-gray-700 p-5 shadow-md">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-center gap-3">
                                             <div className={`p-2 rounded-lg ${company.type === 'PJ' ? 'bg-blue-500/10 text-blue-400' : 'bg-green-500/10 text-green-400'}`}>
                                                {company.type === 'PJ' ? <Building2 size={20} /> : <User size={20} />}
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-white">{company.name}</h3>
                                                <p className="text-xs text-gray-400">{company.responsibleName}</p>
                                            </div>
                                        </div>
                                        <StatusBadge status={company.status} />
                                    </div>

                                    <div className="space-y-2 text-sm text-gray-300 mb-4 bg-gray-900/30 p-3 rounded-lg">
                                        <div className="flex items-center gap-2 overflow-hidden">
                                            <Mail size={14} className="text-gray-500 shrink-0"/>
                                            <span className="truncate">{company.email}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Phone size={14} className="text-gray-500 shrink-0"/>
                                            <span>{company.phone}</span>
                                        </div>
                                         <div className="flex items-center gap-2">
                                            <CreditCard size={14} className="text-gray-500 shrink-0"/>
                                            <span className="capitalize">{company.plan || 'Sem plano'}</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between gap-4 mt-4 pt-4 border-t border-gray-700">
                                         <div className="flex-1">
                                            <label className="text-[10px] text-gray-500 uppercase font-bold block mb-1">Cargo</label>
                                            <select
                                                value={company.role}
                                                onChange={(e) => handleRoleChange(company.id, e.target.value)}
                                                className="w-full bg-gray-700 text-white text-sm rounded px-2 py-1.5 border border-gray-600 focus:border-orange-500 focus:outline-none"
                                            >
                                                <option value="admin">Admin</option>
                                                <option value="manager">Manager</option>
                                                <option value="bartender">Bartender</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-gray-500 uppercase font-bold block mb-1 text-right">Ações</label>
                                            <ActionButtons company={company} />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* DESKTOP TABLE VIEW (Hidden on mobile) */}
                        <div className="hidden md:block bg-gray-800 rounded-xl shadow-xl overflow-hidden border border-gray-700">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-gray-900/50 border-b border-gray-700">
                                        <tr>
                                            <th className="p-4 text-gray-400 font-medium text-sm">Empresa / Responsável</th>
                                            <th className="p-4 text-gray-400 font-medium text-sm">Contato</th>
                                            <th className="p-4 text-gray-400 font-medium text-sm">Status</th>
                                            <th className="p-4 text-gray-400 font-medium text-sm">Cargo / Role</th>
                                            <th className="p-4 text-gray-400 font-medium text-sm">Plano</th>
                                            <th className="p-4 text-gray-400 font-medium text-sm text-right">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-700">
                                        {filteredCompanies.length === 0 && (
                                            <tr>
                                                <td colSpan={6} className="p-8 text-center text-gray-500">
                                                    Nenhuma empresa encontrada para este filtro.
                                                </td>
                                            </tr>
                                        )}
                                        {filteredCompanies.map(company => (
                                            <tr key={company.id} className="hover:bg-gray-700/30 transition-colors">
                                                <td className="p-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`p-2 rounded-lg ${company.type === 'PJ' ? 'bg-blue-500/10 text-blue-400' : 'bg-green-500/10 text-green-400'}`}>
                                                            {company.type === 'PJ' ? <Building2 size={18} /> : <User size={18} />}
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-white">{company.name}</p>
                                                            <p className="text-xs text-gray-400">{company.responsibleName}</p>
                                                            <p className="text-[10px] text-gray-500 font-mono mt-0.5">{company.document}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-4">
                                                    <p className="text-sm text-gray-300">{company.email}</p>
                                                    <p className="text-xs text-gray-500">{company.phone}</p>
                                                </td>
                                                <td className="p-4">
                                                    <StatusBadge status={company.status} />
                                                </td>
                                                <td className="p-4">
                                                    <select
                                                        value={company.role}
                                                        onChange={(e) => handleRoleChange(company.id, e.target.value)}
                                                        className="bg-gray-700 text-white text-xs rounded px-2 py-1 border border-gray-600 focus:border-orange-500 focus:outline-none"
                                                    >
                                                        <option value="admin">Admin</option>
                                                        <option value="manager">Manager</option>
                                                        <option value="bartender">Bartender</option>
                                                    </select>
                                                </td>
                                                <td className="p-4">
                                                    <span className="text-sm text-gray-300 capitalize">{company.plan || '-'}</span>
                                                </td>
                                                <td className="p-4 text-right">
                                                    <ActionButtons company={company} />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                )}
            </main>

             {/* Modal de Gerenciamento de Usuários da Empresa */}
             {managingUsersCompany && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
                    <div className="bg-gray-800 rounded-xl shadow-2xl border border-gray-600 w-full max-w-3xl max-h-[90vh] flex flex-col">
                        <div className="flex justify-between items-center p-6 border-b border-gray-700 bg-gray-800/50">
                            <div>
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                    <Users className="text-orange-500" />
                                    Usuários Cadastrados
                                </h3>
                                <p className="text-sm text-gray-400 mt-1">Empresa: <span className="text-white font-semibold">{managingUsersCompany.name}</span></p>
                            </div>
                            <button onClick={() => setManagingUsersCompany(null)} className="text-gray-400 hover:text-white transition-colors bg-gray-700/50 p-2 rounded-lg">
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto">
                            <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 mb-6 flex items-start gap-3">
                                <Shield className="text-blue-400 shrink-0 mt-0.5" size={18}/>
                                <div>
                                    <p className="text-sm text-blue-200 font-semibold">Estrutura de Usuários</p>
                                    <p className="text-xs text-blue-300/80 mt-1">
                                        Atualmente, cada empresa possui um usuário principal associado. 
                                        Gerencie abaixo o acesso e permissões deste usuário.
                                    </p>
                                </div>
                            </div>

                            <div className="bg-gray-900/50 rounded-xl border border-gray-700 overflow-hidden">
                                <table className="w-full text-left">
                                    <thead className="bg-gray-800 border-b border-gray-700 text-xs uppercase text-gray-500 font-semibold">
                                        <tr>
                                            <th className="p-4">Usuário</th>
                                            <th className="p-4">Email / Contato</th>
                                            <th className="p-4">Cargo</th>
                                            <th className="p-4">Status</th>
                                            <th className="p-4 text-right">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-700">
                                        <tr>
                                            <td className="p-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-orange-600/20 text-orange-500 flex items-center justify-center font-bold text-xs">
                                                        {managingUsersCompany.responsibleName.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-medium text-white">{managingUsersCompany.responsibleName}</p>
                                                        <p className="text-xs text-gray-500">Titular</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                 <p className="text-sm text-gray-300">{managingUsersCompany.email}</p>
                                                 <p className="text-xs text-gray-500">{managingUsersCompany.phone}</p>
                                            </td>
                                            <td className="p-4">
                                                <select
                                                    value={managingUsersCompany.role}
                                                    onChange={(e) => handleRoleChange(managingUsersCompany.id, e.target.value)}
                                                    className="bg-gray-800 text-white text-xs rounded px-2 py-1.5 border border-gray-600 focus:border-orange-500 focus:outline-none w-full"
                                                >
                                                    <option value="admin">Admin</option>
                                                    <option value="manager">Manager</option>
                                                    <option value="bartender">Bartender</option>
                                                </select>
                                            </td>
                                            <td className="p-4">
                                                <StatusBadge status={managingUsersCompany.status} />
                                            </td>
                                            <td className="p-4 text-right">
                                                <div className="flex justify-end gap-2">
                                                    {/* Suspender/Ativar Toggle */}
                                                    {managingUsersCompany.status === 'active' ? (
                                                        <button 
                                                            onClick={() => handleUpdateStatus(managingUsersCompany.id, 'suspended')}
                                                            className="p-2 bg-red-500/10 text-red-400 hover:bg-red-600 hover:text-white rounded-lg transition-colors text-xs border border-red-500/20"
                                                            title="Suspender Acesso"
                                                        >
                                                            Suspender
                                                        </button>
                                                    ) : (
                                                        <button 
                                                            onClick={() => handleUpdateStatus(managingUsersCompany.id, 'active')}
                                                            className="p-2 bg-green-500/10 text-green-400 hover:bg-green-600 hover:text-white rounded-lg transition-colors text-xs border border-green-500/20"
                                                            title="Ativar Acesso"
                                                        >
                                                            Ativar
                                                        </button>
                                                    )}

                                                    {/* Reset Senha */}
                                                    <button 
                                                        onClick={() => openResetModal(managingUsersCompany)}
                                                        className="p-2 bg-gray-700 text-gray-300 hover:text-white hover:bg-gray-600 rounded-lg transition-colors"
                                                        title="Redefinir Senha"
                                                    >
                                                        <KeyRound size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="p-4 border-t border-gray-700 bg-gray-800/50 flex justify-end">
                            <button onClick={() => setManagingUsersCompany(null)} className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 font-medium text-sm">
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Redefinição de Senha */}
            {resetPasswordModal && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
                    <div className="bg-gray-800 rounded-xl shadow-2xl border border-gray-600 w-full max-w-md p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <KeyRound className="text-orange-500" />
                                Redefinir Senha
                            </h3>
                            <button onClick={() => setResetPasswordModal(null)} className="text-gray-400 hover:text-white transition-colors">
                                <X size={24} />
                            </button>
                        </div>
                        
                        <div className="space-y-4">
                            <p className="text-gray-300">
                                Defina a nova senha para <strong>{resetPasswordModal.email}</strong>:
                            </p>
                            
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <input 
                                        type="text" 
                                        value={manualPassword}
                                        onChange={(e) => setManualPassword(e.target.value)}
                                        className="w-full bg-gray-900 border border-gray-700 text-white px-4 py-3 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none font-mono text-lg tracking-wider"
                                        placeholder="Digite a nova senha"
                                    />
                                </div>
                                <button 
                                    onClick={() => setManualPassword(generateRandomPassword())}
                                    className="p-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors border border-gray-600"
                                    title="Gerar Senha Aleatória"
                                >
                                    <RefreshCw size={20} />
                                </button>
                                <button 
                                    onClick={copyToClipboard}
                                    className="p-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors border border-gray-600"
                                    title="Copiar Senha"
                                >
                                    <Copy size={20} />
                                </button>
                            </div>

                            <p className="text-gray-500 text-xs">
                                Você pode digitar uma senha manualmente ou usar o botão de recarregar para gerar uma aleatória.
                            </p>

                            <div className="flex gap-3 justify-end mt-6">
                                <button 
                                    onClick={() => setResetPasswordModal(null)} 
                                    className="px-4 py-2 text-gray-300 hover:bg-gray-700 rounded-lg transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    onClick={handleConfirmResetPassword} 
                                    className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-lg transition-colors"
                                >
                                    Salvar Senha
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MasterDashboard;


import React, { useState } from 'react';
import type { Company, CompanyType, UserRole } from '../types.ts';
import { Building2, ArrowRight, User, Briefcase, LogIn, Phone, Mail, FileText, CheckCircle2, Loader2, Shield, Lock, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { useLocalStorage } from '../hooks/useLocalStorage.ts';
import { api, supabase } from '../lib/supabase.ts';
import { ENABLE_DATABASE, MASTER_EMAIL } from '../config.ts';

interface AuthProps {
  onLogin: (company: Company) => void;
}

const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [companies, setCompanies] = useLocalStorage<Company[]>('registered_companies', []);
  const [activeTab, setActiveTab] = useState<'login' | 'register' | 'recovery'>('login');
  const [isLoading, setIsLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  
  // Login Form State (DB Mode)
  const [loginData, setLoginData] = useState({ document: '', email: '', password: '' });

  // Recovery Form State
  const [recoveryEmail, setRecoveryEmail] = useState('');

  // Register Form State
  const [regType, setRegType] = useState<CompanyType>('PJ');
  const [formData, setFormData] = useState({
    name: '', // Nome Fantasia
    responsibleName: '',
    document: '', // CPF ou CNPJ
    email: '',
    phone: '',
    role: 'admin' as UserRole,
    password: '',
    confirmPassword: ''
  });

  // --- ROBUST INPUT MASKING LOGIC ---

  const formatCPF = (value: string) => {
    return value
      .replace(/\D/g, '') // Remove non-digits
      .slice(0, 11) // Limit to 11 digits
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})/, '$1-$2')
      .replace(/(-\d{2})\d+?$/, '$1');
  };

  const formatCNPJ = (value: string) => {
    return value
      .replace(/\D/g, '')
      .slice(0, 14) // Limit to 14 digits
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  };

  const formatPhone = (value: string) => {
    const v = value.replace(/\D/g, '').slice(0, 11);
    if (v.length > 10) {
        return v.replace(/^(\d{2})(\d{5})(\d{4}).*/, '($1) $2-$3');
    } else if (v.length > 5) {
        return v.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, '($1) $2-$3');
    } else if (v.length > 2) {
        return v.replace(/^(\d{2})(\d{0,5}).*/, '($1) $2');
    } else {
        return v;
    }
  };

  const handleInputChange = (field: string, value: string) => {
    let formattedValue = value;

    if (field === 'document') {
        formattedValue = regType === 'PF' ? formatCPF(value) : formatCNPJ(value);
    } else if (field === 'phone') {
        formattedValue = formatPhone(value);
    }

    setFormData(prev => ({ ...prev, [field]: formattedValue }));
  };

  const handleLoginInputChange = (field: string, value: string) => {
      let formattedValue = value;
      
      if (field === 'document') {
          const onlyNums = value.replace(/\D/g, '');
          // Auto-switch mask based on length
          if (onlyNums.length <= 11) {
              formattedValue = formatCPF(value);
          } else {
              formattedValue = formatCNPJ(value);
          }
      }
      
      setLoginData(prev => ({ ...prev, [field]: formattedValue }));
      setLoginError(null); // Clear error on typing
      setSuccessMessage(null);
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setSuccessMessage(null);

    if (!formData.name || !formData.document || !formData.email || !formData.password) {
        setLoginError("Por favor, preencha os campos obrigatórios.");
        return;
    }

    if (formData.password !== formData.confirmPassword) {
        setLoginError("As senhas não conferem.");
        return;
    }

    setIsLoading(true);

    // Construct the Company object locally first
    const newCompany: Company = {
      id: crypto.randomUUID(), 
      name: formData.name,
      createdAt: new Date().toISOString(),
      status: 'pending_approval',
      plan: null,
      nextBillingDate: null,
      role: formData.role, // Mapped from form selection
      type: regType,       // Mapped from form selection
      document: formData.document,
      email: formData.email.trim().toLowerCase(),
      phone: formData.phone,
      responsibleName: formData.responsibleName || formData.name
    };

    if (ENABLE_DATABASE) {
        try {
            // Attempt to save to Supabase using the API service
            const savedCompany = await api.auth.register(newCompany, formData.password);
            
            if (savedCompany) {
                // SUCESSO: Redirecionar para aba de login e mostrar mensagem
                setSuccessMessage("Cadastro realizado com sucesso! Faça login com a senha definida para continuar.");
                setLoginData(prev => ({
                    ...prev,
                    email: formData.email,
                    document: formData.document,
                    password: '' // Não preencher senha por segurança
                }));
                setActiveTab('login');
            } else {
                setLoginError("Erro ao registrar. Verifique se este CNPJ/CPF ou E-mail já estão cadastrados.");
            }
        } catch (err: any) {
            if (err.message === "TABELAS_NAO_ENCONTRADAS") {
                setLoginError("⚠️ ERRO DE CONFIGURAÇÃO: Tabelas não encontradas. Verifique o Console (F12).");
            } else {
                console.error("Unexpected register error:", err);
                setLoginError("Erro inesperado no registro. Verifique sua conexão.");
            }
        }
    } else {
        // Offline Mode (LocalStorage)
        // Check for local duplicates
        const exists = companies.some(c => c.document === newCompany.document || c.email === newCompany.email);
        if (exists) {
            setLoginError("Já existe uma empresa cadastrada localmente com este Documento ou E-mail.");
        } else {
            setCompanies([...companies, newCompany]);
            setSuccessMessage("Conta local criada com sucesso! Entre para continuar.");
            setLoginData(prev => ({
                ...prev,
                email: formData.email,
                document: formData.document
            }));
            setActiveTab('login');
        }
    }
    setIsLoading(false);
  };

  const handleRemoteLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoginError(null);
      setSuccessMessage(null);

      if (!loginData.document || !loginData.email || !loginData.password) {
          setLoginError("Preencha todos os campos para entrar.");
          return;
      }

      setIsLoading(true);
      try {
          const company = await api.auth.login(loginData.document, loginData.email, loginData.password);
          if (company) {
              onLogin(company);
          } else {
              setLoginError("Empresa não encontrada. Verifique os dados ou crie uma nova conta.");
          }
      } catch (error: any) {
          if (error.message === "TABELAS_NAO_ENCONTRADAS") {
              setLoginError("⚠️ ERRO DE CONFIGURAÇÃO: Tabelas não encontradas. Verifique o Console (F12).");
          } else if (error.message === "Senha incorreta.") {
              setLoginError("Senha incorreta.");
          } else {
              console.error("Login error:", error);
              setLoginError("Erro ao tentar fazer login. Verifique sua conexão.");
          }
      }
      setIsLoading(false);
  };

  const handleRecovery = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoginError(null);
      setSuccessMessage(null);
      
      if(!recoveryEmail) {
          setLoginError("Por favor, informe seu e-mail.");
          return;
      }

      setIsLoading(true);
      try {
          if (ENABLE_DATABASE) {
              const { data, error } = await supabase
                  .from('companies')
                  .select('id')
                  .ilike('email', recoveryEmail.trim())
                  .maybeSingle();
              
              if (error) throw error;

              if (data) {
                  setSuccessMessage(`Se este e-mail estiver cadastrado, entre em contato com o administrador (${MASTER_EMAIL}) para redefinir sua senha.`);
              } else {
                  setLoginError("E-mail não encontrado em nossa base de dados.");
              }
          } else {
              const exists = companies.some(c => c.email.toLowerCase() === recoveryEmail.toLowerCase());
              if (exists) {
                  setSuccessMessage(`Usuário local encontrado. Contate o administrador do dispositivo.`);
              } else {
                  setLoginError("E-mail não encontrado.");
              }
          }
      } catch (error) {
          console.error(error);
          setLoginError("Erro ao processar solicitação.");
      }
      setIsLoading(false);
  };

  // Logo CD Component
  const LogoCD = ({ className }: { className?: string }) => (
      <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Letter C - Left Semicircle */}
          <path 
              d="M 45 15 A 35 35 0 1 0 45 85" 
              stroke="currentColor" 
              strokeWidth="14" 
              strokeLinecap="butt"
          />
          {/* Letter D - Vertical Line + Right Semicircle */}
          <path 
              d="M 55 15 L 55 85 A 35 35 0 0 0 55 15" 
              stroke="currentColor" 
              strokeWidth="14" 
              strokeLinecap="butt"
          />
      </svg>
  );

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4 sm:p-6 md:p-8">
      <div className="max-w-5xl w-full bg-gray-800 rounded-2xl shadow-2xl overflow-hidden border border-gray-700 flex flex-col md:flex-row min-h-[600px]">
        
        {/* Left Side - Brand & Info */}
        <div className="bg-gradient-to-br from-orange-700 to-orange-600 p-8 md:p-12 md:w-2/5 flex flex-col justify-between text-white relative overflow-hidden">
          <div className="relative z-10">
            <div className="bg-white w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center mb-6 shadow-2xl overflow-hidden p-1">
               <LogoCD className="w-full h-full text-orange-600" />
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold mb-4 tracking-tight">CalculaDrink</h1>
            <p className="text-orange-100 text-sm md:text-base leading-relaxed max-w-xs">
              A plataforma definitiva para gestão inteligente de bares, eventos e coquetelaria profissional.
            </p>
            
            <div className="mt-8 space-y-4">
                <div className="flex items-center gap-3 text-orange-100">
                    <CheckCircle2 size={20} className="text-orange-300 flex-shrink-0" />
                    <span className="text-sm">Gestão de Estoque Precisa</span>
                </div>
                 <div className="flex items-center gap-3 text-orange-100">
                    <CheckCircle2 size={20} className="text-orange-300 flex-shrink-0" />
                    <span className="text-sm">Precificação de Eventos</span>
                </div>
                 <div className="flex items-center gap-3 text-orange-100">
                    <CheckCircle2 size={20} className="text-orange-300 flex-shrink-0" />
                    <span className="text-sm">Fichas Técnicas de Drinks</span>
                </div>
            </div>
          </div>
          
          {/* Decorative Circles */}
          <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
          <div className="absolute top-20 -left-20 w-40 h-40 bg-orange-500/30 rounded-full blur-2xl"></div>

          <div className="mt-12 md:mt-0 relative z-10">
            <p className="text-xs text-orange-200/80 font-mono">v1.2.1 Enterprise {ENABLE_DATABASE ? '(Online)' : '(Offline)'}</p>
          </div>
        </div>

        {/* Right Side - Form */}
        <div className="p-8 md:p-12 md:w-3/5 flex flex-col bg-gray-800">
            {activeTab !== 'recovery' && (
                <div className="flex bg-gray-900/50 p-1 rounded-lg mb-8 border border-gray-700/50">
                    <button
                        onClick={() => { setActiveTab('login'); setLoginError(null); setSuccessMessage(null); }}
                        className={`flex-1 py-2.5 text-sm font-semibold rounded-md transition-all duration-200 ${
                        activeTab === 'login'
                            ? 'bg-gray-700 text-white shadow-md'
                            : 'text-gray-400 hover:text-gray-200'
                        }`}
                    >
                        Entrar
                    </button>
                    <button
                        onClick={() => { setActiveTab('register'); setLoginError(null); setSuccessMessage(null); }}
                        className={`flex-1 py-2.5 text-sm font-semibold rounded-md transition-all duration-200 ${
                        activeTab === 'register'
                            ? 'bg-gray-700 text-white shadow-md'
                            : 'text-gray-400 hover:text-gray-200'
                        }`}
                    >
                        Nova Conta
                    </button>
                </div>
            )}

             {loginError && (
                <div className="mb-6 p-4 bg-red-900/20 border border-red-500/50 rounded-lg flex items-start gap-3 animate-fade-in">
                    <Shield className="text-red-400 shrink-0 mt-0.5" size={18} />
                    <p className="text-sm text-red-200">{loginError}</p>
                </div>
            )}

            {successMessage && (
                <div className="mb-6 p-4 bg-green-900/20 border border-green-500/50 rounded-lg flex items-start gap-3 animate-fade-in">
                    <CheckCircle2 className="text-green-400 shrink-0 mt-0.5" size={18} />
                    <p className="text-sm text-green-200">{successMessage}</p>
                </div>
            )}

            {activeTab === 'login' ? (
                <div className="flex-1 flex flex-col animate-fade-in">
                    <div className="mb-6">
                        <h2 className="text-2xl font-bold text-white mb-2">Bem-vindo de volta</h2>
                        <p className="text-gray-400 text-sm">Acesse sua conta empresarial para gerenciar seu negócio.</p>
                    </div>
                    
                    {ENABLE_DATABASE ? (
                         /* ONLINE MODE - LOGIN FORM */
                         <form onSubmit={handleRemoteLogin} className="space-y-5">
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1.5 ml-1">CNPJ ou CPF</label>
                                <div className="relative group">
                                    <FileText className="absolute left-3 top-3 text-gray-500 group-focus-within:text-orange-500 transition-colors" size={18} />
                                    <input
                                        type="text"
                                        value={loginData.document}
                                        onChange={(e) => handleLoginInputChange('document', e.target.value)}
                                        className="w-full bg-gray-900 text-white border border-gray-600 rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 text-sm placeholder-gray-600 transition-all"
                                        placeholder="00.000.000/0001-00"
                                        maxLength={18}
                                    />
                                </div>
                            </div>
                             <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1.5 ml-1">Email Cadastrado</label>
                                <div className="relative group">
                                    <Mail className="absolute left-3 top-3 text-gray-500 group-focus-within:text-orange-500 transition-colors" size={18} />
                                    <input
                                        type="email"
                                        value={loginData.email}
                                        onChange={(e) => handleLoginInputChange('email', e.target.value)}
                                        className="w-full bg-gray-900 text-white border border-gray-600 rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 text-sm placeholder-gray-600 transition-all"
                                        placeholder="seu@email.com"
                                    />
                                </div>
                            </div>
                             <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1.5 ml-1">Senha</label>
                                <div className="relative group">
                                    <Lock className="absolute left-3 top-3 text-gray-500 group-focus-within:text-orange-500 transition-colors" size={18} />
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        value={loginData.password}
                                        onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                                        className="w-full bg-gray-900 text-white border border-gray-600 rounded-lg pl-10 pr-10 py-2.5 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 text-sm placeholder-gray-600 transition-all"
                                        placeholder="Sua senha"
                                    />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3 text-gray-500 hover:text-gray-300">
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                                <div className="flex justify-end mt-2">
                                    <button 
                                        type="button"
                                        onClick={() => setActiveTab('recovery')}
                                        className="text-xs text-orange-400 hover:text-orange-300 hover:underline"
                                    >
                                        Esqueci minha senha
                                    </button>
                                </div>
                            </div>
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg shadow-orange-900/50 hover:shadow-orange-600/30 flex items-center justify-center gap-2 mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isLoading ? <Loader2 className="animate-spin" size={20} /> : <LogIn size={20} />}
                                <span>Acessar Painel</span>
                            </button>
                         </form>
                    ) : (
                        /* OFFLINE MODE - LOCAL LIST */
                        companies.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-gray-700 rounded-xl bg-gray-700/10">
                                <div className="bg-gray-700/30 p-4 rounded-full mb-4">
                                    <Briefcase className="text-gray-500" size={32} />
                                </div>
                                <p className="text-gray-300 font-medium mb-2">Nenhuma conta local</p>
                                <p className="text-gray-500 text-sm mb-6 max-w-xs">Você está no modo offline e não há contas salvas neste navegador.</p>
                                <button 
                                    onClick={() => setActiveTab('register')}
                                    className="text-orange-400 hover:text-orange-300 font-semibold text-sm border border-orange-500/30 hover:bg-orange-500/10 px-4 py-2 rounded-lg transition-colors"
                                >
                                    Criar conta local
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-3 overflow-y-auto max-h-[400px] pr-2 custom-scrollbar">
                            {companies.map((company) => (
                                <button
                                key={company.id}
                                onClick={() => onLogin(company)}
                                className="w-full flex items-center justify-between p-4 rounded-xl bg-gray-700/30 hover:bg-gray-700 border border-gray-600/50 hover:border-orange-500/50 transition-all group text-left"
                                >
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${company.type === 'PJ' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'}`}>
                                        {company.type === 'PJ' ? <Building2 size={20} /> : <User size={20} />}
                                    </div>
                                    <div>
                                        <div className="font-bold text-white flex items-center gap-2">
                                            {company.name}
                                        </div>
                                        <p className="text-xs text-gray-400 mt-0.5">{company.email}</p>
                                    </div>
                                </div>
                                <div className="bg-gray-800 p-2 rounded-full group-hover:bg-orange-500 group-hover:text-white text-gray-500 transition-all">
                                    <LogIn size={18} />
                                </div>
                                </button>
                            ))}
                            </div>
                        )
                    )}
                </div>
            ) : activeTab === 'recovery' ? (
                <div className="flex-1 flex flex-col animate-fade-in">
                    <div className="mb-6">
                        <button onClick={() => setActiveTab('login')} className="flex items-center gap-1 text-sm text-gray-400 hover:text-white mb-4">
                            <ArrowLeft size={16} /> Voltar
                        </button>
                        <h2 className="text-2xl font-bold text-white mb-2">Recuperar Senha</h2>
                        <p className="text-gray-400 text-sm">Informe seu e-mail para receber instruções de recuperação.</p>
                    </div>

                    <form onSubmit={handleRecovery} className="space-y-5">
                        <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1.5 ml-1">Email Cadastrado</label>
                            <div className="relative group">
                                <Mail className="absolute left-3 top-3 text-gray-500 group-focus-within:text-orange-500 transition-colors" size={18} />
                                <input
                                    type="email"
                                    required
                                    value={recoveryEmail}
                                    onChange={(e) => setRecoveryEmail(e.target.value)}
                                    className="w-full bg-gray-900 text-white border border-gray-600 rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 text-sm placeholder-gray-600 transition-all"
                                    placeholder="seu@email.com"
                                />
                            </div>
                        </div>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg shadow-orange-900/50 hover:shadow-orange-600/30 flex items-center justify-center gap-2 mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? <Loader2 className="animate-spin" size={20} /> : <Mail size={20} />}
                            <span>Verificar Email</span>
                        </button>
                    </form>
                </div>
            ) : (
                <form onSubmit={handleRegister} className="flex-1 flex flex-col gap-4 animate-fade-in">
                    {/* Toggle Type */}
                    <div className="flex gap-4 mb-2">
                        <label className={`flex-1 cursor-pointer border rounded-xl p-3 flex items-center gap-3 transition-all ${regType === 'PJ' ? 'bg-orange-600/10 border-orange-500 ring-1 ring-orange-500/50' : 'bg-gray-700/30 border-gray-600 hover:bg-gray-700'}`}>
                             <input 
                                type="radio" 
                                name="regType" 
                                className="hidden" 
                                checked={regType === 'PJ'} 
                                onChange={() => { setRegType('PJ'); setFormData({...formData, document: ''}) }} 
                            />
                             <div className={`p-2 rounded-lg ${regType === 'PJ' ? 'bg-orange-500 text-white' : 'bg-gray-600 text-gray-300'}`}>
                                <Building2 size={18} />
                             </div>
                             <div>
                                 <span className={`block text-sm font-bold ${regType === 'PJ' ? 'text-white' : 'text-gray-300'}`}>Empresa (PJ)</span>
                                 <span className="text-xs text-gray-500">Para bares e agências</span>
                             </div>
                        </label>

                        <label className={`flex-1 cursor-pointer border rounded-xl p-3 flex items-center gap-3 transition-all ${regType === 'PF' ? 'bg-orange-600/10 border-orange-500 ring-1 ring-orange-500/50' : 'bg-gray-700/30 border-gray-600 hover:bg-gray-700'}`}>
                             <input 
                                type="radio" 
                                name="regType" 
                                className="hidden" 
                                checked={regType === 'PF'} 
                                onChange={() => { setRegType('PF'); setFormData({...formData, document: ''}) }} 
                            />
                             <div className={`p-2 rounded-lg ${regType === 'PF' ? 'bg-orange-500 text-white' : 'bg-gray-600 text-gray-300'}`}>
                                <User size={18} />
                             </div>
                             <div>
                                 <span className={`block text-sm font-bold ${regType === 'PF' ? 'text-white' : 'text-gray-300'}`}>Autônomo (PF)</span>
                                 <span className="text-xs text-gray-500">Para freelancers</span>
                             </div>
                        </label>
                    </div>

                    <div className="space-y-3">
                        <div className="grid grid-cols-1 gap-3">
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1 ml-1">
                                    {regType === 'PJ' ? 'Nome Fantasia' : 'Nome Profissional'}
                                </label>
                                <div className="relative group">
                                    <Briefcase className="absolute left-3 top-3 text-gray-500 group-focus-within:text-orange-500 transition-colors" size={18} />
                                    <input
                                        required
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => handleInputChange('name', e.target.value)}
                                        className="w-full bg-gray-900 text-white border border-gray-600 rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 text-sm placeholder-gray-600 transition-all"
                                        placeholder={regType === 'PJ' ? "Ex: Bar do Zé Ltda" : "Ex: João Silva Bartender"}
                                    />
                                </div>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1 ml-1">
                                    {regType === 'PJ' ? 'CNPJ' : 'CPF'}
                                </label>
                                <div className="relative group">
                                    <FileText className="absolute left-3 top-3 text-gray-500 group-focus-within:text-orange-500 transition-colors" size={18} />
                                    <input
                                        required
                                        type="text"
                                        value={formData.document}
                                        onChange={(e) => handleInputChange('document', e.target.value)}
                                        className="w-full bg-gray-900 text-white border border-gray-600 rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 text-sm placeholder-gray-600 transition-all"
                                        placeholder={regType === 'PJ' ? "00.000.000/0001-00" : "000.000.000-00"}
                                        maxLength={regType === 'PJ' ? 18 : 14}
                                    />
                                </div>
                            </div>
                             <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1 ml-1">
                                    WhatsApp / Celular
                                </label>
                                <div className="relative group">
                                    <Phone className="absolute left-3 top-3 text-gray-500 group-focus-within:text-orange-500 transition-colors" size={18} />
                                    <input
                                        required
                                        type="text"
                                        value={formData.phone}
                                        onChange={(e) => handleInputChange('phone', e.target.value)}
                                        className="w-full bg-gray-900 text-white border border-gray-600 rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 text-sm placeholder-gray-600 transition-all"
                                        placeholder="(00) 00000-0000"
                                        maxLength={15}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                             <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1 ml-1">
                                    {regType === 'PJ' ? 'Responsável Legal' : 'Nome Completo'}
                                </label>
                                <div className="relative group">
                                    <User className="absolute left-3 top-3 text-gray-500 group-focus-within:text-orange-500 transition-colors" size={18} />
                                    <input
                                        type="text"
                                        value={formData.responsibleName}
                                        onChange={(e) => handleInputChange('responsibleName', e.target.value)}
                                        className="w-full bg-gray-900 text-white border border-gray-600 rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 text-sm placeholder-gray-600 transition-all"
                                        placeholder="Nome completo"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1 ml-1">
                                    Função / Cargo
                                </label>
                                <div className="relative group">
                                    <Shield className="absolute left-3 top-3 text-gray-500 group-focus-within:text-orange-500 transition-colors" size={18} />
                                    <select
                                        value={formData.role}
                                        onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                                        className="w-full bg-gray-900 text-white border border-gray-600 rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 text-sm placeholder-gray-600 transition-all appearance-none cursor-pointer"
                                    >
                                        <option value="admin">Administrador (Dono)</option>
                                        <option value="manager">Gerente</option>
                                        <option value="bartender">Bartender / Operacional</option>
                                    </select>
                                    <div className="absolute right-3 top-3 pointer-events-none text-gray-500">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1 ml-1">Email Comercial</label>
                            <div className="relative group">
                                <Mail className="absolute left-3 top-3 text-gray-500 group-focus-within:text-orange-500 transition-colors" size={18} />
                                <input
                                    required
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => handleInputChange('email', e.target.value)}
                                    className="w-full bg-gray-900 text-white border border-gray-600 rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 text-sm placeholder-gray-600 transition-all"
                                    placeholder="seu@email.com"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1 ml-1">Senha</label>
                                <div className="relative group">
                                    <Lock className="absolute left-3 top-3 text-gray-500 group-focus-within:text-orange-500 transition-colors" size={18} />
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        className="w-full bg-gray-900 text-white border border-gray-600 rounded-lg pl-10 pr-10 py-2.5 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 text-sm placeholder-gray-600 transition-all"
                                        placeholder="Crie uma senha"
                                    />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3 text-gray-500 hover:text-gray-300">
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1 ml-1">Confirmar Senha</label>
                                <div className="relative group">
                                    <Lock className="absolute left-3 top-3 text-gray-500 group-focus-within:text-orange-500 transition-colors" size={18} />
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        value={formData.confirmPassword}
                                        onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                                        className="w-full bg-gray-900 text-white border border-gray-600 rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 text-sm placeholder-gray-600 transition-all"
                                        placeholder="Repita a senha"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold py-3.5 px-4 rounded-xl transition-all shadow-lg shadow-orange-900/50 hover:shadow-orange-600/30 flex items-center justify-center gap-2 mt-2 transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading ? <Loader2 className="animate-spin" size={20} /> : <ArrowRight size={20} />}
                        <span>{isLoading ? 'Processando...' : 'Finalizar Cadastro'}</span>
                    </button>
                    
                    <p className="text-center text-xs text-gray-500 mt-2">
                        Ao criar uma conta, você concorda com os <a href="#" className="text-orange-400 hover:underline">Termos de Serviço</a>.
                    </p>
                </form>
            )}
        </div>
      </div>
    </div>
  );
};

export default Auth;

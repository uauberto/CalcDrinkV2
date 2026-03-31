import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, KeyRound, Lock, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabase.ts';

const UpdatePassword = () => {
    const navigate = useNavigate();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    useEffect(() => {
        // Escuta inicial por eventos de autenticação decorrente do link mágico do email
        const checkSession = async () => {
             const { data: { session } } = await supabase.auth.getSession();
             if (!session) {
                 const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
                     if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
                         setErrorMsg(null);
                     }
                 });
                 // Return the cleanup function handled natively by useEffect return if needed, but here simple is enough
             }
        };
        checkSession();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg(null);
        setSuccessMsg(null);

        if (password.length < 6) {
            setErrorMsg("A nova senha deve ter pelo menos 6 caracteres.");
            return;
        }

        if (password !== confirmPassword) {
            setErrorMsg("As senhas não conferem.");
            return;
        }

        setIsLoading(true);

        const { error } = await supabase.auth.updateUser({ password: password });

        if (error) {
            console.error(error);
            setErrorMsg("Falha ao atualizar a senha. O link pode ser inválido ou já ter expirado.");
        } else {
            setSuccessMsg("Senha atualizada com sucesso! Você será redirecionado para o painel em instantes...");
            setTimeout(() => {
                navigate('/dashboard');
            }, 3000);
        }
        
        setIsLoading(false);
    };

    return (
        <div className="min-h-screen bg-gray-900 flex flex-col justify-center items-center p-4">
            <div className="w-full max-w-md bg-gray-800 rounded-2xl shadow-2xl border border-gray-700 overflow-hidden">
                <div className="p-8 text-center bg-gray-900/50 border-b border-gray-700">
                     <div className="w-16 h-16 bg-orange-600 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-orange-900/50 mb-4">
                        <KeyRound className="text-white" size={32} />
                     </div>
                     <h1 className="text-3xl font-extrabold text-white tracking-tight">Redefinir Senha</h1>
                     <p className="text-gray-400 mt-2 text-sm">Crie uma nova senha de segurança.</p>
                </div>

                <div className="p-8">
                    {errorMsg && (
                        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm text-center font-medium">
                            {errorMsg}
                        </div>
                    )}

                    {successMsg && (
                        <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-sm text-center font-medium flex items-center gap-2 justify-center">
                            <Shield size={18} />
                            {successMsg}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                         <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1.5 flex items-center justify-between">
                                Nova Senha
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-3 text-gray-500" size={18} />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-gray-900 text-white border border-gray-700 rounded-lg pl-10 pr-10 py-2.5 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all font-mono tracking-wider"
                                    placeholder="Mínimo 6 caracteres"
                                    required
                                    disabled={isLoading || !!successMsg}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-3 text-gray-400 hover:text-white transition-colors"
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                         <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1.5 flex items-center justify-between">
                                Repetir Nova Senha
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-3 text-gray-500" size={18} />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="w-full bg-gray-900 text-white border border-gray-700 rounded-lg pl-10 pr-10 py-2.5 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all font-mono tracking-wider"
                                    placeholder="Confirme a senha"
                                    required
                                    disabled={isLoading || !!successMsg}
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading || !!successMsg}
                            className={`w-full py-3 px-4 flex items-center justify-center gap-2 rounded-lg text-white font-bold text-sm shadow-xl transition-all transform active:scale-[0.98] ${
                                isLoading || !!successMsg
                                    ? 'bg-gray-700 cursor-not-allowed opacity-70'
                                    : 'bg-orange-600 hover:bg-orange-500 shadow-orange-900/50 hover:shadow-orange-700/60 mt-4'
                            }`}
                        >
                            {isLoading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : successMsg ? (
                                "Redirecionando..."
                            ) : (
                                "Salvar Nova Senha"
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default UpdatePassword;

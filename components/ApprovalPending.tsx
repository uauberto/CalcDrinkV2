
import React from 'react';
import type { Company } from '../types.ts';
import { ShieldAlert, CheckCircle } from 'lucide-react';

interface ApprovalPendingProps {
  company: Company;
  onSimulateApproval: () => void;
  onLogout: () => void;
}

const ApprovalPending: React.FC<ApprovalPendingProps> = ({ company, onSimulateApproval, onLogout }) => {
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-gray-800 rounded-xl shadow-2xl border border-gray-700 p-8 text-center">
        <div className="flex justify-center mb-6">
          <div className="bg-yellow-500/20 p-6 rounded-full">
            <ShieldAlert className="text-yellow-500 w-16 h-16" />
          </div>
        </div>
        
        <h2 className="text-2xl font-bold text-white mb-2">Cadastro em Análise</h2>
        <p className="text-gray-400 mb-6">
          Olá, <strong>{company.name}</strong>. Seu cadastro foi recebido e está sendo analisado pela nossa equipe. 
          Você receberá uma notificação assim que sua conta for aprovada.
        </p>

        <div className="bg-gray-700/50 p-4 rounded-lg mb-8 text-sm text-left border border-gray-600">
          <p className="text-gray-300 mb-2 font-semibold">O que estamos verificando?</p>
          <ul className="list-disc list-inside text-gray-400 space-y-1">
            <li>Veracidade dos dados da empresa</li>
            <li>Disponibilidade na sua região</li>
            <li>Conformidade com nossos termos de uso</li>
          </ul>
        </div>

        <div className="space-y-3">
            {/* Botão de Simulação para o Desenvolvedor */}
            <button 
                onClick={onSimulateApproval}
                className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
                <CheckCircle size={20} />
                (Simulação) Aprovar Cadastro
            </button>

            <button 
                onClick={onLogout}
                className="w-full text-gray-400 hover:text-white py-2 transition-colors"
            >
                Sair e voltar depois
            </button>
        </div>
      </div>
    </div>
  );
};

export default ApprovalPending;

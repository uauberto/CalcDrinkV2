const fs = require('fs');

const dashPath = 'c:/Desenvolvimentos/CalcDrinkV2/components/MasterDashboard.tsx';
let content = fs.readFileSync(dashPath, 'utf8');

// 1. Add import
if (!content.includes('SystemSettingsTab')) {
    content = content.replace("import { Shield, LogOut", "import SystemSettingsTab from './SystemSettingsTab.tsx';\nimport { Shield, LogOut");
}

// 2. Add activeTab state
if (!content.includes("activeTab, setActiveTab")) {
    content = content.replace("const [filterStatus, setFilterStatus]", "const [activeTab, setActiveTab] = useState<'companies' | 'settings'>('companies');\n    const [filterStatus, setFilterStatus]");
}

// 3. Add tabs to header
const headerTabsStr = `<div className="flex items-center gap-2 sm:gap-4 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0">
                         <button onClick={() => setActiveTab('companies')} className={\`px-4 py-2 text-sm font-bold rounded-lg transition-colors \${activeTab === 'companies' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-800'}\`}>Empresas</button>
                         <button onClick={() => setActiveTab('settings')} className={\`px-4 py-2 text-sm font-bold rounded-lg transition-colors \${activeTab === 'settings' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-800'}\`}>Configurações</button>
                         <div className="w-px h-6 bg-gray-700 mx-2 hidden sm:block"></div>`;

if (!content.includes("setActiveTab('companies')")) {
    content = content.replace(`<div className="flex items-center gap-2 sm:gap-4">
                        <button 
                            onClick={onSwitchToApp}`, `${headerTabsStr}\n                        <button 
                            onClick={onSwitchToApp}`);
}

// 4. Wrap <main> children with activeTab condition
if (!content.includes("activeTab === 'companies' ? (")) {
    content = content.replace(`<main className="container mx-auto p-4 sm:p-6">
                {/* Top Control Bar */}`, `<main className="container mx-auto p-4 sm:p-6">
                {activeTab === 'companies' ? (
                <>
                {/* Top Control Bar */}`);

    content = content.replace(`</main>`, `                </>\n                ) : (\n                    <SystemSettingsTab />\n                )}\n            </main>`);
}

fs.writeFileSync(dashPath, content);
console.log("MasterDashboard ajustado com sucesso");

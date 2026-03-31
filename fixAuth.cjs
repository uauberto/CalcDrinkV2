const fs = require('fs');
const filepath = 'c:/Desenvolvimentos/CalcDrinkV2/components/Auth.tsx';
let content = fs.readFileSync(filepath, 'utf8');
content = content.replace(
  'setLoginError("Erro ao tentar fazer login. Verifique sua conexão.");',
  'setLoginError(error.message || "Erro de conexão genérico.");'
);
fs.writeFileSync(filepath, content);
console.log("Feito!");

const fs = require('fs');

const authPath = 'c:/Desenvolvimentos/CalcDrinkV2/components/Auth.tsx';
let content = fs.readFileSync(authPath, 'utf8');

const targetStr = `          if (ENABLE_DATABASE) {
              const { data, error } = await supabase
                  .from('companies')
                  .select('id')
                  .ilike('email', recoveryEmail.trim())
                  .maybeSingle();
              
              if (error) throw error;

              if (data) {
                  setSuccessMessage(\`Se este e-mail estiver cadastrado, entre em contato com o administrador (\${MASTER_EMAIL}) para redefinir sua senha.\`);
              } else {
                  setLoginError("E-mail não encontrado em nossa base de dados.");
              }
          } else {`;

const replaceStr = `          if (ENABLE_DATABASE) {
              const { error } = await supabase.auth.resetPasswordForEmail(recoveryEmail.trim(), {
                  redirectTo: window.location.origin + '/recovery'
              });
              
              if (error) throw error;

              setSuccessMessage(\`Se o seu e-mail estiver cadastrado, um link de recuperação acabou de ser enviado para a sua caixa de entrada.\`);
          } else {`;

content = content.replace(targetStr, replaceStr);
fs.writeFileSync(authPath, content);
console.log("Substituicao Realizada com Sucesso");

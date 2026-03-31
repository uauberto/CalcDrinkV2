import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, MASTER_EMAIL } from '../config.ts';
import type { Company, Ingredient, Drink, Event, StaffMember, DrinkIngredient } from '../types.ts';

// Cria uma única instância do cliente Supabase
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const SETUP_SQL = `
-- COPIE E RODE ISSO NO SQL EDITOR DO SUPABASE PARA ATUALIZAR SEGURANÇA --

create extension if not exists "pgcrypto";

-- 1. Criação/Atualização da Tabela de Empresas
create table if not exists companies (
  id uuid default gen_random_uuid() primary key,
  auth_user_id uuid references auth.users(id) on delete restrict,
  name text not null,
  status text default 'pending_approval',
  plan text,
  next_billing_date timestamp with time zone,
  created_at timestamp with time zone default now(),
  type text default 'PJ',
  document text,
  email text unique,
  phone text,
  responsible_name text,
  role text default 'admin',
  password text
);

alter table companies add column if not exists auth_user_id uuid references auth.users(id) on delete restrict;
alter table companies drop constraint if exists companies_document_key;
alter table companies add constraint companies_document_key unique (document);
alter table companies drop constraint if exists companies_email_key;
alter table companies add constraint companies_email_key unique (email);

-- 2. Tabela de Insumos
create table if not exists ingredients (
  id uuid default gen_random_uuid() primary key,
  company_id uuid references companies(id) not null,
  name text not null,
  unit text not null,
  is_alcoholic boolean default false,
  low_stock_threshold numeric default 0,
  created_at timestamp with time zone default now()
);

-- 3. Entradas de Estoque
create table if not exists stock_entries (
  id uuid default gen_random_uuid() primary key,
  ingredient_id uuid references ingredients(id) on delete cascade not null,
  date date default current_date,
  quantity numeric not null,
  price numeric not null,
  remaining_quantity numeric not null,
  created_at timestamp with time zone default now()
);

-- 4. Tabela de Drinks
create table if not exists drinks (
  id uuid default gen_random_uuid() primary key,
  company_id uuid references companies(id) not null,
  name text not null,
  adults_estimate numeric default 0.5,
  children_estimate numeric default 0,
  created_at timestamp with time zone default now()
);

-- 5. Ingredientes do Drink
create table if not exists drink_ingredients (
  id uuid default gen_random_uuid() primary key,
  drink_id uuid references drinks(id) on delete cascade not null,
  ingredient_id uuid references ingredients(id) on delete cascade not null,
  quantity numeric not null
);

-- 6. Tabela de Eventos
create table if not exists events (
  id uuid default gen_random_uuid() primary key,
  company_id uuid references companies(id) not null,
  name text not null,
  start_time timestamp with time zone not null,
  end_time timestamp with time zone not null,
  status text default 'planned',
  num_adults numeric default 0,
  num_children numeric default 0,
  simulated_final_price numeric,
  created_at timestamp with time zone default now()
);

create table if not exists event_drinks (
  event_id uuid references events(id) on delete cascade not null,
  drink_id uuid references drinks(id) on delete cascade not null,
  primary key (event_id, drink_id)
);

create table if not exists event_staff (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references events(id) on delete cascade not null,
  role text not null,
  cost numeric not null
);

-- Índices
create index if not exists idx_ingredients_company on ingredients(company_id);
create index if not exists idx_drinks_company on drinks(company_id);
create index if not exists idx_events_company on events(company_id);

-- --------------------------------------------------------------------------
-- 🛡️ ATIVAÇÃO DO RLS (ROW LEVEL SECURITY) 🛡️
-- --------------------------------------------------------------------------
alter table companies enable row level security;
alter table ingredients enable row level security;
alter table stock_entries enable row level security;
alter table drinks enable row level security;
alter table drink_ingredients enable row level security;
alter table events enable row level security;
alter table event_drinks enable row level security;
alter table event_staff enable row level security;

-- Limpar policies antigas se existirem
drop policy if exists "Companies policy" on companies;
drop policy if exists "Ingredients policy" on ingredients;
drop policy if exists "Drinks policy" on drinks;
drop policy if exists "Events policy" on events;
drop policy if exists "Companies insert access" on companies;

-- Companies: Insert livre para Auth Users (pois primeiro criam a conta, depois chamam o Insert via código)
create policy "Companies insert access" on companies for insert with check (
  auth_user_id = auth.uid() OR auth_user_id IS NULL
);
-- Companies: Update/Select limitados à própria empresa ou Master
create policy "Companies read access" on companies for select using (
  auth_user_id = auth.uid() or role = 'master'
);
create policy "Companies update access" on companies for update using (
  auth_user_id = auth.uid() or role = 'master'
);

-- Políticas Cascata (Só vejo o que for da minha companhia)
create policy "Ingredients policy" on ingredients for all using (
  company_id in (select id from companies where auth_user_id = auth.uid() or role = 'master')
);
create policy "Stock entries policy" on stock_entries for all using (
  ingredient_id in (select id from ingredients where company_id in (select id from companies where auth_user_id = auth.uid() or role = 'master'))
);

create policy "Drinks policy" on drinks for all using (
  company_id in (select id from companies where auth_user_id = auth.uid() or role = 'master')
);
create policy "Drink ingredients policy" on drink_ingredients for all using (
  drink_id in (select id from drinks where company_id in (select id from companies where auth_user_id = auth.uid() or role = 'master'))
);

create policy "Events policy" on events for all using (
  company_id in (select id from companies where auth_user_id = auth.uid() or role = 'master')
);
create policy "Event drinks policy" on event_drinks for all using (
  event_id in (select id from events where company_id in (select id from companies where auth_user_id = auth.uid() or role = 'master'))
);
create policy "Event staff policy" on event_staff for all using (
  event_id in (select id from events where company_id in (select id from companies where auth_user_id = auth.uid() or role = 'master'))
);

-- --------------------------------------------------------------------------
-- 🔄 LIGAÇÕES DE MIGRAÇÃO LAZY (FUNÇÕES NO BANCO)
-- --------------------------------------------------------------------------

-- 1. Verifica se a senha antiga não-criptografada bate para migrá-la:
create or replace function check_legacy_login(p_email text, p_document text, p_password text)
returns uuid security definer as $$
declare
  v_id uuid;
  v_pass text;
begin
  select id, password into v_id, v_pass from companies 
  where email ILIKE p_email and document = p_document and auth_user_id is null;
  
  if v_id is not null and v_pass = p_password then
    return v_id;
  end if;
  return null;
end;
$$ language plpgsql;

-- 2. Conecta a velha conta com o novo ID de login do Supabase Auth e apaga a senha velha:
create or replace function link_auth_user(p_company_id uuid)
returns void security definer as $$
begin
  update companies set auth_user_id = auth.uid(), password = null where id = p_company_id;
end;
$$ language plpgsql;

-- --------------------------------------------------------------------------
-- 🛡️ MASTER ADMIN TRIGGER
-- --------------------------------------------------------------------------
-- (Garante que o email Master receba prioridade sempre que for inserido)
CREATE OR REPLACE FUNCTION set_master_role() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email = '${MASTER_EMAIL}' THEN
    NEW.role := 'master';
    NEW.status := 'active';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_master_role ON companies;
CREATE TRIGGER trigger_master_role
BEFORE INSERT ON companies
FOR EACH ROW EXECUTE PROCEDURE set_master_role();
`;

const handleDatabaseError = (error: any, context: string) => {
    let errorMsg = '';
    try {
        errorMsg = JSON.stringify(error, null, 2);
    } catch (e) {
        errorMsg = String(error);
    }

    console.error(`Erro em ${context}:`, errorMsg);
    
    if (error?.code === 'PGRST205' || error?.code === '42P01' || error?.code === 'PGRST204') {
        console.group("🚨 BANCO DE DADOS NÃO CONFIGURADO 🚨");
        console.error("As tabelas ou colunas necessárias não foram encontradas no Supabase.");
        console.log("%c▼ COPIE O SCRIPT ABAIXO E RODE NO SQL EDITOR DO SUPABASE ▼", "color: orange; font-weight: bold; font-size: 12px;");
        console.log(SETUP_SQL);
        console.groupEnd();
        return true;
    }
    return false;
};

export const api = {
  auth: {
    login: async (document: string, email: string, password?: string): Promise<Company | null> => {
      try {
        if (!password) throw new Error("Senha obrigatória");
        
        let finalAuthUserId = null;

        // 1. Tentar login oficial e seguro
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password: password
        });

        if (authError) {
             // 2. LAZY MIGRATION: Se falhar no Auth, pode ser usuário legado que a senha ta crua na tabela
             const { data: legacyId, error: rpcError } = await supabase.rpc('check_legacy_login', {
                 p_email: email.trim(),
                 p_document: document,
                 p_password: password
             });

             if (legacyId) {
                  // É conta antiga válida! Migrar agora:
                  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
                      email: email.trim(),
                      password: password
                  });

                  if (signUpError) throw new Error('Falha ao migrar camada de segurança: ' + signUpError.message);
                  
                  // Fizeram signIn instantaneo, linkamos!
                  await supabase.rpc('link_auth_user', { p_company_id: legacyId });
                  finalAuthUserId = signUpData.user?.id;
             } else {
                 if (authError.message.includes('Invalid login credentials')) {
                    throw new Error("Senha ou credenciais incorretas.");
                 }
                 if (authError.message.includes('Email not confirmed')) {
                     throw new Error("E-mail aguardando confirmação. Verifique sua caixa de entrada.");
                 }
                 throw authError;
             }
        } else {
            finalAuthUserId = authData.user?.id;
        }

        if (!finalAuthUserId) return null;

        // 3. Com a sessão Auth Ativa (Passou no RLS), ler os dados da Empresa
        const { data: company, error: fetchError } = await supabase
          .from('companies')
          .select('*')
          .eq('auth_user_id', finalAuthUserId)
          .eq('document', document)
          .maybeSingle(); 

        if (fetchError) throw fetchError;
        if (!company) {
            await supabase.auth.signOut();
            throw new Error("CNPJ/CPF não corresponde ao email informado.");
        }

        return mapDatabaseToCompany(company);
      } catch (error: any) {
        if (error.message.includes("incorretas") || error.message.includes("corresponde") || error.message.includes("confirmação") || error.message.includes("segurança")) {
            throw error;
        }
        const isSetupError = handleDatabaseError(error, 'Login');
        if (isSetupError) throw new Error("TABELAS_NAO_ENCONTRADAS");
        throw new Error(error.message || "Erro desconhecido.");
      }
    },

    register: async (company: Company, password?: string): Promise<Company | null> => {
      if (!password) throw new Error("A senha é obrigatória na versão segura.");
      try {
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: company.email,
            password: password
        });

        if (authError) throw new Error(authError.message); 
        
        const dbPayload = mapCompanyToDatabase(company);
        dbPayload.auth_user_id = authData.user?.id;
        delete dbPayload.password; 

        // O RLS (for insert) garante permissão se `auth.uid()` bater com o `auth_user_id` inserido
        const { data, error } = await supabase.from('companies').insert(dbPayload).select().single();
        
        if (error) {
            console.error(error);
            // Em caso de duplicidade de CNPJ/CPF da erro Unique Key
            throw new Error("Erro no banco de dados. O Documento já pode estar em uso.");
        }
        return mapDatabaseToCompany(data);
      } catch (error: any) {
        if (error.message.includes("already registered")) {
             throw new Error("Este E-mail já possui cadastro no sistema de segurança.");
        }
        const isSetupError = handleDatabaseError(error, 'Registro');
        if (isSetupError) throw new Error("TABELAS_NAO_ENCONTRADAS");
        throw error;
      }
    },
    
    update: async (company: Company): Promise<boolean> => {
        try {
            const dbPayload = mapCompanyToDatabase(company);
            delete dbPayload.password;
            const { error } = await supabase.from('companies').update(dbPayload).eq('id', company.id);
            if (error) throw error;
            return true;
        } catch (error: any) {
            handleDatabaseError(error, 'Atualizar Empresa');
            return false;
        }
    },

    logout: async () => {
         await supabase.auth.signOut();
    }
  },

  ingredients: {
      list: async (companyId: string): Promise<Ingredient[]> => {
          const { data, error } = await supabase
            .from('ingredients')
            .select('*, stock_entries(*)');
          
          if (error) { handleDatabaseError(error, 'Listar Insumos'); return []; }
          return data.map(mapDatabaseToIngredient);
      },
      
      save: async (companyId: string, ingredient: Ingredient): Promise<Ingredient | null> => {
          try {
              const { stockEntries, id, ...ingData } = ingredient;
              const { data: savedIng, error: ingError } = await supabase
                .from('ingredients')
                .upsert({
                    id: id,
                    company_id: companyId,
                    name: ingData.name,
                    unit: ingData.unit,
                    is_alcoholic: ingData.isAlcoholic,
                    low_stock_threshold: ingData.lowStockThreshold
                })
                .select()
                .single();

              if (ingError || !savedIng) throw ingError;

              if (stockEntries && stockEntries.length > 0) {
                  const entriesPayload = stockEntries.map(entry => ({
                      id: entry.id,
                      ingredient_id: savedIng.id,
                      date: entry.date,
                      quantity: entry.quantity,
                      price: entry.price,
                      remaining_quantity: entry.remainingQuantity
                  }));
                  const { error: stockError } = await supabase.from('stock_entries').upsert(entriesPayload);
                   if (stockError) console.error('Erro ao salvar estoque:', stockError);
              }
              return mapDatabaseToIngredient(savedIng);
          } catch (error: any) {
               handleDatabaseError(error, 'Salvar Insumo');
               return null;
          }
      },
      
      delete: async (id: string) => {
          const { error } = await supabase.from('ingredients').delete().eq('id', id);
          if (error) handleDatabaseError(error, 'Deletar Insumo');
      }
  },

  drinks: {
      list: async (companyId: string): Promise<Drink[]> => {
          const { data, error } = await supabase
            .from('drinks')
            .select('*, drink_ingredients(*)');
            
          if (error) { handleDatabaseError(error, 'Listar Drinks'); return []; }
          
          return data.map((d: any) => ({
              id: d.id,
              name: d.name,
              consumptionEstimate: { adults: d.adults_estimate, children: d.children_estimate },
              ingredients: d.drink_ingredients.map((di: any) => ({
                  ingredientId: di.ingredient_id,
                  quantity: di.quantity
              }))
          }));
      },

      save: async (companyId: string, drink: Drink): Promise<boolean> => {
          try {
              const { error: drinkError } = await supabase.from('drinks').upsert({
                  id: drink.id,
                  company_id: companyId,
                  name: drink.name,
                  adults_estimate: drink.consumptionEstimate.adults,
                  children_estimate: drink.consumptionEstimate.children
              });
              if (drinkError) throw drinkError;

              await supabase.from('drink_ingredients').delete().eq('drink_id', drink.id);

              if (drink.ingredients.length > 0) {
                  const { error: ingError } = await supabase.from('drink_ingredients').insert(
                      drink.ingredients.map(di => ({
                          drink_id: drink.id,
                          ingredient_id: di.ingredientId,
                          quantity: di.quantity
                      }))
                  );
                  if (ingError) throw ingError;
              }
              return true;
          } catch (error: any) {
              handleDatabaseError(error, 'Salvar Drink');
              return false;
          }
      },

      delete: async (id: string) => {
          const { error } = await supabase.from('drinks').delete().eq('id', id);
          if (error) handleDatabaseError(error, 'Deletar Drink');
      }
  },

  events: {
      list: async (companyId: string): Promise<Event[]> => {
          const { data, error } = await supabase
            .from('events')
            .select('*, event_staff(*), event_drinks(*)');

          if (error) { handleDatabaseError(error, 'Listar Eventos'); return []; }

          return data.map((e: any) => ({
              id: e.id,
              name: e.name,
              startTime: e.start_time,
              endTime: e.end_time,
              status: e.status,
              numAdults: e.num_adults,
              numChildren: e.num_children,
              selectedDrinks: e.event_drinks.map((ed: any) => ed.drink_id),
              staff: e.event_staff.map((es: any) => ({
                  id: es.id,
                  role: es.role,
                  cost: es.cost
              })),
              simulatedCosts: e.simulated_final_price ? { finalPrice: e.simulated_final_price } : undefined
          }));
      },

      save: async (companyId: string, event: Event): Promise<boolean> => {
          try {
            const { error: eventError } = await supabase.from('events').upsert({
                id: event.id,
                company_id: companyId,
                name: event.name,
                start_time: event.startTime,
                end_time: event.endTime,
                status: event.status,
                num_adults: event.numAdults,
                num_children: event.numChildren,
                simulated_final_price: event.simulatedCosts?.finalPrice
            });
            if (eventError) throw eventError;

            await supabase.from('event_drinks').delete().eq('event_id', event.id);
            if (event.selectedDrinks.length > 0) {
                await supabase.from('event_drinks').insert(
                    event.selectedDrinks.map(drinkId => ({
                        event_id: event.id,
                        drink_id: drinkId
                    }))
                );
            }

            await supabase.from('event_staff').delete().eq('event_id', event.id);
            if (event.staff && event.staff.length > 0) {
                await supabase.from('event_staff').insert(
                    event.staff.map(s => ({
                        event_id: event.id,
                        role: s.role,
                        cost: s.cost
                    }))
                );
            }
            return true;
          } catch (error: any) {
              handleDatabaseError(error, 'Salvar Evento');
              return false;
          }
      },

      delete: async (id: string) => {
           const { error } = await supabase.from('events').delete().eq('id', id);
           if (error) handleDatabaseError(error, 'Deletar Evento');
      }
  },

  admin: {
      listAllCompanies: async (): Promise<Company[]> => {
          // O usuário "master" por RLS consegue puxar tudo. 
          const { data, error } = await supabase.from('companies').select('*').order('created_at', { ascending: false });
          if (error) { handleDatabaseError(error, 'Admin List'); return []; }
          return data.map(mapDatabaseToCompany);
      },
      updateCompanyStatus: async (id: string, status: Company['status']): Promise<boolean> => {
           const { error } = await supabase.from('companies').update({ status: status }).eq('id', id);
           if (error) handleDatabaseError(error, 'Admin Update Status');
           return !error;
      },
      updateCompanyRole: async (id: string, role: string): Promise<boolean> => {
          const { error } = await supabase.from('companies').update({ role: role }).eq('id', id);
          if (error) handleDatabaseError(error, 'Admin Update Role');
          return !error;
      }
      // Note: resetUserPassword is removed. Master cannot reset users plaintext password manually anymore via RLS.
      // E-mail password recovery flow from Auth should be used.
  }
};

function mapDatabaseToCompany(db: any): Company {
    return {
        id: db.id, name: db.name, createdAt: db.created_at, status: db.status, plan: db.plan, nextBillingDate: db.next_billing_date, type: db.type || 'PJ', document: db.document || '', email: db.email || '', phone: db.phone || '', responsibleName: db.responsible_name || '', role: db.role || 'admin',
        auth_user_id: db.auth_user_id
    };
}
function mapCompanyToDatabase(app: Company): any {
    return {
        // We do not overwrite ID to preserve UUID logic
        id: app.id, name: app.name, status: app.status, plan: app.plan, next_billing_date: app.nextBillingDate, type: app.type, document: app.document, email: app.email, phone: app.phone, responsible_name: app.responsibleName, role: app.role
    };
}
function mapDatabaseToIngredient(db: any): Ingredient {
    return {
        id: db.id, name: db.name, unit: db.unit, isAlcoholic: db.is_alcoholic, lowStockThreshold: db.low_stock_threshold, stockEntries: db.stock_entries ? db.stock_entries.map((se: any) => ({ id: se.id, date: se.date, quantity: se.quantity, price: se.price, remainingQuantity: se.remaining_quantity })) : []
    };
}
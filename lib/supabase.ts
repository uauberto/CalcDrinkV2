import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, MASTER_EMAIL } from '../config.ts';
import type { Company, Ingredient, Drink, Event, StaffMember, DrinkIngredient } from '../types.ts';

// Cria uma única instância do cliente Supabase
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const SETUP_SQL = `
-- COPIE E RODE ISSO NO SQL EDITOR DO SUPABASE --

create extension if not exists "pgcrypto";

-- 1. Tabela de Empresas
create table if not exists companies (
  id uuid default gen_random_uuid() primary key,
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

alter table companies add column if not exists password text;
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

-- 5. Ingredientes do Drink (Relacionamento)
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
  simulated_final_price numeric, -- Armazena o valor orçado
  created_at timestamp with time zone default now()
);

-- 7. Drinks do Evento
create table if not exists event_drinks (
  event_id uuid references events(id) on delete cascade not null,
  drink_id uuid references drinks(id) on delete cascade not null,
  primary key (event_id, drink_id)
);

-- 8. Equipe do Evento
create table if not exists event_staff (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references events(id) on delete cascade not null,
  role text not null,
  cost numeric not null
);

-- Índices de Performance
create index if not exists idx_ingredients_company on ingredients(company_id);
create index if not exists idx_drinks_company on drinks(company_id);
create index if not exists idx_events_company on events(company_id);

-- 9. Inserir Usuário Administrador Master Padrão
insert into companies (name, email, document, password, status, role, type, responsible_name)
values ('Administrador Master', '${MASTER_EMAIL}', '00.000.000/0000-00', 'admin', 'active', 'master', 'PJ', 'Admin')
on conflict (email) do nothing;
`;

const handleDatabaseError = (error: any, context: string) => {
    let errorMsg = '';
    try {
        errorMsg = JSON.stringify(error, null, 2);
    } catch (e) {
        errorMsg = String(error);
    }

    console.error(`Erro em ${context}:`, errorMsg);
    
    // Detecta erros de tabela inexistente (PGRST205, 42P01) ou coluna inexistente (PGRST204)
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
        const { data, error } = await supabase
          .from('companies')
          .select('*')
          .eq('document', document)
          .ilike('email', email.trim())
          .maybeSingle(); 

        if (error) throw error;
        if (!data) return null;

        if (data.password && password) {
            if (data.password !== password) {
                throw new Error("Senha incorreta.");
            }
        }
        return mapDatabaseToCompany(data);
      } catch (error: any) {
        if (error.message === "Senha incorreta.") {
            throw error;
        }
        const isSetupError = handleDatabaseError(error, 'Login');
        if (isSetupError) throw new Error("TABELAS_NAO_ENCONTRADAS");
        return null;
      }
    },

    register: async (company: Company, password?: string): Promise<Company | null> => {
      try {
        const dbPayload = mapCompanyToDatabase(company);
        if (password) dbPayload.password = password;

        const { data, error } = await supabase.from('companies').insert(dbPayload).select().single();
        if (error) throw error;
        return mapDatabaseToCompany(data);
      } catch (error: any) {
        const isSetupError = handleDatabaseError(error, 'Registro');
        if (isSetupError) throw new Error("TABELAS_NAO_ENCONTRADAS");
        return null;
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
    }
  },

  ingredients: {
      list: async (companyId: string): Promise<Ingredient[]> => {
          const { data, error } = await supabase
            .from('ingredients')
            .select('*, stock_entries(*)')
            .eq('company_id', companyId);
          
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
          // Busca drinks e seus ingredientes
          const { data, error } = await supabase
            .from('drinks')
            .select('*, drink_ingredients(*)')
            .eq('company_id', companyId);
            
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
              // 1. Salva o Drink
              const { error: drinkError } = await supabase.from('drinks').upsert({
                  id: drink.id,
                  company_id: companyId,
                  name: drink.name,
                  adults_estimate: drink.consumptionEstimate.adults,
                  children_estimate: drink.consumptionEstimate.children
              });
              if (drinkError) throw drinkError;

              // 2. Limpa ingredientes antigos (simples estratégia de substituição)
              await supabase.from('drink_ingredients').delete().eq('drink_id', drink.id);

              // 3. Insere novos ingredientes
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
          // Busca eventos com staff e drinks selecionados
          const { data, error } = await supabase
            .from('events')
            .select('*, event_staff(*), event_drinks(*)')
            .eq('company_id', companyId);

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
            // 1. Salva Evento
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

            // 2. Salva Relacionamento de Drinks (Delete/Insert)
            await supabase.from('event_drinks').delete().eq('event_id', event.id);
            if (event.selectedDrinks.length > 0) {
                await supabase.from('event_drinks').insert(
                    event.selectedDrinks.map(drinkId => ({
                        event_id: event.id,
                        drink_id: drinkId
                    }))
                );
            }

            // 3. Salva Staff
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
      initMasterUser: async (): Promise<void> => {
          try {
              // Verifica se o usuário master já existe
              const { data, error } = await supabase
                  .from('companies')
                  .select('id')
                  .eq('email', MASTER_EMAIL)
                  .maybeSingle();
              
              if (error) throw error;
              
              // Se não existe, cria
              if (!data) {
                  const { error: insertError } = await supabase.from('companies').insert({
                      name: 'Administrador Master',
                      email: MASTER_EMAIL,
                      document: '00.000.000/0000-00',
                      password: 'admin', // Senha padrão simples, o usuário deve trocar depois
                      status: 'active',
                      role: 'master',
                      type: 'PJ',
                      responsible_name: 'Admin'
                  });
                  if (insertError) throw insertError;
                  console.log("Usuário Master criado com sucesso.");
              }
          } catch (error: any) {
              console.error("Erro ao inicializar usuário master:", error);
          }
      },
      listAllCompanies: async (): Promise<Company[]> => {
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
      },
      resetUserPassword: async (id: string, newPassword: string): Promise<boolean> => {
          const { error } = await supabase.from('companies').update({ password: newPassword }).eq('id', id);
          if (error) handleDatabaseError(error, 'Admin Reset Password');
          return !error;
      }
  }
};

function mapDatabaseToCompany(db: any): Company {
    return {
        id: db.id, name: db.name, createdAt: db.created_at, status: db.status, plan: db.plan, nextBillingDate: db.next_billing_date, type: db.type || 'PJ', document: db.document || '', email: db.email || '', phone: db.phone || '', responsibleName: db.responsible_name || '', role: db.role || 'admin'
    };
}
function mapCompanyToDatabase(app: Company): any {
    return {
        id: app.id, name: app.name, status: app.status, plan: app.plan, next_billing_date: app.nextBillingDate, type: app.type, document: app.document, email: app.email, phone: app.phone, responsible_name: app.responsibleName, role: app.role
    };
}
function mapDatabaseToIngredient(db: any): Ingredient {
    return {
        id: db.id, name: db.name, unit: db.unit, isAlcoholic: db.is_alcoholic, lowStockThreshold: db.low_stock_threshold, stockEntries: db.stock_entries ? db.stock_entries.map((se: any) => ({ id: se.id, date: se.date, quantity: se.quantity, price: se.price, remainingQuantity: se.remaining_quantity })) : []
    };
}
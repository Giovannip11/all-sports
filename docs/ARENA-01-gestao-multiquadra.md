# ARENA-01 — Gestão de múltiplas quadras (plano Arena)

> Item de backlog: **ARENA-01 · Planejar gestão de múltiplas quadras** (Produto/Backend, Evolução, prioridade média).
> Critério de aceite: *requisitos e modelo de gestão multi-quadra aprovados.*
> Status deste documento: **proposta para aprovação**. Nada aqui foi implementado no app ainda.

## 1. Objetivo

Permitir que donos e gestores de arenas (clubes, society, ginásios) cadastrem o espaço com várias quadras,
controlem a agenda de cada quadra e usem essas quadras em rachas e torneios — sem conflito de horário e com
visão de ocupação. É o diferencial do plano **Arena** (tier 3, permissão `manage_venues`).

## 2. O que já existe no banco (migrations 0002 e 0004)

| Peça | Onde | O que faz hoje |
|---|---|---|
| `venues` | 0004 | Arena: nome, endereço, coordenadas, comodidades, `owner_id`, `is_public`. |
| `courts` | 0004 | Quadras da arena: nome, piso, coberta, capacidade, `hourly_price_cents`, ativa. |
| `court_sports` | 0004 | Quais esportes cada quadra aceita. |
| `venue_opening_hours` | 0004 | Horário de funcionamento por dia da semana. |
| `events.venue_id` / `events.court_id` | 0004 | Evento pode ocupar uma quadra. |
| `events_court_no_overlap` | 0004 | **Constraint de exclusão**: duas reservas ativas não se sobrepõem na mesma quadra. |
| `tournament_matches.venue_id` / `court_id` | 0005 | Partida de torneio pode ser marcada numa quadra. |
| Permissão `manage_venues` | 0002 | Só tier 3 (Arena) escreve em quadras/horários (RLS). |
| `can_manage_venue()` | 0004 | Dono (ou criador, se sem dono) gerencia a arena. |

**Conclusão:** a base de dados de arenas/quadras está pronta; faltam papéis de equipe, bloqueios de agenda,
a API e as telas.

## 3. Lacunas identificadas

1. **Uma só pessoa gerencia a arena.** Não há funcionários/gestores (recepção, administrador).
2. **Não há bloqueio de agenda** (manutenção, aula fixa, evento externo) — só eventos ocupam quadra.
3. **Horário de funcionamento não é validado** contra o horário do evento/partida.
4. **Sem visão de agenda/ocupação** por quadra e por dia.
5. **Torneio não distribui partidas entre quadras** automaticamente.
6. **Sem relatório** de ocupação e receita estimada (`hourly_price_cents` existe, mas não é usado).
7. **Nenhuma rota na API e nenhuma tela** para arenas/quadras.

## 4. Modelo proposto (acréscimos)

```sql
-- Equipe da arena: dono + gestores + recepção.
create type public.venue_role as enum ('owner', 'manager', 'staff');
create table public.venue_members (
  venue_id   uuid references public.venues(id) on delete cascade,
  user_id    uuid references public.profiles(id) on delete cascade,
  role       public.venue_role not null default 'staff',
  created_at timestamptz not null default now(),
  primary key (venue_id, user_id)
);

-- Bloqueios de agenda (manutenção, aula fixa, uso interno).
create table public.court_blocks (
  id         uuid primary key default gen_random_uuid(),
  court_id   uuid not null references public.courts(id) on delete cascade,
  starts_at  timestamptz not null,
  ends_at    timestamptz not null check (ends_at > starts_at),
  reason     text check (char_length(reason) <= 200),
  created_by uuid references public.profiles(id) on delete set null,
  exclude using gist (court_id with =, tstzrange(starts_at, ends_at) with &&)
);
```

- `can_manage_venue()` passa a aceitar `venue_members` com papel `owner`/`manager`; `staff` só lê a agenda
  e faz check-in.
- Trigger em `events` e `tournament_matches`: ao definir `court_id`, recusar se cair **fora do horário de
  funcionamento** ou **sobre um `court_block`** (o conflito entre eventos já é barrado pela constraint atual).
- View `court_agenda` (security invoker): eventos + partidas + bloqueios por quadra e período — base da tela
  de agenda e do relatório.

## 5. Fluxos

1. **Cadastrar arena** (dono, plano Arena): dados, endereço no mapa, comodidades, horários por dia.
2. **Cadastrar quadras**: nome, piso, coberta, esportes aceitos, preço por hora, ativa/inativa.
3. **Convidar equipe**: dono adiciona gestores/recepção pelo e-mail.
4. **Agenda da arena**: grade dia × quadra com eventos, partidas e bloqueios; criar bloqueio arrastando.
5. **Reservar quadra para um racha**: no "Criar evento", escolher arena → quadra livre no horário (lista só
   quadras do esporte, abertas e sem conflito).
6. **Torneio na arena**: ao gerar o chaveamento, opção "distribuir partidas nas quadras" a partir de um horário
   inicial e duração da partida (preenche `scheduled_at` e `court_id` sem conflito).
7. **Relatório**: ocupação (%) por quadra e período e receita estimada (horas reservadas × preço/hora).

## 6. API proposta

| Método | Rota | Quem |
|---|---|---|
| `POST/GET/PATCH` | `/venues`, `/venues/{id}` | dono (escrita), todos (leitura de públicas) |
| `POST/PATCH/DELETE` | `/venues/{id}/courts`, `/courts/{id}` | dono/gestor |
| `PUT` | `/venues/{id}/hours` | dono/gestor |
| `POST/DELETE` | `/venues/{id}/members` | dono |
| `GET` | `/venues/{id}/agenda?from&to` | equipe da arena |
| `POST/DELETE` | `/courts/{id}/blocks` | dono/gestor |
| `GET` | `/courts/available?sport&starts_at&duration&lat&lng` | organizador (para reservar) |
| `POST` | `/tournaments/{id}/schedule` | organizador (distribui partidas nas quadras) |
| `GET` | `/venues/{id}/report?from&to` | dono/gestor |

Todas as escritas validadas no servidor (RLS + checagem de papel), como em PLAN-02.

## 7. Telas

- **Minhas arenas** (aba no Perfil para plano Arena): lista e "Cadastrar arena".
- **Arena**: dados, quadras, horários, equipe.
- **Agenda**: grade por dia/semana, cores por esporte, bloqueios hachurados; acessível em lista no celular.
- **Criar evento**: passo opcional "Onde" com arena/quadra disponível.
- **Torneio**: botão "Distribuir nas quadras" depois do chaveamento.
- **Mapa**: pino de arena (diferente do pino de evento) com quadras e próximos horários livres.

## 8. Regras e permissões

- Escrever em arena/quadra/horários exige plano **Arena** (`manage_venues`) — já garantido pela RLS.
- Arena privada (`is_public = false`) só aparece para a equipe e para quem tem evento nela.
- Desativar quadra com reservas futuras: pedir confirmação e avisar organizadores (notificação).
- Excluir arena com eventos futuros: bloqueado; exigir cancelar/mover antes.

## 9. Critérios de aceite (para a implementação futura)

- Dono cadastra arena com ≥ 2 quadras e horários; aparece no mapa.
- Não é possível reservar quadra fora do horário, sobre bloqueio ou sobre outro evento (testes automatizados).
- Gestor convidado edita a agenda; recepção só visualiza e faz check-in.
- Torneio com 8 equipes e 2 quadras recebe horários e quadras sem conflito.
- Relatório mostra ocupação e receita estimada por quadra no período.

## 10. Perguntas para aprovação

1. A reserva de quadra terá **pagamento** pelo app (usa `payments`, migration 0006) ou só controle de agenda?
2. Gestores precisam de **conta paga própria** ou herdam o plano Arena do dono?
3. Reservas **avulsas** (alguém aluga a quadra sem criar racha público) entram no escopo?
4. Integração com calendário externo (Google Calendar) é necessária?

## 11. Estimativa (ordem de grandeza)

| Fase | Conteúdo | Horas |
|---|---|---|
| 1 | Migration (venue_members, court_blocks, triggers de horário/bloqueio, view de agenda) | 8 |
| 2 | API de arenas, quadras, horários, equipe e disponibilidade | 14 |
| 3 | Telas de arena, quadras e agenda | 18 |
| 4 | Reservar quadra no "Criar evento" + pino de arena no mapa | 8 |
| 5 | Distribuição de partidas de torneio nas quadras + relatório | 12 |
| | **Total** | **~60 h** |

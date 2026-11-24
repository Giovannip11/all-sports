# All Sports

App pra encontrar, organizar e participar de rachas, encontros e campeonatos amadores — com mapa de descoberta, chat por evento, sorteio de times e planos de organizador.

Monorepo dividido em:

- [`frontend/`](frontend) — app Expo/React Native (iOS, Android e web). Veja [`frontend/README.md`](frontend/README.md) para setup detalhado.
- [`backend/`](backend) — API em FastAPI, usando Supabase (Auth + Postgres) como banco. Veja [`backend/README.md`](backend/README.md) para setup detalhado.

## Funcionalidades

- **Conta e perfil**: cadastro (nome, e-mail, telefone, CPF, data de nascimento, gênero, país), login, recuperação de senha, edição de perfil, foto, exclusão de conta.
- **Mapa de descoberta**: eventos públicos perto de você — `react-native-maps` no app nativo, Leaflet/OpenStreetMap na web, ambos usando a localização real do dispositivo/navegador.
- **Eventos**: criar (organizador), listar, ver detalhe, entrar/sair, confirmar presença, cancelar, mover o local no mapa (na criação e depois).
- **Sorteio de times**: aleatório ou balanceado pela quantidade de eventos que cada participante já jogou.
- **Chat por evento**: uma conversa por evento, com organizador e participantes confirmados adicionados automaticamente.
- **Notificações in-app**: avisos de inscrição confirmada, evento cancelado/atualizado, etc.
- **Planos**: tela de planos (Gratuito/Casual/Intermediário/Arena) — sem cobrança real integrada ainda.
- **Modo escuro**: claro/escuro/sistema, nas telas principais (login, cadastro, perfil, mapa, eventos, notificações, chat).

## Rodando o projeto localmente

Precisa dos dois lados no ar ao mesmo tempo, em terminais separados:

```bash
# Terminal 1 — backend
cd backend
python -m uvicorn app.main:app --reload --host 0.0.0.0

# Terminal 2 — frontend
cd frontend
npx expo start
```

Detalhes de configuração (variáveis de ambiente, Supabase, testar no celular, etc.) estão nos READMEs de cada pasta.

## Banco de dados (Supabase)

O schema (tabelas, policies de RLS, triggers e funções) vive em [`backend/migrations/`](backend/migrations) — rode os arquivos `0001` a `0009`, em ordem, no SQL Editor do seu projeto Supabase antes de usar a API. O backend usa a chave `service_role` e aplica as regras de negócio em Python; o banco também tem suas próprias regras (RLS, triggers de notificação e de limite por plano) que valem mesmo se a API for contornada.

## Status / limitações conhecidas

- Sem integração de pagamento real — o plano "Casual" é concedido automaticamente a quem tenta criar um evento, como placeholder até existir cobrança de verdade.
- Perfil (nome, telefone, bio, CPF, data de nascimento, gênero) ainda é lido/gravado via `user_metadata` do Supabase Auth, não pela tabela `profiles` do schema novo — funciona, mas é uma adaptação pendente.
- Modo escuro ainda não cobre todas as telas (criar evento, sorteio de times e planos continuam só no tema claro).
- Sem build de dev client publicado — rodar com mapa real no iPhone físico exige gerar um build próprio via EAS (veja `frontend/README.md`), já que o Expo Go não suporta `react-native-maps`.

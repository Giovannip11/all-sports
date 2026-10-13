# All Sports API

Backend em FastAPI.

## Setup

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env
```

## Rodar

```bash
uvicorn app.main:app --reload
```

Docs em `http://localhost:8000/docs`.

### Testando a partir do celular (Expo Go)

Por padrão o Uvicorn só aceita conexões de `127.0.0.1` (a própria máquina). Pra um
celular na mesma rede conseguir chamar a API, rode com `--host 0.0.0.0`:

```bash
uvicorn app.main:app --reload --host 0.0.0.0
```

E no frontend, aponte `EXPO_PUBLIC_API_URL` (em `frontend/.env`) pro IP local da sua
máquina, ex. `http://192.168.0.224:8000` (veja `frontend/.env.example`).

## Testes

```bash
pytest
```

## Estrutura

```
app/
├── main.py            # instancia o FastAPI e registra middlewares/rotas
├── core/
│   ├── config.py      # configurações via variáveis de ambiente (.env)
│   └── supabase.py    # clients Supabase (anon e service-role)
├── schemas/
│   └── auth.py        # modelos de request/response do auth
└── api/
    ├── router.py       # agrega os routers da API
    └── routes/         # um módulo por recurso (health, auth, events, ...)
tests/
```

## Autenticação (Supabase Auth)

Login e cadastro usam o Supabase Auth diretamente — não há tabela de usuários própria.
`name` e `role` ("practice" ou "organize") ficam salvos no `user_metadata` do Supabase.

- `POST /auth/signup` — `{name, email, password, role}` → cria o usuário. Se o projeto
  exigir confirmação de e-mail, `session` volta `null` até o usuário confirmar.
- `POST /auth/login` — `{email, password}` → retorna `user` + `session` (access/refresh token).
- `GET /auth/me` — `Authorization: Bearer <access_token>` → retorna o usuário da sessão.

Requer `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` no `.env`
(veja `.env.example`).

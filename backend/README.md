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

## Testes

```bash
pytest
```

## Estrutura

```
app/
├── main.py           # instancia o FastAPI e registra middlewares/rotas
├── core/
│   └── config.py     # configurações via variáveis de ambiente (.env)
└── api/
    ├── router.py      # agrega os routers da API
    └── routes/        # um módulo por recurso (health, auth, events, ...)
tests/
```

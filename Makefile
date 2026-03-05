.PHONY: up down build logs backend frontend

up:
	docker compose up -d

down:
	docker compose down

build:
	docker compose build

logs:
	docker compose logs -f

backend:
	docker compose up backend ollama

frontend:
	docker compose up frontend

dev-backend:
	cd backend && pip install -r requirements.txt && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

dev-frontend:
	cd frontend && npm install && npm run dev

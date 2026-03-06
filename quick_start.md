# BOTcrumb - Quick Start

## Wymagania

- Docker + Docker Compose
- ~4 GB wolnego miejsca (obraz Ollama + modele)

## Uruchomienie

```bash
cd /root/projekty/botcrumb
docker compose up --build
```

Pierwsze uruchomienie pobiera obrazy i buduje kontenery (~5-10 min).

Po uruchomieniu:
- Frontend: http://localhost:3400
- Backend API: http://localhost:8400/docs

## Pierwsze uruchomienie gry

1. Wejdź na http://localhost:3000
2. Wybierz model LLM do generowania nazw plemion:
   - **Ollama (lokalny, bezpłatny)**: kliknij "↓ Pull" przy `llama3.2` i poczekaj na pobranie (~2 GB)
   - **OpenAI / Anthropic / Gemini**: wklej klucz API i wybierz model
3. Ustaw liczbę plemion suwakiem (2–10)
4. Kliknij **Start Battle**

## Użycie modelu Ollama bez internetu

Pobierz model wcześniej:
```bash
docker compose exec ollama ollama pull llama3.2
```

## Sterowanie kamerą

| Akcja | Mysz |
|-------|------|
| Obracanie sfery | Lewy przycisk + przeciągnij |
| Zoom | Scroll |
| Przesuwanie | Prawy przycisk + przeciągnij |

## Co obserwować

- **Prawa strona ekranu** – tabela statystyk plemion (energia, liczba jednostek) i log zdarzeń
- **Biały błysk** – trafienie jednostki
- **Białe kropki** – źródła energii
- **Szare struktury** – kamienie blokujące pole widzenia
- Gra kończy się, gdy zostanie tylko jedno plemię z żywą królową

## Zatrzymanie

```bash
docker compose down
```

Dane Ollama (pobrane modele) są przechowywane w wolumenie `ollama_data` i przeżywają restart.

## Instalacja bez Nginx Proxy Manager (NPM)

Domyślna konfiguracja zakłada obecność sieci `npm_default` tworzonej przez Nginx Proxy Manager.
Jeśli NPM nie jest zainstalowany, przed uruchomieniem utwórz sieć ręcznie:

```bash
docker network create npm_default
docker compose up --build -d
```

Alternatywnie możesz usunąć zależność z `docker-compose.yml`:
1. W sekcji `nginx.networks` usuń linię `- npm_default`
2. Na dole pliku usuń całą sekcję `npm_default:\n    external: true`

## Zmienne środowiskowe (.env)

Skopiuj `.env.example` do `.env` i uzupełnij klucze API jeśli chcesz używać modeli chmurowych:

```bash
cp .env.example .env
# edytuj .env i ustaw OPENAI_API_KEY / ANTHROPIC_API_KEY / GOOGLE_API_KEY
```

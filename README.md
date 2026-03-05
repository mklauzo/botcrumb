# BOTcrumb

Symulator bitew strategicznych AI vs AI w czasie rzeczywistym. Plemiona sterowane przez modele językowe (LLM) walczą o przetrwanie na powierzchni trójwymiarowej sfery.

## O grze

Kilka do dziesięciu plemion startuje w równomiernie rozmieszczonych punktach na sferze. Każde plemię ma królową, która podejmuje decyzje strategiczne, oraz jednostki wykonujące rozkazy autonomicznie.

Gra toczy się bez udziału gracza — wystarczy uruchomić i obserwować.

### Jednostki

| Jednostka | Rola |
|-----------|------|
| **Królowa** | Centrum dowodzenia. Śmierć królowej eliminuje całe plemię. |
| **Robotnica** | Zbiera energię ze źródeł rozsianych po sferze i dostarcza ją do królowej. Widzi źródła energii w promieniu 50 jednostek. |
| **Szturmowiec** | Atakuje wrogów. Ściga cele w zasięgu wzroku, zmierza ku wrogim królowym gdy brak bliższych celów. |
| **Obrońca** | Osłania królową. Pozostaje w pobliżu i odpiera ataki w strefie obronnej. |

### Mechaniki

- **Energia** — waluta produkcji jednostek. Robotnice zbierają ją ze źródeł pojawiających się losowo na sferze.
- **Produkcja** — królowa co kilka ticków decyduje co produkować: więcej obrońców gdy zagrożona, robotnice gdy mało energii, szturmowców gdy sytuacja stabilna.
- **Walka** — jednostki atakują w zasięgu kontaktu. Obrońcy są skuteczniejsi w strefie wokół królowej, szturmowcy zadają dodatkowe obrażenia królowym.
- **Kamienie** — losowe przeszkody na sferze blokujące linię wzroku. Wymuszają obejścia i tworzą naturalne pozycje obronne.
- **Koniec gry** — wygrywa plemię, którego królowa przeżyje jako ostatnia.

### Nazwy plemion

Przed każdą bitwą wybrany model LLM generuje unikalne łacińskie nazwy dla plemion. Obsługiwane są modele lokalne (Ollama) oraz chmurowe (OpenAI, Anthropic, Gemini).

### Wizualizacja

Gra renderuje się w 3D na powierzchni sfery przy użyciu Three.js. Kamera obsługuje obracanie, zoom i przesuwanie. Po prawej stronie wyświetlane są statystyki plemion i log zdarzeń aktualizowany w czasie rzeczywistym.

Gra działa ciągle na serwerze — zamknięcie przeglądarki nie przerywa bitwy. Po powrocie widoczny jest pełny log zdarzeń i aktualny stan gry.

## Uruchomienie

Wymagania: Docker + Docker Compose.

```bash
docker compose up --build
```

Szczegółowa instrukcja: [quick_start.md](quick_start.md)

## Stack technologiczny

- **Backend** — FastAPI, Python 3.12, asyncio
- **Frontend** — Next.js 14, TypeScript, Three.js, Zustand
- **LLM** — Ollama (lokalnie) + OpenAI / Anthropic / Gemini
- **Komunikacja** — WebSocket (diff co 200ms)
- **Proxy** — nginx

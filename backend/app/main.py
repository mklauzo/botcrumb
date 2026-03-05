from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.setup import router as setup_router
from app.api.game_ws import router as ws_router

app = FastAPI(title="BOTcrumb", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(setup_router, prefix="/api")
app.include_router(ws_router)


@app.get("/health")
async def health():
    return {"status": "ok"}

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

from config import settings, ensure_data_dirs
from api import projects, generation, comfyui_workflows, settings as settings_api, prompts
# from api import export  # 剪映导出暂时禁用

app = FastAPI(title="NovelComic API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174", "http://localhost:5175", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ensure_data_dirs()

# Mount static files for data access
data_path = Path(settings.data_dir).absolute()
if data_path.exists():
    app.mount("/data", StaticFiles(directory=str(data_path)), name="data")

# Include routers
app.include_router(projects.router)
app.include_router(generation.router)
# app.include_router(export.router)  # 剪映导出暂时禁用
app.include_router(comfyui_workflows.router, prefix="/api/comfyui", tags=["comfyui"])
app.include_router(settings_api.router)
app.include_router(prompts.router)

@app.get("/")
async def root():
    return {"message": "NovelComic API", "version": "1.0.0"}

@app.get("/health")
async def health():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=settings.host, port=settings.port, reload=True)

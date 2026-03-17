import json
import shutil
import logging
from pathlib import Path
from typing import Optional, List
from datetime import datetime

logger = logging.getLogger(__name__)

from config import settings
from models.schemas import Project, GlobalSettings, ComfyUIWorkflow

class StorageManager:
    def __init__(self):
        self.data_dir = settings.data_dir
        self.projects_dir = self.data_dir / "projects"
        self.config_path = self.data_dir / "config.json"

    def _get_project_dir(self, project_id: str) -> Path:
        return self.projects_dir / project_id

    def _get_project_path(self, project_id: str) -> Path:
        return self._get_project_dir(project_id) / "project.json"

    def load_global_settings(self) -> GlobalSettings:
        if self.config_path.exists():
            try:
                with open(self.config_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    return GlobalSettings(**data)
            except Exception:
                pass
        return GlobalSettings()

    def save_global_settings(self, settings_obj: GlobalSettings):
        self.data_dir.mkdir(parents=True, exist_ok=True)
        with open(self.config_path, 'w', encoding='utf-8') as f:
            json.dump(settings_obj.model_dump(), f, indent=2, ensure_ascii=False, default=str)

    def list_projects(self) -> List[dict]:
        projects = []
        if not self.projects_dir.exists():
            return projects
        for proj_dir in self.projects_dir.iterdir():
            if proj_dir.is_dir():
                proj_path = proj_dir / "project.json"
                if proj_path.exists():
                    try:
                        with open(proj_path, 'r', encoding='utf-8') as f:
                            data = json.load(f)
                            projects.append({
                                "id": data.get("id"),
                                "name": data.get("name"),
                                "createdAt": data.get("createdAt"),
                                "updatedAt": data.get("updatedAt"),
                                "status": data.get("status")
                            })
                    except Exception:
                        pass
        return sorted(projects, key=lambda p: p.get("createdAt", ""), reverse=True)

    def load_project(self, project_id: str) -> Optional[Project]:
        proj_path = self._get_project_path(project_id)
        if not proj_path.exists():
            return None
        try:
            with open(proj_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                if "createdAt" in data and isinstance(data["createdAt"], str):
                    data["createdAt"] = datetime.fromisoformat(data["createdAt"].replace("Z", "+00:00"))
                if "updatedAt" in data and isinstance(data["updatedAt"], str):
                    data["updatedAt"] = datetime.fromisoformat(data["updatedAt"].replace("Z", "+00:00"))
                return Project(**data)
        except Exception:
            return None

    def save_project(self, project: Project):
        proj_dir = self._get_project_dir(project.id)
        proj_dir.mkdir(parents=True, exist_ok=True)
        (proj_dir / "images").mkdir(exist_ok=True)
        (proj_dir / "audio").mkdir(exist_ok=True)
        (proj_dir / "characters").mkdir(exist_ok=True)
        (proj_dir / "export").mkdir(exist_ok=True)

        project.updatedAt = datetime.now()
        with open(self._get_project_path(project.id), 'w', encoding='utf-8') as f:
            json.dump(project.model_dump(), f, indent=2, ensure_ascii=False, default=str)

    def delete_project(self, project_id: str) -> bool:
        proj_dir = self._get_project_dir(project_id)
        if proj_dir.exists():
            shutil.rmtree(proj_dir)
            return True
        return False

    def _get_workflows_dir(self) -> Path:
        dir_path = self.data_dir / "comfyui_workflows"
        dir_path.mkdir(parents=True, exist_ok=True)
        return dir_path

    def list_comfyui_workflows(self) -> List[ComfyUIWorkflow]:
        workflows = []
        workflows_dir = self._get_workflows_dir()
        for file_path in workflows_dir.glob("*.json"):
            try:
                data = json.loads(file_path.read_text(encoding="utf-8"))
                workflows.append(ComfyUIWorkflow(**data))
            except Exception as e:
                logger.error(f"Failed to load workflow {file_path}: {e}")
        workflows.sort(key=lambda w: w.createdAt, reverse=True)
        return workflows

    def get_comfyui_workflow(self, workflow_id: str) -> Optional[ComfyUIWorkflow]:
        file_path = self._get_workflows_dir() / f"{workflow_id}.json"
        if not file_path.exists():
            return None
        try:
            data = json.loads(file_path.read_text(encoding="utf-8"))
            return ComfyUIWorkflow(**data)
        except Exception as e:
            logger.error(f"Failed to load workflow {workflow_id}: {e}")
            return None

    def save_comfyui_workflow(self, workflow: ComfyUIWorkflow) -> None:
        file_path = self._get_workflows_dir() / f"{workflow.id}.json"
        file_path.write_text(workflow.model_dump_json(indent=2), encoding="utf-8")

    def delete_comfyui_workflow(self, workflow_id: str) -> bool:
        file_path = self._get_workflows_dir() / f"{workflow_id}.json"
        if file_path.exists():
            file_path.unlink()
            return True
        return False

storage = StorageManager()

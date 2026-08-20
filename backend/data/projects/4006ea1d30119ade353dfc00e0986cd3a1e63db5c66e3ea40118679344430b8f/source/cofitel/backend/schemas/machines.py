
from pydantic import BaseModel

class MachineCreate(BaseModel):
    nom: str


class MachineUpdate(BaseModel):
    nouveau_nom: str

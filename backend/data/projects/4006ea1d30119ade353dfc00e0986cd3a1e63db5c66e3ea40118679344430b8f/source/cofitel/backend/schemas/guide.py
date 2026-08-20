from pydantic import BaseModel


class GuideLignePayload(BaseModel):
    machine_nom: str
    composant_reference: str
    slot_numero: int
    position: int | None = None
    face: str 
    quantite: int


class GuideImportPayload(BaseModel):
    lignes: list[GuideLignePayload]
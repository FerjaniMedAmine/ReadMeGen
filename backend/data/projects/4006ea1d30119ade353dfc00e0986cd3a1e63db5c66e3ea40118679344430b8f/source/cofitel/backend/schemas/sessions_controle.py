from pydantic import BaseModel


class SessionControleCreate(BaseModel):
    numero_of: int
    operateur_id: int
    ilot_id: int
    poste_detection_id: int


class SessionControleCloture(BaseModel):
    quantite_controlee: int
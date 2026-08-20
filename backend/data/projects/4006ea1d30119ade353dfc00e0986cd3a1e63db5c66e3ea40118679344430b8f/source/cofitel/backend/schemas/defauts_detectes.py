from typing import Optional

from pydantic import BaseModel


class DefautDetecteCreate(BaseModel):
    session_id: int
    code_erreur_id: int
    repere_topo: str
    coefficient: int = 1
    observation: Optional[str] = None
    numero_produit: int
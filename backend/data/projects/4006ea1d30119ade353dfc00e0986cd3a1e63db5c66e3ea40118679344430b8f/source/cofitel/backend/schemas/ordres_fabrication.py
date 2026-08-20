from pydantic import BaseModel


class OrdreFabricationCreate(BaseModel):
    numero_of: int
    reference_produit: str
    quantite: int
    site_id: int


class OrdreFabricationUpdate(BaseModel):
    reference_produit: str
    quantite: int
    site_id: int
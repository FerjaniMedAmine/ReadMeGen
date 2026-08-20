from pydantic import BaseModel


class HistoriquePayload(BaseModel):
    type_operation: str

    site: str
    client: str
    conducteur: str
    machine: str

    reference_carte: str
    reference_bobine: str
    reference_feeder: str

    numero_slot: int
    position_feeder: int

    face: str | None = None
    commentaire: str | None = None


from pydantic import BaseModel


class CartePayload(BaseModel):
    reference: str

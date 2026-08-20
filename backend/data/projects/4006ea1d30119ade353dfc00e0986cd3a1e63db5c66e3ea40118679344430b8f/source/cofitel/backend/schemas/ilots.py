from pydantic import BaseModel


class IlotPayload(BaseModel):
    name: str
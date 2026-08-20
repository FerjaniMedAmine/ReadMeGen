from pydantic import BaseModel


class ClientBase(BaseModel):
    nom: str


class ClientCreate(ClientBase):
    pass


class ClientUpdate(ClientBase):
    pass
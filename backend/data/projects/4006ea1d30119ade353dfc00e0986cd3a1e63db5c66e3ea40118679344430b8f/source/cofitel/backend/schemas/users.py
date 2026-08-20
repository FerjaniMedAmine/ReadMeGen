from typing import Literal
from pydantic import BaseModel, Field

ROLES_AUTORISES = ("operateur", "controleur")


class UserPayload(BaseModel):
    username: str = Field(min_length=1, max_length=100)
    password: str | None = Field(default=None, min_length=8)
    role: Literal["operateur", "controleur"] | None = None
from pydantic import BaseModel


class CodeErreurPayload(BaseModel):
    code: str
from pydantic import BaseModel


class PosteDetectionPayload(BaseModel):
    name: str
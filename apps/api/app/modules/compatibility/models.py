from pydantic import BaseModel

from app.modules.pancha_pakshi.enums import BirdId, RelationId


class CompatibilityRequest(BaseModel):
    bird_a: BirdId
    bird_b: BirdId


class RelationVariant(BaseModel):
    relation: RelationId
    count: int


class CompatibilityResponse(BaseModel):
    bird_a: BirdId
    bird_b: BirdId
    relation: RelationId
    context_dependent: bool
    sample_size: int
    variants: list[RelationVariant]

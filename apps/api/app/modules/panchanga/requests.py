from datetime import date as date_type

from pydantic import BaseModel, Field


class DailyPanchangaRequest(BaseModel):
    date: date_type
    location_name: str = Field(min_length=1, max_length=200)
    latitude: float
    longitude: float
    iana_tz: str

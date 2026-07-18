from datetime import date as date_type
from datetime import time as time_type

from pydantic import BaseModel, Field


class BirthChartRequest(BaseModel):
    birth_date: date_type
    birth_time: time_type
    location_name: str = Field(min_length=1, max_length=200)
    latitude: float
    longitude: float
    iana_tz: str

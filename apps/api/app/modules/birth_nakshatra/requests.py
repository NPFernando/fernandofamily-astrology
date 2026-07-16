from datetime import date as date_type
from datetime import time as time_type

from pydantic import BaseModel


class BirthNakshatraRequest(BaseModel):
    birth_date: date_type
    birth_time: time_type
    location_name: str
    latitude: float
    longitude: float
    iana_tz: str


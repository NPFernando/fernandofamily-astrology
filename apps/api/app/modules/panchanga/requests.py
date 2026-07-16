from datetime import date as date_type

from pydantic import BaseModel, Field


class DailyPanchangaRequest(BaseModel):
    date: date_type
    location_name: str = Field(min_length=1, max_length=200)
    latitude: float
    longitude: float
    iana_tz: str


class EclipseForecastRequest(BaseModel):
    from_date: date_type
    location_name: str = Field(min_length=1, max_length=200)
    latitude: float
    longitude: float
    iana_tz: str


class MonthPanchangaRequest(BaseModel):
    year: int = Field(ge=1, le=9999)
    month: int = Field(ge=1, le=12)
    location_name: str = Field(min_length=1, max_length=200)
    latitude: float
    longitude: float
    iana_tz: str

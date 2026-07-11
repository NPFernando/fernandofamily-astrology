from enum import Enum


class BirdId(str, Enum):
    vulture = "vulture"
    owl = "owl"
    crow = "crow"
    cock = "cock"
    peacock = "peacock"


class ActivityId(str, Enum):
    ruling = "ruling"
    eating = "eating"
    walking = "walking"
    sleeping = "sleeping"
    dying = "dying"


class PakshaId(str, Enum):
    waxing = "waxing"
    waning = "waning"


class PeriodKind(str, Enum):
    day = "day"
    night = "night"


class RelationId(str, Enum):
    enemy = "enemy"
    same = "same"
    friend = "friend"


class EffectId(str, Enum):
    very_bad = "very_bad"
    bad = "bad"
    average = "average"
    good = "good"
    very_good = "very_good"


class WeekdayId(str, Enum):
    sunday = "sunday"
    monday = "monday"
    tuesday = "tuesday"
    wednesday = "wednesday"
    thursday = "thursday"
    friday = "friday"
    saturday = "saturday"

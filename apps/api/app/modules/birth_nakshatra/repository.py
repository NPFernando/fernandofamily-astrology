"""Stable keys for birth-identity display fields."""

from enum import Enum


class RashiId(str, Enum):
    mesha = "mesha"
    vrishabha = "vrishabha"
    mithuna = "mithuna"
    karka = "karka"
    simha = "simha"
    kanya = "kanya"
    tula = "tula"
    vrischika = "vrischika"
    dhanu = "dhanu"
    makara = "makara"
    kumbha = "kumbha"
    meena = "meena"


RASHI_KEYS: list[RashiId] = list(RashiId)


def rashi_key(index_1based: int) -> RashiId:
    if not (1 <= index_1based <= 12):
        raise ValueError(f"rashi index must be 1..12, got {index_1based}")
    return RASHI_KEYS[index_1based - 1]

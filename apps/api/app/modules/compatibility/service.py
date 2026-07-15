from collections import Counter

from app.modules.compatibility.models import CompatibilityResponse, RelationVariant
from app.modules.pancha_pakshi.enums import BirdId, RelationId
from app.modules.pancha_pakshi import repository as pancha_repository


def bird_compatibility(bird_a: BirdId, bird_b: BirdId) -> CompatibilityResponse:
    a_index = pancha_repository.BIRD_ORDER.index(bird_a)
    b_index = pancha_repository.BIRD_ORDER.index(bird_b)
    counts: Counter[RelationId] = Counter()

    for row in pancha_repository.load_rows():
        row_main_bird = int(row[3])
        row_sub_bird = int(row[5])
        if (row_main_bird, row_sub_bird) == (a_index, b_index):
            counts[pancha_repository.RELATION_ORDER[int(row[8])]] += 1
        elif a_index != b_index and (row_main_bird, row_sub_bird) == (b_index, a_index):
            counts[pancha_repository.RELATION_ORDER[int(row[8])]] += 1

    variants = [
        RelationVariant(relation=relation, count=counts[relation])
        for relation in pancha_repository.RELATION_ORDER
        if counts[relation] > 0
    ]
    if not variants:
        raise AssertionError(f"no compatibility rows for {bird_a} + {bird_b}")

    dominant = max(
        variants,
        key=lambda item: (item.count, pancha_repository.RELATION_ORDER.index(item.relation)),
    ).relation

    return CompatibilityResponse(
        bird_a=bird_a,
        bird_b=bird_b,
        relation=dominant,
        context_dependent=len(variants) > 1,
        sample_size=sum(item.count for item in variants),
        variants=variants,
    )

from app.main import app

_FORBIDDEN_FIELD_NAMES = {
    "date", "time", "latitude", "longitude", "nakshatra_index", "dob", "tob",
    "birth_date", "birth_time", "target_date", "target_time", "iana_tz", "location_name",
}


def test_no_get_route_references_birth_or_precise_location_fields():
    schema = app.openapi()
    violations = []
    for path, methods in schema["paths"].items():
        get_op = methods.get("get")
        if not get_op:
            continue
        for param in get_op.get("parameters", []):
            name = param.get("name", "")
            if name.lower() in _FORBIDDEN_FIELD_NAMES:
                violations.append(f"{path} query/path param {name!r}")
        if "{" in path:
            for forbidden in _FORBIDDEN_FIELD_NAMES:
                if f"{{{forbidden}}}" in path:
                    violations.append(f"{path} path segment {forbidden!r}")
    assert not violations, f"GET routes must never carry birth/location fields: {violations}"


def test_all_pancha_pakshi_compute_routes_are_post():
    schema = app.openapi()
    for path, methods in schema["paths"].items():
        if "/pancha-pakshi/" in path and path.rsplit("/", 1)[-1] in {"birth-bird", "schedule", "current"}:
            assert "post" in methods, f"{path} must be POST-only"
            assert "get" not in methods, f"{path} must not also expose GET"

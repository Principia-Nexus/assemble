from datetime import timedelta

from assemble.routes.quotes import CODE_TRIES, CODES_PER_HOUR, code_refusal, now


def test_quote_codes_are_rate_limited():
    t = now()

    def code(seconds_ago, tries=0):
        return {"at": (t - timedelta(seconds=seconds_ago)).isoformat(), "tries": tries}

    assert code_refusal([], t) is None and code_refusal([code(120)], t) is None
    assert "just sent" in code_refusal([code(10)], t)
    assert "requested" in code_refusal([code(120 * (i + 1)) for i in range(CODES_PER_HOUR)], t)
    assert "wrong codes" in code_refusal([code(300, CODE_TRIES)], t)

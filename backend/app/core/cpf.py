def _check_digit(digits: list[int], weight_start: int) -> int:
    total = sum(n * w for n, w in zip(digits, range(weight_start, 1, -1)))
    remainder = (total * 10) % 11
    return 0 if remainder == 10 else remainder


def is_valid_cpf(cpf: str) -> bool:
    """Validates a Brazilian CPF using its official check-digit algorithm."""
    digits = [int(d) for d in cpf if d.isdigit()]
    if len(digits) != 11:
        return False
    if len(set(digits)) == 1:  # e.g. "111.111.111-11" — passes the math but isn't a real CPF
        return False

    first_check = _check_digit(digits[:9], 10)
    second_check = _check_digit(digits[:9] + [first_check], 11)
    return digits[9] == first_check and digits[10] == second_check


def normalize_cpf(cpf: str) -> str:
    return "".join(c for c in cpf if c.isdigit())

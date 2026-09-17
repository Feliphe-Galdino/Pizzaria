"""Validador declarativo leve: sem dependências externas, mensagens em português."""
import re
from typing import Any, Callable

from .errors import ValidationError

_MISSING = object()


class Validator:
    def __init__(self, data: Any, partial: bool = False):
        if not isinstance(data, dict):
            raise ValidationError({"_": "Envie um objeto JSON."})
        self.data, self.partial = data, partial
        self.errors: dict[str, str] = {}
        self.out: dict[str, Any] = {}

    def _get(self, key, required, default):
        value = self.data.get(key, _MISSING)
        if value is _MISSING or value is None or value == "":
            if self.partial and value is _MISSING:
                return _MISSING
            if required:
                self.errors[key] = "Campo obrigatório."
                return _MISSING
            self.out[key] = default
            return _MISSING
        return value

    def str(self, key, *, required=True, min_len=0, max_len=255, pattern=None, default=None, message=None):
        value = self._get(key, required, default)
        if value is _MISSING:
            return self
        if not isinstance(value, str):
            self.errors[key] = "Deve ser um texto."
            return self
        value = value.strip()
        if len(value) < min_len:
            self.errors[key] = message or f"Use pelo menos {min_len} caracteres."
        elif len(value) > max_len:
            self.errors[key] = f"Use no máximo {max_len} caracteres."
        elif pattern and not re.fullmatch(pattern, value):
            self.errors[key] = message or "Formato inválido."
        else:
            self.out[key] = value
        return self

    def int(self, key, *, required=True, min_value=None, max_value=None, default=None):
        value = self._get(key, required, default)
        if value is _MISSING:
            return self
        if isinstance(value, bool) or not isinstance(value, int):
            self.errors[key] = "Deve ser um número inteiro."
        elif min_value is not None and value < min_value:
            self.errors[key] = f"Valor mínimo: {min_value}."
        elif max_value is not None and value > max_value:
            self.errors[key] = f"Valor máximo: {max_value}."
        else:
            self.out[key] = value
        return self

    def bool(self, key, *, required=False, default=None):
        value = self._get(key, required, default)
        if value is _MISSING:
            return self
        if not isinstance(value, bool):
            self.errors[key] = "Deve ser verdadeiro ou falso."
        else:
            self.out[key] = value
        return self

    def choice(self, key, choices, *, required=True, default=None):
        value = self._get(key, required, default)
        if value is _MISSING:
            return self
        if value not in choices:
            self.errors[key] = "Opção inválida."
        else:
            self.out[key] = value
        return self

    def list(self, key, item: Callable[[Any], Any], *, required=True, min_len=0, max_len=50, default=None):
        value = self._get(key, required, default if default is not None else [])
        if value is _MISSING:
            return self
        if not isinstance(value, list):
            self.errors[key] = "Deve ser uma lista."
            return self
        if len(value) < min_len:
            self.errors[key] = f"Informe pelo menos {min_len} item(ns)."
            return self
        if len(value) > max_len:
            self.errors[key] = f"Máximo de {max_len} itens."
            return self
        result = []
        for i, raw in enumerate(value):
            try:
                result.append(item(raw))
            except ValidationError as exc:
                for field, msg in exc.fields.items():
                    self.errors[f"{key}[{i}].{field}" if field != "_" else f"{key}[{i}]"] = msg
        self.out[key] = result
        return self

    def done(self) -> dict:
        if self.errors:
            raise ValidationError(self.errors)
        return self.out


def slugify(text: str) -> str:
    import unicodedata
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:80]

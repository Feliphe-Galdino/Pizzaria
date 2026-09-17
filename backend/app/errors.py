"""Erros da API e respostas JSON padronizadas."""
from flask import jsonify, request
from werkzeug.exceptions import HTTPException


class ApiError(Exception):
    def __init__(self, message: str, status: int = 400, code: str = "bad_request"):
        super().__init__(message)
        self.message, self.status, self.code = message, status, code


class ValidationError(ApiError):
    def __init__(self, fields: dict):
        super().__init__("Alguns dados precisam de ajuste.", 422, "validation_error")
        self.fields = fields


def _payload(message, code, fields=None):
    body = {"error": {"code": code, "message": message}}
    if fields:
        body["error"]["fields"] = fields
    return body


def register_error_handlers(app):
    @app.errorhandler(ValidationError)
    def _validation(err):
        return jsonify(_payload(err.message, err.code, err.fields)), err.status

    @app.errorhandler(ApiError)
    def _api(err):
        return jsonify(_payload(err.message, err.code)), err.status

    @app.errorhandler(HTTPException)
    def _http(err):
        if not request.path.startswith("/api/"):
            return err
        messages = {
            404: "Recurso não encontrado.",
            405: "Método não permitido para este endereço.",
            413: "Os dados enviados são grandes demais.",
            400: "Requisição inválida. Verifique o JSON enviado.",
        }
        return jsonify(_payload(messages.get(err.code, err.description), f"http_{err.code}")), err.code

    @app.errorhandler(Exception)
    def _unexpected(err):
        app.logger.exception("Erro inesperado")
        return jsonify(_payload("Erro interno. Tente novamente em instantes.", "internal_error")), 500

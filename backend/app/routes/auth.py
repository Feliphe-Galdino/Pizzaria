from flask import Blueprint, g, request
from werkzeug.security import check_password_hash, generate_password_hash

from ..database import get_db, row
from ..errors import ApiError
from ..security import client_ip, create_token, login_limiter, require_admin
from ..validation import Validator

bp = Blueprint("auth", __name__, url_prefix="/api/auth")

# Hash usado quando o e-mail não existe, para o tempo de resposta não revelar contas válidas.
_DUMMY_HASH = generate_password_hash("senha-inexistente")


@bp.post("/login")
def login():
    login_limiter.check(client_ip())
    v = (Validator(request.get_json(silent=True))
         .str("email", max_len=120).str("password", max_len=200).done())
    user = row(get_db().execute("SELECT * FROM users WHERE email = ?", (v["email"].lower(),)))
    valid = check_password_hash(user["password_hash"] if user else _DUMMY_HASH, v["password"])
    if not user or not valid:
        raise ApiError("E-mail ou senha incorretos.", 401, "invalid_credentials")
    return {"token": create_token(user["id"], user["email"]), "email": user["email"]}


@bp.get("/me")
@require_admin
def me():
    return g.admin

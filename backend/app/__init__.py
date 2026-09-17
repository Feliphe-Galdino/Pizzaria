"""Fábrica da aplicação Flask: API em /api e o site estático na raiz."""
from flask import Flask, send_from_directory

from .config import Config
from .database import init_db
from .errors import register_error_handlers
from .security import register_security


def create_app(config_object=Config) -> Flask:
    config_object.validate()
    app = Flask(__name__, static_folder=None)
    app.config.from_object(config_object)

    register_error_handlers(app)
    register_security(app)
    init_db(app)

    from .routes import admin, auth, public
    app.register_blueprint(public.bp)
    app.register_blueprint(auth.bp)
    app.register_blueprint(admin.bp)

    from .seed import register_commands, seed_if_empty
    register_commands(app)
    with app.app_context():
        seed_if_empty()

    frontend = app.config["FRONTEND_DIR"]

    @app.get("/")
    def index():
        return send_from_directory(frontend, "index.html")

    @app.get("/admin")
    def admin_page():
        return send_from_directory(frontend, "admin.html")

    @app.get("/<path:path>")
    def static_files(path):
        response = send_from_directory(frontend, path)
        if path.startswith(("css/", "js/", "assets/")):
            response.headers["Cache-Control"] = "public, max-age=3600"
        return response

    return app

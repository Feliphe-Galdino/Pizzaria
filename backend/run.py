"""Servidor de desenvolvimento. Em produção use: gunicorn -w 2 -b 0.0.0.0:8000 "app:create_app()" """
from app import create_app

app = create_app()

if __name__ == "__main__":
    app.run(debug=not app.config["IS_PRODUCTION"], port=5000)

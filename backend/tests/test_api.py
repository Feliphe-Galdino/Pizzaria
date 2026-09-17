"""Testes da API. Rode com: python -m unittest discover -s tests"""
import os
import tempfile
import unittest


class ApiTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        from app.config import Config

        class TestConfig(Config):
            SECRET_KEY = "chave-de-teste-" + "x" * 40
            DATABASE_PATH = os.path.join(cls.tmp.name, "test.db")
            ADMIN_EMAIL = "admin@teste.com"
            ADMIN_PASSWORD = "senha-de-teste-123"
            MIN_ORDER_CENTS = 3000
            DELIVERY_FEE_CENTS = 800

        from app import create_app
        cls.app = create_app(TestConfig)
        cls.client = cls.app.test_client()
        token = cls.client.post("/api/auth/login", json={"email": "admin@teste.com", "password": "senha-de-teste-123"}).get_json()["token"]
        cls.auth = {"Authorization": f"Bearer {token}"}

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def menu_item(self, slug="calabresa"):
        for c in self.client.get("/api/menu").get_json()["categories"]:
            for p in c["products"]:
                if p["slug"] == slug:
                    return p, c
        raise AssertionError(slug)

    def order(self, **overrides):
        p, c = self.menu_item()
        body = {
            "customer_name": "Cliente", "phone": "(11) 91234-5678", "fulfillment": "pickup", "payment_method": "pix",
            "items": [{"product_id": p["id"], "size_id": p["sizes"][-1]["id"], "quantity": 1, "addon_ids": []}],
        }
        body.update(overrides)
        return body

    def test_menu_is_public(self):
        data = self.client.get("/api/menu").get_json()
        self.assertTrue(data["categories"])

    def test_admin_requires_token(self):
        self.assertEqual(self.client.get("/api/admin/products").status_code, 401)

    def test_server_recalculates_prices(self):
        p, c = self.menu_item()
        addon = next(a for a in c["addons"] if not a["exclusive_group"])
        body = self.order(fulfillment="delivery", address={"street": "Rua A", "number": "1", "district": "Centro"},
                          items=[{"product_id": p["id"], "size_id": p["sizes"][-1]["id"], "quantity": 2, "addon_ids": [addon["id"]],
                                  "unit_price_cents": 1}])
        r = self.client.post("/api/orders", json=body)
        self.assertEqual(r.status_code, 201)
        expected = (p["sizes"][-1]["price_cents"] + addon["price_cents"]) * 2 + 800
        self.assertEqual(r.get_json()["total_cents"], expected)

    def test_only_one_addon_per_exclusive_group(self):
        p, c = self.menu_item()
        bordas = [a["id"] for a in c["addons"] if a["exclusive_group"] == "Borda"][:2]
        body = self.order(items=[{"product_id": p["id"], "size_id": p["sizes"][-1]["id"], "quantity": 1, "addon_ids": bordas}])
        self.assertEqual(self.client.post("/api/orders", json=body).status_code, 422)

    def test_delivery_requires_address(self):
        r = self.client.post("/api/orders", json=self.order(fulfillment="delivery"))
        self.assertEqual(r.status_code, 422)
        self.assertIn("address", r.get_json()["error"]["fields"])

    def test_unavailable_product_is_rejected(self):
        p, _ = self.menu_item("portuguesa")
        self.client.patch(f"/api/admin/products/{p['id']}/availability", json={"available": False}, headers=self.auth)
        body = self.order(items=[{"product_id": p["id"], "size_id": p["sizes"][0]["id"], "quantity": 1}])
        r = self.client.post("/api/orders", json=body)
        self.client.patch(f"/api/admin/products/{p['id']}/availability", json={"available": True}, headers=self.auth)
        self.assertEqual(r.status_code, 409)

    def test_tracking_requires_matching_phone(self):
        code = self.client.post("/api/orders", json=self.order()).get_json()["code"]
        self.assertEqual(self.client.get(f"/api/orders/{code}?phone=11000000000").status_code, 404)
        self.assertEqual(self.client.get(f"/api/orders/{code}?phone=11912345678").status_code, 200)

    def test_admin_product_crud(self):
        _, c = self.menu_item()
        r = self.client.post("/api/admin/products", headers=self.auth, json={
            "category_id": c["id"], "name": "Pizza Teste", "sizes": [{"label": "Grande", "price_cents": 5000}], "tags": ["novo"]})
        self.assertEqual(r.status_code, 201)
        pid = r.get_json()["id"]
        r = self.client.put(f"/api/admin/products/{pid}", headers=self.auth, json={"sizes": [{"label": "Grande", "price_cents": 5500}]})
        self.assertEqual(r.get_json()["price_from_cents"], 5500)
        self.assertEqual(self.client.delete(f"/api/admin/products/{pid}", headers=self.auth).status_code, 204)

    def test_security_headers(self):
        r = self.client.get("/api/health")
        self.assertIn("default-src 'self'", r.headers["Content-Security-Policy"])
        self.assertEqual(r.headers["X-Content-Type-Options"], "nosniff")


if __name__ == "__main__":
    unittest.main()

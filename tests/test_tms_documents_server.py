import importlib.util
from pathlib import Path
import unittest


SERVER_PATH = Path(__file__).resolve().parents[1] / "server" / "tms-documents-server.py"


def load_server_module():
    spec = importlib.util.spec_from_file_location("tms_documents_server", SERVER_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class UploadValidationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.module = load_server_module()

    def test_validate_upload_accepts_pdf(self):
        result = self.module.validate_upload(
            entity_type="trip_plan",
            entity_id="11111111-1111-4111-8111-111111111111",
            document_type="pod",
            file_name="proof.pdf",
            content_type="application/pdf",
            body=b"%PDF-1.7\nexample",
        )
        self.assertEqual(result.extension, ".pdf")


if __name__ == "__main__":
    unittest.main()

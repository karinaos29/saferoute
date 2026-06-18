from config import settings
from google import genai

key = settings.GEMINI_API_KEY
client = genai.Client(api_key=key)
print("Models your key can use:\n")
for m in client.models.list():
    print("  •", m.name)
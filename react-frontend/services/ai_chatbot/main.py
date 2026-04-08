from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import requests
from dotenv import load_dotenv
from google import genai 
from sentence_transformers import SentenceTransformer
import faiss
import numpy as np

# Load bien moi truong
load_dotenv()
client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))

MAGENTO_BASE_URL = os.getenv("MAGENTO_BASE_URL")
MAGENTO_ADMIN_USER = os.getenv("MAGENTO_ADMIN_USER")
MAGENTO_ADMIN_PASSWORD = os.getenv("MAGENTO_ADMIN_PASSWORD")

app = FastAPI()

# Them CORS de Frontend (HTML) co the goi API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    message: str

model_embed = SentenceTransformer('all-MiniLM-L6-v2')
products_cache = []
faiss_index = None

def get_magento_token():
    print("Dang tien hanh dang nhap vao Magento de lay Token...")
    url = f"{MAGENTO_BASE_URL}/rest/V1/integration/admin/token"
    payload = {"username": MAGENTO_ADMIN_USER, "password": MAGENTO_ADMIN_PASSWORD}
    try:
        response = requests.post(url, json=payload)
        if response.status_code == 200:
            print("Da lay Token xac thuc thanh cong!")
            return response.json()
        else:
            print("Loi lay Token:", response.text)
    except Exception as e:
        print("Loi ket noi khi lay Token:", str(e))
    return None

def get_all_products_from_magento(token):
    url = f"{MAGENTO_BASE_URL}/rest/V1/products"
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {token}"}
    params = {"searchCriteria[pageSize]": 100}
    try:
        response = requests.get(url, headers=headers, params=params)
        if response.status_code == 200:
            return response.json().get("items", [])
        else:
            print("Loi tai du lieu:", response.text)
    except Exception as e:
        print("Loi ket noi Magento: ", str(e))
    return []

def format_product(p):
    return f"Ten san pham: {p['name']} | Ma SKU: {p['sku']} | Gia ban: {p['price']} USD"

# Ham moi: Boc tach du lieu cho Frontend
def parse_product(p):
    url_key = ""
    image_path = ""
    
    for attr in p.get("custom_attributes", []):
        if attr["attribute_code"] == "url_key":
            url_key = attr["value"]
        if attr["attribute_code"] == "image":
            image_path = attr["value"]
            
    product_url = f"{MAGENTO_BASE_URL}/{url_key}.html" if url_key else MAGENTO_BASE_URL
    image_url = f"{MAGENTO_BASE_URL}/media/catalog/product{image_path}" if image_path else ""

    return {
        "name": p.get("name"),
        "price": p.get("price"),
        "sku": p.get("sku"),
        "url": product_url,
        "image": image_url
    }

@app.on_event("startup")
def startup_event():
    global products_cache, faiss_index
    token = get_magento_token()
    if not token:
        print("Dung khoi dong RAG do khong lay duoc Token.")
        return

    print("Dang tai toan bo kho du lieu tu Magento...")
    products_cache = get_all_products_from_magento(token)
    
    if not products_cache:
        print("CANH BAO: Khong lay duoc san pham nao tu kho!")
        return
        
    print(f"Da tai thanh cong {len(products_cache)} san pham. Dang xay dung Vector Database (FAISS)...")
    product_texts = [format_product(p) for p in products_cache]
    embeddings = model_embed.encode(product_texts)
    faiss_index = faiss.IndexFlatL2(len(embeddings[0]))
    faiss_index.add(np.array(embeddings))
    print("Khoi dong hoan tat! Backend da san sang.")

def search_products_rag(query, top_k=3):
    if faiss_index is None or not products_cache:
        return []
    query_vector = model_embed.encode([query])
    distances, indices = faiss_index.search(np.array(query_vector), top_k)
    return [products_cache[idx] for idx in indices[0] if idx < len(products_cache)]

@app.post("/chat")
def chat(req: ChatRequest):
    try:
        user_message = req.message
        related_products = search_products_rag(user_message)

        product_text = ""
        for p in related_products:
            product_text += f"- {format_product(p)}\n"

        prompt = f"""
        Bạn là nhân viên bán hàng chuyên nghiệp.
        
        Câu hỏi của khách: "{user_message}"
        
        Sản phẩm có sẵn:
        {product_text}
        
        Yêu cầu:
        - Tư vấn sản phẩm phù hợp.
        - Nhấn mạnh lợi ích.
        - Gợi ý mua hàng và giữ giọng điệu thân thiện, tự nhiên.
        - Tuyệt đối không bịa thông tin.
        """

        response = client.models.generate_content(
            model='gemini-2.5-flash', 
            contents=prompt
        )

        # Chuan hoa du lieu tra ve
        parsed_products = [parse_product(p) for p in related_products]

        return {
            "reply": response.text,
            "products": parsed_products
        }

    except Exception as e:
        return {"error": str(e)}
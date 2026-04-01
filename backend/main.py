from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="ShopRight API")

# CORS — allow frontend origins
origins = [
    "http://localhost:5173",
    os.getenv("FRONTEND_URL", ""),
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https://shopright.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


from routers.auth import router as auth_router
from routers.stores import router as stores_router
from routers.visits import router as visits_router
from routers.review import router as review_router

app.include_router(auth_router)
app.include_router(stores_router)
app.include_router(visits_router)
app.include_router(review_router)


@app.get("/health")
def health_check():
    return {"success": True, "data": "ShopRight API is running", "error": None}

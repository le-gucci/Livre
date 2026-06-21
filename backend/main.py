import os
import asyncio
import numpy as np
import cv2
import pytesseract
import httpx
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from pydantic import BaseModel

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")


def load_image(data: bytes) -> np.ndarray:
    arr = np.frombuffer(data, np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(400, "Invalid image")
    return img


def preprocess_crop(img_bgr: np.ndarray) -> Image.Image:
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    gray = clahe.apply(gray)
    h, w = gray.shape
    gray = cv2.resize(gray, (w * 3, h * 3), interpolation=cv2.INTER_LANCZOS4)
    _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    return Image.fromarray(binary)


def ocr_region(img_bgr: np.ndarray, psm: int = 6) -> str:
    pil = preprocess_crop(img_bgr)
    return pytesseract.image_to_string(pil, lang="fra", config=f"--psm {psm} --oem 3").strip()


def detect_underlines(img: np.ndarray) -> list[dict]:
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # CLAHE improves contrast for phone photos with uneven lighting
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    gray = clahe.apply(gray)

    blurred = cv2.GaussianBlur(gray, (3, 3), 0)
    _, binary = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

    h, w = img.shape[:2]
    seen = {}  # deduplicate by approximate position

    # Try multiple kernel widths to catch short and long underlines
    for kw in [15, 25, 40, 60]:
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (kw, 1))
        mask = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel, iterations=2)
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        for cnt in contours:
            x, y, cw, ch = cv2.boundingRect(cnt)
            if cw < kw or ch > 15:
                continue
            key = (round(x / 20), round(y / 10))
            if key not in seen:
                seen[key] = (x, y, cw, ch)

    results = []
    for x, y, cw, ch in seen.values():
        text_y1 = max(0, y - 45)
        crop = img[text_y1:y, x : x + cw]
        if crop.size == 0:
            continue
        text = ocr_region(crop, psm=7)
        if len(text.strip()) < 2:
            continue

        ctx_y1 = max(0, y - 130)
        ctx_y2 = min(h, y + 70)
        ctx_crop = img[ctx_y1:ctx_y2, max(0, x - 40) : min(w, x + cw + 40)]
        context = ocr_region(ctx_crop, psm=6) if ctx_crop.size > 0 else ""

        results.append({
            "phrase": text.strip(),
            "context": context,
            "bbox": {"x": x / w, "y": text_y1 / h, "w": cw / w, "h": (y - text_y1) / h},
        })

    return results


async def translate(text: str) -> str:
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(
            "https://api.mymemory.translated.net/get",
            params={"q": text, "langpair": "fr|en"},
        )
        return r.json().get("responseData", {}).get("translatedText", "")


async def summarise(french: str, english: str, context: str = "") -> str:
    if not GROQ_API_KEY:
        return ""
    has_context = context and context.strip() != french.strip() and len(context) > len(french) + 5
    if has_context:
        prompt = (
            f'Surrounding French text:\n"{context}"\n\n'
            f'The reader underlined: "{french}" (translates to: "{english}")\n\n'
            "In one brief phrase, explain what the underlined expression means or contributes "
            "in the context of the surrounding text. Be specific to the text. "
            "E.g. 'conveys the narrator\\'s detachment from his mother\\'s death'. Reply with the phrase only."
        )
    else:
        prompt = (
            f'French: "{french}"\nEnglish: "{english}"\n\n'
            "In one brief phrase, what is this expression conveying? Reply with the phrase only."
        )
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {GROQ_API_KEY}"},
            json={
                "model": "llama-3.1-8b-instant",
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": 60,
                "temperature": 0.3,
            },
        )
        data = r.json()
        if "choices" not in data:
            print(f"Groq error: {data}")
            return ""
        return data["choices"][0]["message"]["content"].strip()


@app.post("/process-image")
async def process_image(file: UploadFile = File(...)):
    data = await file.read()
    img = load_image(data)
    underlines = detect_underlines(img)

    async def process_one(u):
        t = await translate(u["phrase"])
        s = await summarise(u["phrase"], t, u.get("context", ""))
        return {**u, "translation": t, "summary": s}

    results = await asyncio.gather(*[process_one(u) for u in underlines])
    return {"entries": list(results)}


class OcrRegionBody(BaseModel):
    image_url: str
    x: float
    y: float
    w: float
    h: float


@app.post("/ocr-region")
async def ocr_region_endpoint(body: OcrRegionBody):
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.get(body.image_url)
        r.raise_for_status()
    img = load_image(r.content)
    ih, iw = img.shape[:2]

    x1 = max(0, int(body.x * iw))
    y1 = max(0, int(body.y * ih))
    x2 = min(iw, int((body.x + body.w) * iw))
    y2 = min(ih, int((body.y + body.h) * ih))

    phrase_crop = img[y1:y2, x1:x2]
    text = ocr_region(phrase_crop, psm=6)
    if not text:
        text = ocr_region(phrase_crop, psm=3)  # fully automatic fallback

    ph = y2 - y1
    ctx_y1 = max(0, y1 - ph * 3)
    ctx_y2 = min(ih, y2 + ph * 2)
    context = ocr_region(img[ctx_y1:ctx_y2, 0:iw], psm=6)

    return {"text": text, "context": context}


@app.post("/ocr-crop")
async def ocr_crop(file: UploadFile = File(...)):
    data = await file.read()
    img = load_image(data)
    text = ocr_region(img, psm=6)
    return {"text": text}


class TranslateBody(BaseModel):
    text: str
    context: str = ""
    with_summary: bool = True


@app.post("/translate")
async def translate_endpoint(body: TranslateBody):
    t = await translate(body.text)
    s = await summarise(body.text, t, body.context) if body.with_summary else ""
    return {"translation": t, "summary": s}


@app.get("/health")
def health():
    return {"status": "ok"}

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


def ocr_region(img_bgr: np.ndarray, psm: int = 7) -> str:
    pil = Image.fromarray(cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB))
    pil = pil.resize((pil.width * 3, pil.height * 3), Image.LANCZOS)
    return pytesseract.image_to_string(pil, lang="fra", config=f"--psm {psm} --oem 3").strip()


def detect_underlines(img: np.ndarray) -> list[dict]:
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (60, 1))
    lines_mask = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel, iterations=2)
    contours, _ = cv2.findContours(lines_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    h, w = img.shape[:2]
    results = []

    for cnt in contours:
        x, y, cw, ch = cv2.boundingRect(cnt)
        if cw < 40 or ch > 8:
            continue

        text_y1 = max(0, y - 40)
        crop_bgr = img[text_y1:y, x : x + cw]
        if crop_bgr.size == 0:
            continue

        text = ocr_region(crop_bgr, psm=7)
        if len(text) < 3:
            continue

        # grab surrounding lines for contextual summary
        ctx_y1 = max(0, y - 130)
        ctx_y2 = min(h, y + 70)
        ctx_bgr = img[ctx_y1:ctx_y2, max(0, x - 40) : min(w, x + cw + 40)]
        context = ocr_region(ctx_bgr, psm=6) if ctx_bgr.size > 0 else ""

        results.append({
            "phrase": text,
            "context": context,
            "bbox": {
                "x": x / w,
                "y": text_y1 / h,
                "w": cw / w,
                "h": (y - text_y1) / h,
            },
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
            f'The reader underlined this phrase: "{french}" (translates to: "{english}")\n\n'
            "In one brief phrase, explain what the underlined expression means or contributes "
            "in the context of the surrounding text — what idea, feeling, or narrative function it serves. "
            "Be specific to the text, not generic. E.g. 'conveys the narrator\\'s detachment from his mother\\'s death'. "
            "Reply with the phrase only."
        )
    else:
        prompt = (
            f'French: "{french}"\nEnglish: "{english}"\n\n'
            "In one brief phrase, what is this expression conveying or implying in context? Reply with the phrase only."
        )

    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {GROQ_API_KEY}"},
            json={
                "model": "llama3-8b-8192",
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": 60,
                "temperature": 0.3,
            },
        )
        data = r.json()
        if "choices" not in data:
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

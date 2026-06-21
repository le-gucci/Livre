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


def detect_underlines(img: np.ndarray) -> list[dict]:
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

    # isolate horizontal strokes (pencil underlines are thin horizontal marks)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (60, 1))
    lines_mask = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel, iterations=2)

    contours, _ = cv2.findContours(lines_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    h, w = img.shape[:2]
    results = []

    for cnt in contours:
        x, y, cw, ch = cv2.boundingRect(cnt)
        if cw < 40 or ch > 8:
            continue

        # grab text region above the line
        text_y1 = max(0, y - 40)
        crop_bgr = img[text_y1:y, x : x + cw]
        if crop_bgr.size == 0:
            continue

        pil = Image.fromarray(cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2RGB))
        # upscale for better tesseract accuracy
        pil = pil.resize((pil.width * 3, pil.height * 3), Image.LANCZOS)
        text = pytesseract.image_to_string(pil, lang="fra", config="--psm 7 --oem 3").strip()

        if len(text) > 2:
            results.append(
                {
                    "phrase": text,
                    "bbox": {
                        "x": x / w,
                        "y": text_y1 / h,
                        "w": cw / w,
                        "h": (y - text_y1) / h,
                    },
                }
            )

    return results


async def translate(text: str) -> str:
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(
            "https://api.mymemory.translated.net/get",
            params={"q": text, "langpair": "fr|en"},
        )
        return r.json().get("responseData", {}).get("translatedText", "")


async def summarise(french: str, english: str) -> str:
    if not GROQ_API_KEY:
        return ""
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {GROQ_API_KEY}"},
            json={
                "model": "llama3-8b-8192",
                "messages": [
                    {
                        "role": "user",
                        "content": (
                            f'French: "{french}"\nEnglish: "{english}"\n\n'
                            "In one brief phrase (not a full sentence), what is this expression conveying? "
                            "E.g. 'expresses regret', 'describes the character's longing'. "
                            "Reply with the phrase only, no punctuation at end."
                        ),
                    }
                ],
                "max_tokens": 50,
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
        s = await summarise(u["phrase"], t)
        return {**u, "translation": t, "summary": s}

    results = await asyncio.gather(*[process_one(u) for u in underlines])
    return {"entries": list(results)}


class OcrRequest(BaseModel):
    pass


@app.post("/ocr-crop")
async def ocr_crop(file: UploadFile = File(...)):
    data = await file.read()
    img = load_image(data)
    pil = Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
    pil = pil.resize((pil.width * 3, pil.height * 3), Image.LANCZOS)
    text = pytesseract.image_to_string(pil, lang="fra", config="--psm 6 --oem 3").strip()
    return {"text": text}


class TranslateBody(BaseModel):
    text: str
    with_summary: bool = True


@app.post("/translate")
async def translate_endpoint(body: TranslateBody):
    t = await translate(body.text)
    s = await summarise(body.text, t) if body.with_summary else ""
    return {"translation": t, "summary": s}


@app.get("/health")
def health():
    return {"status": "ok"}

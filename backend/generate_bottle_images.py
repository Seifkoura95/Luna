"""
One-time script to generate 48 Eclipse bottle product photos via Gemini Nano Banana.
Outputs are saved to /app/backend/static/bottles/{bottle_id}.png and served at
    https://{BACKEND}/api/static/bottles/{bottle_id}.png
Run with: python3 /app/backend/generate_bottle_images.py
"""
import asyncio
import os
import base64
import re
import sys
from pathlib import Path
from dotenv import load_dotenv
from emergentintegrations.llm.chat import LlmChat, UserMessage

load_dotenv('/app/backend/.env')
API_KEY = os.environ['EMERGENT_LLM_KEY']
OUT_DIR = Path('/app/backend/static/bottles')
OUT_DIR.mkdir(parents=True, exist_ok=True)

# Load the bottle menu from bookings.py so we generate images for the exact SKUs
BOOKINGS = Path('/app/backend/routes/bookings.py').read_text()
pattern = re.compile(
    r'"id":\s*"(ecl_[^"]+)".*?"name":\s*"([^"]+)".*?"price":\s*(\d+).*?"description":\s*"([^"]+)"'
)
bottles = [(m.group(1), m.group(2), int(m.group(3)), m.group(4)) for m in pattern.finditer(BOOKINGS)]
print(f"Found {len(bottles)} bottles in bookings.py")

# Consistent luxury prompt template so all 48 images look like a cohesive set
SYSTEM = (
    "You are a professional product photographer specialising in premium spirits and "
    "nightlife bottle service. Output photorealistic, editorial-quality product shots."
)

def build_prompt(name: str, description: str) -> str:
    return (
        f"Professional studio product photograph of a bottle of {name}. "
        f"Context: {description}. "
        "The bottle is the hero, sharply in focus, centred in the frame, shown in full from cap to base. "
        "Jet-black matte background with a subtle warm gold vignette at the edges. "
        "Dramatic rim lighting from the sides accentuating the glass and label. "
        "Condensation mist and a faint ice-and-sparks haze in the background to suggest nightclub VIP service. "
        "Ultra high resolution, 4k, luxury editorial quality, magazine cover aesthetic. "
        "No text overlays, no watermarks, no people, no extra objects, no garnish. "
        "Vertical 3:4 aspect ratio, framed for a mobile app menu thumbnail."
    )

async def gen_one(bottle_id: str, name: str, description: str):
    out_path = OUT_DIR / f"{bottle_id}.png"
    if out_path.exists() and out_path.stat().st_size > 20_000:
        print(f"  ⧗ {bottle_id} already exists ({out_path.stat().st_size // 1024}kb)")
        return True
    try:
        chat = LlmChat(
            api_key=API_KEY,
            session_id=f"bottle-{bottle_id}",
            system_message=SYSTEM,
        )
        chat.with_model("gemini", "gemini-3.1-flash-image-preview").with_params(
            modalities=["image", "text"]
        )
        msg = UserMessage(text=build_prompt(name, description))
        _text, images = await chat.send_message_multimodal_response(msg)
        if not images:
            print(f"  ✗ {bottle_id} ({name}): no image returned")
            return False
        img_bytes = base64.b64decode(images[0]['data'])
        out_path.write_bytes(img_bytes)
        print(f"  ✓ {bottle_id:<28} {len(img_bytes)//1024}kb → {name}")
        return True
    except Exception as e:
        print(f"  ✗ {bottle_id} ({name}): {type(e).__name__}: {str(e)[:120]}")
        return False

async def main():
    # Run in small batches of 4 to avoid rate limiting
    batch_size = 4
    total_ok = 0
    total_fail = 0
    for i in range(0, len(bottles), batch_size):
        batch = bottles[i:i + batch_size]
        results = await asyncio.gather(
            *(gen_one(bid, name, desc) for bid, name, _, desc in batch),
            return_exceptions=False,
        )
        total_ok += sum(1 for r in results if r is True)
        total_fail += sum(1 for r in results if r is not True)
        print(f"  [{i + len(batch)}/{len(bottles)}]  ok={total_ok} fail={total_fail}")
    print(f"\nDone. ok={total_ok} fail={total_fail}")
    return total_fail == 0

if __name__ == "__main__":
    ok = asyncio.run(main())
    sys.exit(0 if ok else 1)

# Tegner sprite-arkene til walkouten: 8 bilder av en figur som går mot kameraet (hvit på gjennomsiktig).
# CSS farger den mørk og legger lysrand på, se .walkout-sprite og .walkout-legs i globals.css.
#   sprite-walk.png: hele figuren, brukes for spillere uten bilde.
#   sprite-legs.png: bare hofter og bein. Spillerbildet (overkroppen) settes oppå, så silhuetten får spillerens egne konturer.
# Kjøres med `python3 scripts/lag-walkout-sprite.py`, og skriver begge filene til public/walkouts.
import math
from PIL import Image, ImageDraw

W, H, FRAMES, SS = 256, 512, 8, 4  # SS: tegnes i større oppløsning og skaleres ned, for glatte kanter.


def capsule(d, a, b, r):
    d.line([a, b], fill=255, width=int(2 * r))
    for p in (a, b):
        d.ellipse([p[0] - r, p[1] - r, p[0] + r, p[1] + r], fill=255)


def frame(k, legs_only=False):
    img = Image.new("L", (W * SS, H * SS), 0)
    d = ImageDraw.Draw(img)
    phase = 2 * math.pi * k / FRAMES
    s = lambda v: v * SS
    P = lambda x, y: (s(x), s(y))
    bob = -7 * abs(math.sin(phase))       # kroppen løftes litt for hvert skritt
    sway = 5 * math.sin(phase)            # og vugger fra side til side
    cx = 128 + sway
    top = 20 + bob

    # Bein: den ene løftes mens den andre står. I front ser et løftet bein kortere ut.
    for side in (-1, 1):
        lift = max(0.0, math.sin(phase + (0 if side < 0 else math.pi)))
        hip = P(cx + side * 23, top + 250)
        knee = P(cx + side * (27 + 5 * lift), top + 330 - 46 * lift)
        ankle = P(cx + side * (28 + 9 * lift), top + 418 - 78 * lift)
        capsule(d, hip, knee, s(21))      # lår og shorts
        capsule(d, knee, ankle, s(14))    # legg og strømpe
        capsule(d, ankle, P(cx + side * (30 + 9 * lift), top + 436 - 78 * lift), s(17))  # fot

    # Armer svinger motsatt av beina.
    for side in (-1, 1):
        swing = math.sin(phase + (math.pi if side < 0 else 0))
        shoulder = P(cx + side * 56, top + 112)
        elbow = P(cx + side * (66 + 4 * swing), top + 178 - 14 * swing)
        hand = P(cx + side * (62 + 10 * swing), top + 238 - 34 * swing)
        capsule(d, shoulder, elbow, s(15))
        capsule(d, elbow, hand, s(12))
        d.ellipse([hand[0] - s(11), hand[1] - s(11), hand[0] + s(11), hand[1] + s(11)], fill=255)

    if legs_only:
        # Hoftene dekker skjøten mot spillerbildet, som slutter rundt midjen.
        d.rounded_rectangle([s(cx - 46), s(top + 226), s(cx + 46), s(top + 290)], radius=s(22), fill=255)
        mask = img.resize((W, H), Image.LANCZOS)
        mask.paste(0, (0, 0, W, int(top + 226) - 14))  # alt over hoftene hører til spillerbildet
        return mask

    # Overkropp (trøye), nakke og hode.
    d.rounded_rectangle([s(cx - 62), s(top + 92), s(cx + 62), s(top + 150)], radius=s(26), fill=255)
    d.polygon([P(cx - 56, top + 120), P(cx + 56, top + 120), P(cx + 44, top + 262), P(cx - 44, top + 262)], fill=255)
    capsule(d, P(cx, top + 82), P(cx, top + 100), s(14))
    d.ellipse([s(cx - 33), s(top + 12), s(cx + 33), s(top + 84)], fill=255)

    return img.resize((W, H), Image.LANCZOS)


def save(name, legs_only):
    sheet = Image.new("RGBA", (W * FRAMES, H), (0, 0, 0, 0))
    for k in range(FRAMES):
        white = Image.new("RGBA", (W, H), (255, 255, 255, 0))
        white.putalpha(frame(k, legs_only))
        sheet.paste(white, (k * W, 0))
    sheet.save(f"public/walkouts/{name}", optimize=True)
    print(f"public/walkouts/{name}", sheet.size)


save("sprite-walk.png", False)
save("sprite-legs.png", True)

#!/usr/bin/env python3
"""Generate hunter_side_right.png - 672x576, 48x48 frames, 14x12 grid, RGBA transparent."""
from PIL import Image, ImageDraw
import math

W, H = 672, 576
TRANSPARENT = (0, 0, 0, 0)

def lerp_color(c1, c2, t):
    t = max(0, min(1, t))
    return tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3))

def rgba(c, a=255):
    return (c[0], c[1], c[2], a)

def draw_pixel(draw, x, y, color, alpha=255):
    if 0 <= x < W and 0 <= y < H:
        draw.point((x, y), fill=rgba(color, alpha))

def draw_aa(draw, x, y, color, alpha=128):
    draw_pixel(draw, x, y, color, alpha)

CLOAK_LIGHT = (100, 135, 80)
CLOAK_MID = (65, 95, 52)
CLOAK_DARK = (38, 60, 30)
CLOAK_OUTLINE = (20, 35, 16)
LEATHER_LIGHT = (155, 120, 75)
LEATHER_MID = (115, 88, 52)
LEATHER_DARK = (78, 58, 34)
LEATHER_OUTLINE = (45, 32, 18)
SKIN_LIGHT = (218, 188, 155)
SKIN_MID = (190, 158, 125)
SKIN_DARK = (150, 118, 88)
HAIR_LIGHT = (170, 130, 65)
HAIR_MID = (130, 92, 40)
HAIR_DARK = (85, 60, 25)
BOW_LIGHT = (175, 140, 80)
BOW_MID = (135, 105, 55)
BOW_DARK = (88, 65, 35)
BOW_STRING = (210, 205, 190)
QUIVER_LIGHT = (140, 100, 60)
QUIVER_DARK = (88, 60, 35)
TEAL_BRIGHT = (75, 225, 195)
TEAL_MID = (45, 180, 150)
TEAL_DIM = (22, 110, 90)
BOOT_LIGHT = (100, 78, 50)
BOOT_MID = (72, 52, 32)
BOOT_DARK = (48, 32, 18)
EYE = (65, 210, 175)
ARROW_TIP = (195, 195, 195)
ARROW_SHAFT = (150, 120, 70)
FLETCH = (110, 65, 35)
BELT_GOLD = (195, 165, 50)
BELT_DARK = (130, 100, 28)
PAULDRON_LIGHT = (120, 95, 60)
PAULDRON_DARK = (75, 55, 32)


def draw_hunter(draw, cx, by, anim="idle", frame=0):
    bob = 0
    arm_swing = 0
    step = 0
    lean = 0
    bow_pull = 0

    if anim == "idle":
        bob = int(math.sin(frame * 0.7) * 1.5)
        arm_swing = math.sin(frame * 0.5) * 0.6
    elif anim == "walk":
        bob = int(math.sin(frame * 1.1) * 1.5)
        arm_swing = math.sin(frame * 1.1) * 3
        step = int(math.sin(frame * 1.1) * 2.5)
    elif anim == "attack1":
        p = frame / 11.0
        bow_pull = min(p * 2, 1) * 7
        lean = int(p * 2) if p > 0.3 else 0
        bob = int(-p * 2.5)
    elif anim == "attack2":
        p = frame / 9.0
        bow_pull = min(p * 1.5, 1) * 5
        lean = int(math.sin(p * 3.14) * 2.5)
    elif anim == "attack3":
        p = frame / 11.0
        bow_pull = min(p * 2.5, 1) * 9
        bob = int(-p * 3.5)
        lean = int(p * 3)
    elif anim == "hurt":
        p = frame / 5.0
        lean = int(-p * 4)
        bob = int(p * 2.5)
    elif anim == "die":
        p = min(frame / 6.0, 1)
        lean = int(-p * 6)
        bob = int(p * 5)

    Y = by + bob
    X = cx + lean

    # Cloak back
    for row in range(10):
        y = Y - 18 + row
        hw = 5 + row // 2
        for col in range(-hw, -1):
            x = X + col
            t = (col + hw) / hw
            c = lerp_color(CLOAK_OUTLINE, CLOAK_MID, t)
            if row > 6:
                c = lerp_color(c, CLOAK_DARK, 0.3)
            draw_pixel(draw, x, y, c)

    # Boots
    for row in range(5):
        y = Y - row
        for side in [-1, 1]:
            bx = X + side * int(2 + step * side * 0.3)
            c = lerp_color(BOOT_DARK, BOOT_LIGHT, row / 5)
            draw_pixel(draw, bx - 1, y, c)
            draw_pixel(draw, bx, y, lerp_color(c, BOOT_LIGHT, 0.3))
            draw_pixel(draw, bx + 1, y, c)
    draw_pixel(draw, X + 3 + int(step * 0.3), Y, BOOT_MID)
    draw_pixel(draw, X - 3 - int(step * 0.3), Y, BOOT_DARK)

    # Legs
    for row in range(7):
        y = Y - 5 - row
        for col in range(-3, 4):
            x = X + col
            t = (col + 3) / 6
            if abs(col) == 3:
                draw_pixel(draw, x, y, LEATHER_OUTLINE)
            else:
                draw_pixel(draw, x, y, lerp_color(LEATHER_DARK, LEATHER_MID, t))

    # Belt
    for col in range(-5, 6):
        x = X + col
        t = (col + 5) / 10
        if abs(col) == 5:
            draw_pixel(draw, x, Y - 12, LEATHER_OUTLINE)
        elif col == 0:
            draw_pixel(draw, x, Y - 12, TEAL_BRIGHT)
        else:
            draw_pixel(draw, x, Y - 12, lerp_color(BELT_DARK, BELT_GOLD, t))

    # Torso
    for row in range(12):
        y = Y - 13 - row
        hw = 5 + row // 6
        for col in range(-hw, hw + 1):
            x = X + col
            t = (col + hw) / (2 * hw)
            if abs(col) == hw:
                draw_pixel(draw, x, y, LEATHER_OUTLINE)
            else:
                c = lerp_color(LEATHER_DARK, LEATHER_LIGHT, t * 0.85)
                if row in (3, 7):
                    c = lerp_color(c, LEATHER_OUTLINE, 0.25)
                draw_pixel(draw, x, y, c)

    # Pauldrons
    for i in range(4):
        for j in range(3):
            c = lerp_color(PAULDRON_DARK, PAULDRON_LIGHT, j / 2)
            draw_pixel(draw, X + 5 + j, Y - 23 + i, c)
            draw_pixel(draw, X - 5 - j, Y - 23 + i, lerp_color(c, PAULDRON_DARK, 0.3))

    # Hood
    for row in range(3):
        y = Y - 28 - row
        hw = 5 - row
        for col in range(-hw, hw + 1):
            t = (col + hw) / (2 * hw)
            draw_pixel(draw, X + col, y, lerp_color(CLOAK_DARK, CLOAK_LIGHT, t))
        if row == 0:
            for col in range(-hw - 1, hw + 2):
                draw_pixel(draw, X + col, y, CLOAK_OUTLINE)
    draw_pixel(draw, X, Y - 31, CLOAK_DARK)

    # Face
    for row in range(6):
        y = Y - 26 + row
        for col in range(-3, 4):
            t = (col + 3) / 6
            if row < 2:
                c = lerp_color(HAIR_DARK, HAIR_LIGHT, t)
            else:
                c = lerp_color(SKIN_DARK, SKIN_LIGHT, t)
            draw_pixel(draw, X + col, y, c)
    draw_pixel(draw, X + 2, Y - 23, EYE)
    draw_aa(draw, X + 3, Y - 23, TEAL_DIM)
    for col in range(0, 3):
        draw_pixel(draw, X + col, Y - 20, SKIN_DARK)

    # Quiver
    for row in range(10):
        draw_pixel(draw, X - 4, Y - 26 + row, QUIVER_DARK)
        draw_pixel(draw, X - 5, Y - 26 + row, QUIVER_LIGHT)
    for i in range(3):
        draw_pixel(draw, X - 4 + i, Y - 28 - i, ARROW_TIP)
        draw_pixel(draw, X - 3 + i, Y - 27 - i, FLETCH)

    # Right arm
    ao = int(arm_swing)
    for i in range(8):
        draw_pixel(draw, X + 5, Y - 22 + i + ao, LEATHER_MID)
        draw_pixel(draw, X + 6, Y - 22 + i + ao, LEATHER_LIGHT)
        draw_pixel(draw, X + 7, Y - 22 + i + ao, LEATHER_OUTLINE)
    draw_pixel(draw, X + 6, Y - 14 + ao, SKIN_MID)
    draw_pixel(draw, X + 7, Y - 14 + ao, SKIN_LIGHT)

    # Bow
    bow_x = X + 8
    bow_cy = Y - 18 + ao
    for i in range(-8, 9):
        curve = int(math.sin((i + 8) / 16 * math.pi) * 4)
        c = lerp_color(BOW_DARK, BOW_LIGHT, (i + 8) / 16)
        draw_pixel(draw, bow_x + curve, bow_cy + i, c)
        if abs(i) < 6:
            draw_aa(draw, bow_x + curve + 1, bow_cy + i, BOW_MID)
    pull = int(bow_pull)
    for i in range(-7, 8):
        sx = bow_x - pull if abs(i) < 3 else bow_x
        draw_pixel(draw, sx, bow_cy + i, BOW_STRING)
    if bow_pull > 2:
        ax = bow_x - pull + 1
        for i in range(10):
            draw_pixel(draw, ax + i, bow_cy, ARROW_TIP if i > 7 else ARROW_SHAFT)
        draw_pixel(draw, ax - 1, bow_cy, FLETCH)
        draw_pixel(draw, ax - 1, bow_cy - 1, FLETCH)

    # Left arm
    for i in range(7):
        draw_pixel(draw, X - 4, Y - 21 + i - int(arm_swing * 0.3), LEATHER_DARK)
        draw_pixel(draw, X - 5, Y - 21 + i - int(arm_swing * 0.3), CLOAK_DARK)

    # Attack FX
    if anim == "attack1" and frame > 6:
        for i in range(6):
            ax = X + 14 + (frame - 6) * 5 + i
            if ax < W:
                draw_pixel(draw, ax, Y - 18, TEAL_BRIGHT if i < 2 else ARROW_SHAFT)
                draw_aa(draw, ax, Y - 19, TEAL_DIM)
    if anim == "attack3" and frame > 5:
        for a in range(3):
            angle = (a - 1) * 0.35
            for i in range(5):
                ax = X + 14 + (frame - 5) * 4 + i
                ay = Y - 18 + int(angle * i * 3.5)
                if 0 <= ax < W and 0 <= ay < H:
                    draw_pixel(draw, ax, ay, TEAL_MID)


img = Image.new("RGBA", (W, H), TRANSPARENT)
draw = ImageDraw.Draw(img)
anims = [
    ("idle", 8), ("walk", 8), ("walk", 8), ("walk", 8),
    ("attack1", 12), ("attack2", 10), ("attack3", 12),
    ("die", 8), ("hurt", 6), ("hurt", 6),
    ("idle", 8), ("idle", 8),
]
for ri, (anim, n) in enumerate(anims):
    foot_y = ri * 48 + 44
    for fi in range(min(n, 14)):
        draw_hunter(draw, fi * 48 + 24, foot_y, anim, fi)
img.save("public/assets/sprites/hunter_side_right.png")
print("Saved hunter_side_right.png 672x576 RGBA")

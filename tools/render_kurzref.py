#!/usr/bin/env python3
"""Rendert die eingescannte Kurzreferenz (Modul 2) zu PNG-Seiten,
damit Claude sie lesen/indizieren und die App sie verlinken kann."""
import os, sys, shutil

SRC = r"C:\Users\morit\OneDrive\Dokumente\Technikum\Technische Lösungen erweitern (Modul 2)\kurzreferenz.pdf"
BASE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(BASE, "kurzref")

try:
    import fitz  # PyMuPDF
except ImportError:
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", "pymupdf"])
    import fitz

# Kopie ins Projekt (fuer Server-Verlinkung)
shutil.copy2(SRC, os.path.join(BASE, "kurzreferenz.pdf"))

os.makedirs(OUT, exist_ok=True)
doc = fitz.open(SRC)
print("Seiten:", doc.page_count)
mat = fitz.Matrix(130 / 72, 130 / 72)  # ~130 DPI
for i, page in enumerate(doc, 1):
    pix = page.get_pixmap(matrix=mat)
    pix.save(os.path.join(OUT, f"p{i:03d}.png"))
print("gerendert nach:", OUT)

"""Convierte el modelo del terreno Copernicus GLO-90 en la cuadrícula de altitud de la app.

Uso: python3 -I scripts/dem_to_grid.py <carpeta_con_los_tif> public/data

Lee las 6 hojas de 1°×1° que cubren la Comunidad de Madrid y escribe:
  - altitud.bin: altitudes en metros (Int16, little-endian), por filas de
    norte a sur;
  - altitud.json: cabecera (esquina noroeste, paso, tamaño y fuente).

Cada celda es la media de 2×2 píxeles del original (≈ 141 m × 185 m).
"""

import glob
import json
import os
import sys

import numpy as np
import tifffile

# Extensión de la Comunidad de Madrid (con un poco de margen).
NORTH, SOUTH, WEST, EAST = 41.18, 39.87, -4.59, -3.04
BLOCK = 2  # píxeles por celda en cada dirección


def read_tile(path):
    """Devuelve (array, lat_norte, lon_oeste, paso_lat, paso_lon)."""
    with tifffile.TiffFile(path) as tif:
        page = tif.pages[0]
        data = page.asarray().astype(np.float32)
        tags = page.tags
        scale = tags["ModelPixelScaleTag"].value
        tie = tags["ModelTiepointTag"].value
        lon0, lat0 = tie[3], tie[4]
        return data, lat0, lon0, scale[1], scale[0]


def main(src_dir, out_dir):
    paths = sorted(glob.glob(os.path.join(src_dir, "Copernicus_DSM_COG_30_*_DEM.tif")))
    if len(paths) != 6:
        sys.exit(f"Se esperaban 6 hojas y hay {len(paths)} en {src_dir}")

    tiles = [read_tile(p) for p in paths]
    step_lat = tiles[0][3]
    step_lon = tiles[0][4]
    # Algunas hojas tienen distinto paso de longitud según la latitud: se
    # remuestrean todas al de la primera.
    north = max(t[1] for t in tiles)
    west = min(t[2] for t in tiles)
    south = min(t[1] - t[0].shape[0] * t[3] for t in tiles)
    east = max(t[2] + t[0].shape[1] * t[4] for t in tiles)
    rows = round((north - south) / step_lat)
    cols = round((east - west) / step_lon)
    mosaic = np.full((rows, cols), np.nan, dtype=np.float32)
    for data, lat0, lon0, slat, slon in tiles:
        r0 = round((north - lat0) / step_lat)
        c0 = round((lon0 - west) / step_lon)
        if abs(slon - step_lon) > 1e-12 or abs(slat - step_lat) > 1e-12:
            # Remuestreo por vecino más cercano al paso común.
            h = round(data.shape[0] * slat / step_lat)
            w = round(data.shape[1] * slon / step_lon)
            ri = (np.arange(h) * step_lat / slat).astype(int)
            ci = (np.arange(w) * step_lon / slon).astype(int)
            data = data[np.ix_(ri, ci)]
        mosaic[r0 : r0 + data.shape[0], c0 : c0 + data.shape[1]] = data

    # Recorte a la Comunidad.
    r_a = int((north - NORTH) / step_lat)
    r_b = int(np.ceil((north - SOUTH) / step_lat))
    c_a = int((WEST - west) / step_lon)
    c_b = int(np.ceil((EAST - west) / step_lon))
    r_b -= (r_b - r_a) % BLOCK
    c_b -= (c_b - c_a) % BLOCK
    crop = mosaic[r_a:r_b, c_a:c_b]
    if np.isnan(crop).any():
        sys.exit("Faltan datos dentro de la Comunidad")

    h, w = crop.shape[0] // BLOCK, crop.shape[1] // BLOCK
    grid = crop.reshape(h, BLOCK, w, BLOCK).mean(axis=(1, 3))
    grid = np.round(grid).astype("<i2")

    os.makedirs(out_dir, exist_ok=True)
    grid.tofile(os.path.join(out_dir, "altitud.bin"))
    header = {
        "north": north - r_a * step_lat,
        "west": west + c_a * step_lon,
        "dLat": step_lat * BLOCK,
        "dLon": step_lon * BLOCK,
        "width": int(w),
        "height": int(h),
        "min": int(grid.min()),
        "max": int(grid.max()),
        "source": "Copernicus DEM GLO-90 © DLR e.V. 2010-2014 y © Airbus Defence and Space GmbH 2014-2018, proporcionado en el marco de COPERNICUS por la Unión Europea y la ESA",
    }
    with open(os.path.join(out_dir, "altitud.json"), "w", encoding="utf-8") as f:
        json.dump(header, f, ensure_ascii=False, indent=2)
    print(json.dumps({k: v for k, v in header.items() if k != "source"}))
    print(f"{grid.nbytes / 1024:.0f} KB")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])

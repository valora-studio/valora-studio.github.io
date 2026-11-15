# Valora: сайт агентства (valora-studio.github.io)

Тёмное кино: ролики Flow (Veo / Omni) режутся на кадры и листаются прокруткой на canvas.
Страницы генерирует `build.py`, руками `*.html` не править.

```bash
PYTHONIOENCODING=utf-8 python build.py                 # страницы рядом
PYTHONIOENCODING=utf-8 python tools/shot.py 1440 900   # снимки главной (или: ... 500 900 | ... 1440 900 services)
PYTHONIOENCODING=utf-8 python tools/record.py          # ролик прокрутки в out/ (для показа)
CX=0.69 bash tools/make_frames.sh _raw/<clip>.mp4 <name> 96 56 0 6.2   # нарезка кадров; CX = центр мобильного кропа
```

- Реквизиты и контакты: `SITE` в начале `build.py`. Услуги: `SERVICES` (видео, контент, SMM и продажи связаны с курсами, состав без Андрея не менять).
- Сырые ролики лежат в `_raw/` (не в git), кадры в `frames/`: `hero`, `order` (шаги), `portal` (финал).
- В промптах Flow не писать «anamorphic»: вшиваются чёрные полосы. Нужно «full-bleed, no letterbox, pure #000».
- Старая версия сайта (обёртка) и картинки Кворка: `../_archive/site-wrapper-2026-11/` и история git.

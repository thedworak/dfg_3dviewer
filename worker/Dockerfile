# Standalone conversion worker: the repository's scripts/convert.py &
# scripts/render_thumbnails.py pipeline, wrapped by worker/server.py, on top of the base
# image with Blender, gltfpack and the system/Python dependencies
# (worker/Dockerfile.base). Only this layer is rebuilt when the code changes.
#
# "worker-base" is a named build context: docker-compose.yml builds the
# worker-base service first and passes its image in (additional_contexts).
# Building by hand, from the repo root:
#   docker build -f worker/Dockerfile.base -t dfg-3dviewer-worker-base worker
#   docker build -f worker/Dockerfile \
#     --build-context worker-base=docker-image://dfg-3dviewer-worker-base \
#     -t dfg-3dviewer-worker .
FROM worker-base

WORKDIR /app

# The Claude API SDK for the optional AI assistance (worker/ai.py, off unless
# WORKER_AI_ENABLED=true). A layer of its own, so the base image stays as is.
# brotli >= 1.2: the SDK's HTTP client decodes brotli answers with
# Decompressor.process(..., output_buffer_limit=), which Ubuntu's
# python3-brotli 1.1 (pulled in by matplotlib) rejects with a TypeError.
# --ignore-installed puts the new one in /usr/local, ahead of apt's copy.
RUN pip3 install --no-cache-dir --break-system-packages "anthropic>=1.15,<2" \
    && pip3 install --no-cache-dir --break-system-packages --ignore-installed "brotli>=1.2"

# Place search for the viewer's suggested scene (worker/geonames.py): a
# GeoNames dump (CC BY 4.0, https://www.geonames.org) and its index, built
# here so the worker starts with it. cities500: every place of 500 people or
# more (about 200 000); cities1000/5000/15000 are smaller, allCountries
# (1.5 GB) has castles and sites too. Empty: no place search. A failed
# download leaves it off instead of failing the build.
ARG GEONAMES_DATASET=cities500
RUN mkdir -p /app/geonames \
    && if [ -n "$GEONAMES_DATASET" ]; then \
         (curl -fsSL "https://download.geonames.org/export/dump/${GEONAMES_DATASET}.zip" -o /tmp/geonames.zip \
          && python3 -c "import shutil, sys, zipfile; shutil.copyfileobj(zipfile.ZipFile('/tmp/geonames.zip').open(sys.argv[1] + '.txt'), open('/app/geonames/places.txt', 'wb'))" "$GEONAMES_DATASET") \
         || echo "GeoNames download failed: place search stays off"; \
         rm -f /tmp/geonames.zip; \
       fi
COPY worker/geonames.py /app/worker/geonames.py
RUN if [ -f /app/geonames/places.txt ]; then python3 /app/worker/geonames.py build; fi

COPY scripts/ /app/scripts/
# scripts/.env (if present) carries absolute paths from whichever host last
# edited it - the worker configures SPATH/BLENDER_BIN via container ENV
# instead, so drop it to avoid shadowing that with stale local paths.
RUN rm -f /app/scripts/.env \
    && chmod +x /app/scripts/*.py /app/scripts/IfcConvert

# All worker modules (server.py imports auth and mailer); listing files one
# by one broke the image when mailer.py was added.
COPY worker/*.py /app/worker/

VOLUME ["/data/jobs"]
EXPOSE 8080

CMD ["python3", "/app/worker/server.py"]

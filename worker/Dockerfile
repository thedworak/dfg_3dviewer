# Standalone conversion worker: the repository's scripts/convert.sh &
# scripts/render.sh pipeline, wrapped by worker/server.py, on top of the base
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

COPY scripts/ /app/scripts/
# scripts/.env (if present) carries absolute paths from whichever host last
# edited it - the worker configures SPATH/BLENDER_BIN via container ENV
# instead, so drop it to avoid shadowing that with stale local paths.
RUN rm -f /app/scripts/.env \
    && chmod +x /app/scripts/*.sh /app/scripts/*.py /app/scripts/IfcConvert

# All worker modules (server.py imports auth and mailer); listing files one
# by one broke the image when mailer.py was added.
COPY worker/*.py /app/worker/

VOLUME ["/data/jobs"]
EXPOSE 8080

CMD ["python3", "/app/worker/server.py"]

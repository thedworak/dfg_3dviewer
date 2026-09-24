# Standalone conversion worker: the repository's scripts/convert.sh &
# scripts/render.sh pipeline, wrapped by worker/server.py, on top of the
# prebuilt base image with Blender, gltfpack and the system/Python
# dependencies (worker/Dockerfile.base). Only this layer is rebuilt when the
# code changes. Build context must be the repo root, e.g.:
#   docker build -f worker/Dockerfile -t dfg-3dviewer-worker .
#
# The base image is pulled from GHCR, or built locally when it cannot be -
# scripts/worker-base.sh ensure (run by scripts/docker.sh and the deploy
# workflow) takes care of that. Bump this tag whenever Dockerfile.base changes.
ARG WORKER_BASE_IMAGE=ghcr.io/thedworak/dfg-3dviewer-worker-base:1
FROM ${WORKER_BASE_IMAGE}

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

# Standalone conversion worker: Blender + Python + the existing
# scripts/convert.sh & scripts/render.sh pipeline, wrapped by worker/server.py.
# Build context must be the repo root, e.g.:
#   docker build -f worker/Dockerfile -t dfg-3dviewer-worker .

FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

# System package list mirrors the "Ubuntu way" instructions already
# documented at the top of scripts/convert.sh, minus the `blender` apt
# package itself: Ubuntu 24.04's build (tested: 4.0.2) turned out to be
# compiled without OpenImageDenoise, which scripts/render.py sets
# unconditionally (scene.cycles.denoiser = 'OPENIMAGEDENOISE') - that raised
# a TypeError before a single frame rendered. Using the official Blender
# release tarball below instead is exactly the "Debian way" alternative
# convert.sh's own comments already suggest. libgl1-mesa-dri/libegl1 give
# Blender's EEVEE engine a software (llvmpipe) OpenGL context to render with,
# since there's no GPU in the container (see LIBGL_ALWAYS_SOFTWARE below).
RUN apt-get update && apt-get install -y --no-install-recommends \
        curl \
        xz-utils \
        xvfb \
        python3 \
        python3-pip \
        python3-numpy \
        python3-lxml \
        python3-shapely \
        python3-matplotlib \
        libxi6 \
        libxrender1 \
        libxrandr2 \
        libxinerama1 \
        libxcursor1 \
        libxcomposite1 \
        libxdamage1 \
        libxtst6 \
        libglib2.0-0 \
        libsm6 \
        libice6 \
        libgl1 \
        libgl1-mesa-dri \
        libegl1 \
        libxkbcommon0 \
        libxxf86vm1 \
        mesa-utils \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN pip3 install --no-cache-dir --break-system-packages triangle

ARG BLENDER_SERIES=4.4
ARG BLENDER_VERSION=4.4.3
RUN curl -fsSL "https://download.blender.org/release/Blender${BLENDER_SERIES}/blender-${BLENDER_VERSION}-linux-x64.tar.xz" -o /tmp/blender.tar.xz \
    && mkdir -p /opt/blender \
    && tar -xJf /tmp/blender.tar.xz -C /opt/blender --strip-components=1 \
    && rm /tmp/blender.tar.xz \
    && ln -s /opt/blender/blender /usr/local/bin/blender

# Force Mesa's software rasterizer instead of probing for a (nonexistent)
# GPU device - without this, Blender's EEVEE either fails to get a GL
# context or hangs trying to find hardware acceleration that isn't there.
ENV LIBGL_ALWAYS_SOFTWARE=1
ENV GALLIUM_DRIVER=llvmpipe

WORKDIR /app

COPY scripts/ /app/scripts/
# scripts/.env (if present) carries absolute paths from whichever host last
# edited it - the worker configures SPATH/BLENDER_BIN via container ENV
# instead, so drop it to avoid shadowing that with stale local paths.
RUN rm -f /app/scripts/.env \
    && chmod +x /app/scripts/*.sh /app/scripts/IfcConvert

COPY worker/server.py /app/worker/server.py

ENV SPATH=/app
ENV BLENDER_BIN=blender
ENV WORKER_JOBS_DIR=/data/jobs
ENV WORKER_PORT=8080
# Same defaults scripts/.env.example documents - render.sh falls back to
# these itself when unset, but setting them explicitly here is one less
# thing to go wrong now that scripts/.env doesn't ship in this image.
ENV RENDER_RESOLUTION=1024x1024x16
ENV RENDER_SAMPLES=20

VOLUME ["/data/jobs"]
EXPOSE 8080

CMD ["python3", "/app/worker/server.py"]

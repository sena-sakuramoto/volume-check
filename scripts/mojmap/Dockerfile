# ---- Stage 1: build mojxml-rs ----
FROM rust:1.83-slim-bookworm AS mojxml-build
RUN apt-get update && apt-get install -y --no-install-recommends \
        git ca-certificates pkg-config libssl-dev \
    && rm -rf /var/lib/apt/lists/*
RUN git clone --depth=1 https://github.com/KotobaMedia/mojxml-rs.git /src
WORKDIR /src
RUN cargo build --release && cp target/release/mojxml-rs /mojxml-rs

# ---- Stage 2: build tippecanoe ----
FROM debian:bookworm-slim AS tippecanoe-build
RUN apt-get update && apt-get install -y --no-install-recommends \
        git ca-certificates build-essential libsqlite3-dev zlib1g-dev \
    && rm -rf /var/lib/apt/lists/*
RUN git clone --depth=1 https://github.com/felt/tippecanoe.git /src
WORKDIR /src
RUN make -j"$(nproc)" && make install PREFIX=/opt/tippecanoe

# ---- Stage 3: runtime ----
FROM node:20-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates tini libsqlite3-0 zlib1g \
    && rm -rf /var/lib/apt/lists/*

COPY --from=mojxml-build /mojxml-rs /usr/local/bin/mojxml-rs
COPY --from=tippecanoe-build /opt/tippecanoe/bin/tippecanoe /usr/local/bin/tippecanoe
COPY --from=tippecanoe-build /opt/tippecanoe/bin/tippecanoe-decode /usr/local/bin/tippecanoe-decode
COPY --from=tippecanoe-build /opt/tippecanoe/bin/tile-join /usr/local/bin/tile-join

ENV PNPM_HOME=/pnpm-home
ENV PATH=/pnpm-home:$PATH
RUN corepack enable && corepack prepare pnpm@10.25.0 --activate

WORKDIR /app
COPY package.json tsconfig.json ./
COPY src ./src
COPY phase1_municipalities.json crs_map.json ./
RUN pnpm install --prod=false --frozen-lockfile=false

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["pnpm", "run", "daily"]

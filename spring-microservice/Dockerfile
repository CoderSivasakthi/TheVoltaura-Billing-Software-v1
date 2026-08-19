# ─────────────────────────────────────────────
# Stage 1: Build the Spring Boot fat-JAR
# ─────────────────────────────────────────────
FROM maven:3.9-eclipse-temurin-17 AS builder

WORKDIR /build

# Copy Maven descriptor first (layer caching)
COPY pom.xml ./

# Download dependencies before copying source
RUN mvn dependency:go-offline -B

# Copy source code and build, skipping tests
COPY src ./src
RUN mvn package -DskipTests -B

# ─────────────────────────────────────────────
# Stage 2: Minimal JRE runtime
# ─────────────────────────────────────────────
FROM amazoncorretto:17-alpine

RUN apk add --no-cache dumb-init wget

WORKDIR /app

COPY --from=builder /build/target/spring-microservice-0.1.0.jar app.jar
COPY docker-entrypoint.sh /app/docker-entrypoint.sh

RUN addgroup -S spring && adduser -S spring -G spring \
    && chmod +x /app/docker-entrypoint.sh \
    && chown spring:spring /app/app.jar /app/docker-entrypoint.sh
USER spring

EXPOSE 8081

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=5 \
  CMD wget -qO- http://127.0.0.1:8081/spring/health || exit 1

ENTRYPOINT ["dumb-init", "--", "/app/docker-entrypoint.sh"]

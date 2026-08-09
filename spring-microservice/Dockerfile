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

# Install curl for health checks
RUN apk add --no-cache dumb-init

WORKDIR /app

# Copy JAR from build stage
COPY --from=builder /build/target/spring-microservice-0.1.0.jar app.jar

# Create and use non-root user
RUN addgroup -S spring && adduser -S spring -G spring
RUN chown spring:spring /app/app.jar
USER spring

EXPOSE 8081

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=5 \
  CMD wget -qO- http://localhost:8081/spring/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["java", \
     "-Djava.security.egd=file:/dev/./urandom", \
     "-Dspring.profiles.active=${SPRING_PROFILES_ACTIVE:-docker}", \
     "-jar", "app.jar"]

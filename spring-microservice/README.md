# Spring Microservice (Customers)

Lightweight Spring Boot microservice providing CRUD for `customers` table.

Usage:

1. Build:
```
cd spring-microservice
mvn -DskipTests package
```

2. Run (environment variables):
```
JDBC_DATABASE_URL=jdbc:postgresql://host:5432/postgres?user=postgres&password=pass \
  java -jar target/spring-microservice-0.1.0.jar
```

Notes:
- Service exposes REST at `/api/customers` on port `8081`.
- `application.properties` reads `JDBC_DATABASE_URL` or `DATABASE_URL` env var.

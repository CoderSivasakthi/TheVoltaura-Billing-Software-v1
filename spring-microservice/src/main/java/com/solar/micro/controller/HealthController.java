package com.solar.micro.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Lightweight health-check endpoint for Docker and load-balancer probes.
 * Accessible at: GET /spring/health
 * Returns: { "status": "UP", "service": "spring-service" }
 */
@RestController
@RequestMapping("/spring")
public class HealthController {

    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        Map<String, String> body = new LinkedHashMap<>();
        body.put("status", "UP");
        body.put("service", "spring-service");
        return ResponseEntity.ok(body);
    }
}

package com.solar.micro.controller;

import com.solar.micro.model.AmcContract;
import com.solar.micro.service.AmcService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/amc")
public class AmcController {
    private final AmcService service;
    
    public AmcController(AmcService service) { this.service = service; }

    @GetMapping
    public List<AmcContract> list(@RequestParam(required = false) String status,
                                   @RequestParam(required = false) String vendorName) {
        if (status != null) return service.byStatus(status);
        if (vendorName != null) return service.byVendor(vendorName);
        return service.list();
    }

    @GetMapping("/{id}")
    public ResponseEntity<AmcContract> get(@PathVariable String id) {
        return service.find(id).map(ResponseEntity::ok).orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<AmcContract> create(@RequestBody AmcContract a) {
        AmcContract saved = service.create(a);
        return ResponseEntity.created(URI.create("/api/amc/" + saved.getId())).body(saved);
    }

    @PutMapping("/{id}")
    public ResponseEntity<AmcContract> update(@PathVariable String id, @RequestBody AmcContract a) {
        return ResponseEntity.ok(service.update(id, a));
    }

    @PostMapping("/{id}/renew")
    public ResponseEntity<AmcContract> renew(@PathVariable String id) {
        return ResponseEntity.ok(service.renew(id));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable String id) {
        service.delete(id);
        return ResponseEntity.ok().build();
    }
}

package com.solar.micro.controller;

import com.solar.micro.model.Invoice;
import com.solar.micro.service.InvoiceService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/invoices")
public class InvoiceController {
    private final InvoiceService service;
    public InvoiceController(InvoiceService service) { this.service = service; }

    @GetMapping
    public List<Invoice> list(@RequestParam(required = false) String status,
                               @RequestParam(required = false) String customerId) {
        if (status != null) return service.byStatus(status);
        if (customerId != null) return service.byCustomer(customerId);
        return service.list();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Invoice> get(@PathVariable String id) {
        return service.find(id).map(ResponseEntity::ok).orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<Invoice> create(@RequestBody Invoice inv) {
        Invoice saved = service.create(inv);
        return ResponseEntity.created(URI.create("/api/invoices/" + saved.getId())).body(saved);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Invoice> update(@PathVariable String id, @RequestBody Invoice inv) {
        return ResponseEntity.ok(service.update(id, inv));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable String id) {
        service.delete(id);
        return ResponseEntity.ok().build();
    }
}

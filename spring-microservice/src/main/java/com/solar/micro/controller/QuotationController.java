package com.solar.micro.controller;

import com.solar.micro.model.Quotation;
import com.solar.micro.service.QuotationService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/quotations")
public class QuotationController {
    private final QuotationService service;
    public QuotationController(QuotationService service) { this.service = service; }

    @GetMapping
    public List<Quotation> list() { return service.list(); }

    @GetMapping("/{id}")
    public ResponseEntity<Quotation> get(@PathVariable String id) {
        return service.find(id).map(ResponseEntity::ok).orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<Quotation> create(@RequestBody Quotation q) {
        Quotation saved = service.create(q);
        return ResponseEntity.created(URI.create("/api/quotations/" + saved.getId())).body(saved);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Quotation> update(@PathVariable String id, @RequestBody Quotation q) {
        return ResponseEntity.ok(service.update(id, q));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable String id) {
        service.delete(id);
        return ResponseEntity.ok().build();
    }

    /** Convert quotation → invoice (marks status = Converted) */
    @PostMapping("/{id}/convert")
    public ResponseEntity<Quotation> convert(@PathVariable String id) {
        return service.convert(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}

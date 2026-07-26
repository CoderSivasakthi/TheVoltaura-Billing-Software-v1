package com.solar.micro.service;

import com.solar.micro.model.Invoice;
import com.solar.micro.repo.InvoiceRepository;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.Optional;

@Service
public class InvoiceService {
    private final InvoiceRepository repo;
    public InvoiceService(InvoiceRepository repo) { this.repo = repo; }

    public List<Invoice> list() { return repo.findAll(); }
    public Optional<Invoice> find(String id) { return repo.findById(id); }
    public Invoice create(Invoice inv) { return repo.save(inv); }
    public Invoice update(String id, Invoice inv) { inv.setId(id); return repo.save(inv); }
    public void delete(String id) { repo.deleteById(id); }
    public List<Invoice> byCustomer(String customerId) { return repo.findByCustomerId(customerId); }
    public List<Invoice> byStatus(String status) { return repo.findByStatus(status); }
}

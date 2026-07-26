package com.solar.micro.service;

import com.solar.micro.model.Quotation;
import com.solar.micro.repo.QuotationRepository;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.Optional;

@Service
public class QuotationService {
    private final QuotationRepository repo;
    public QuotationService(QuotationRepository repo) { this.repo = repo; }

    public List<Quotation> list() { return repo.findAll(); }
    public Optional<Quotation> find(String id) { return repo.findById(id); }
    public Quotation create(Quotation q) { return repo.save(q); }
    public Quotation update(String id, Quotation q) { q.setId(id); return repo.save(q); }
    public void delete(String id) { repo.deleteById(id); }
    public List<Quotation> byCustomer(String customerId) { return repo.findByCustomerId(customerId); }

    /** Convert quotation to Converted status */
    public Optional<Quotation> convert(String id) {
        return repo.findById(id).map(q -> {
            q.setStatus("Converted");
            return repo.save(q);
        });
    }
}

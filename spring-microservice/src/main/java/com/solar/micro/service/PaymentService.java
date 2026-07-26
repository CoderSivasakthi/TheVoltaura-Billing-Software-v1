package com.solar.micro.service;

import com.solar.micro.model.Payment;
import com.solar.micro.repo.PaymentRepository;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.Optional;

@Service
public class PaymentService {
    private final PaymentRepository repo;
    public PaymentService(PaymentRepository repo) { this.repo = repo; }

    public List<Payment> list() { return repo.findAll(); }
    public Optional<Payment> find(String id) { return repo.findById(id); }
    public Payment create(Payment p) { return repo.save(p); }
    public void delete(String id) { repo.deleteById(id); }
    public List<Payment> byInvoice(String invoiceId) { return repo.findByInvoiceId(invoiceId); }
}

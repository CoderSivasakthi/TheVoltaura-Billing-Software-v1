package com.solar.micro.repo;

import com.solar.micro.model.Invoice;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface InvoiceRepository extends JpaRepository<Invoice, String> {
    List<Invoice> findByCustomerId(String customerId);
    List<Invoice> findByStatus(String status);
}

package com.solar.micro.repo;

import com.solar.micro.model.Payment;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface PaymentRepository extends JpaRepository<Payment, String> {
    List<Payment> findByInvoiceId(String invoiceId);
    List<Payment> findByCustomerId(String customerId);
}

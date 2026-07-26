package com.solar.micro.repo;

import com.solar.micro.model.Quotation;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface QuotationRepository extends JpaRepository<Quotation, String> {
    List<Quotation> findByCustomerId(String customerId);
    List<Quotation> findByStatus(String status);
}

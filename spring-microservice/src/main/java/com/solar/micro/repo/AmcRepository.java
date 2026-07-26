package com.solar.micro.repo;

import com.solar.micro.model.AmcContract;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;

public interface AmcRepository extends JpaRepository<AmcContract, String> {
    List<AmcContract> findByVendorName(String vendorName);
    List<AmcContract> findByStatus(String status);
    List<AmcContract> findByAmcExpiryDateBetween(LocalDate start, LocalDate end);
}

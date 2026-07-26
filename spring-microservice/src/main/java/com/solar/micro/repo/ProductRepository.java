package com.solar.micro.repo;

import com.solar.micro.model.Product;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ProductRepository extends JpaRepository<Product, String> {
    List<Product> findByStatus(String status);
    List<Product> findByStockLessThan(int threshold);
    java.util.Optional<Product> findFirstByName(String name);
}

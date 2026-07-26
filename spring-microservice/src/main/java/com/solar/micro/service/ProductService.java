package com.solar.micro.service;

import com.solar.micro.model.Product;
import com.solar.micro.repo.ProductRepository;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.Optional;

@Service
public class ProductService {
    private final ProductRepository repo;
    public ProductService(ProductRepository repo) { this.repo = repo; }

    public List<Product> list() { return repo.findAll(); }
    public Optional<Product> find(String id) { return repo.findById(id); }
    public Product create(Product p) { return repo.save(p); }
    public Product update(String id, Product p) { p.setId(id); return repo.save(p); }
    public void delete(String id) { repo.deleteById(id); }
    public List<Product> lowStock(int threshold) { return repo.findByStockLessThan(threshold); }
}

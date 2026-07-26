package com.solar.micro.service;

import com.solar.micro.model.Customer;
import com.solar.micro.repo.CustomerRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class CustomerService {
    private final CustomerRepository repo;

    public CustomerService(CustomerRepository repo) {
        this.repo = repo;
    }

    public List<Customer> list() { return repo.findAll(); }
    public Optional<Customer> find(String id) { return repo.findById(id); }
    public Customer create(Customer c) { return repo.save(c); }
    public Customer update(String id, Customer upd) { upd.setId(id); return repo.save(upd); }
    public void delete(String id) { repo.deleteById(id); }
}

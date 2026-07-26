package com.solar.micro.service;

import com.solar.micro.model.AmcContract;
import com.solar.micro.model.AmcEquipment;
import com.solar.micro.model.Product;
import com.solar.micro.repo.AmcRepository;
import com.solar.micro.repo.ProductRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class AmcService {
    private final AmcRepository repo;
    private final ProductRepository productRepo;
    
    public AmcService(AmcRepository repo, ProductRepository productRepo) { 
        this.repo = repo; 
        this.productRepo = productRepo;
    }

    public List<AmcContract> list() { return repo.findAll(); }
    
    public Optional<AmcContract> find(String id) { return repo.findById(id); }

    private void syncEquipmentToInventory(AmcContract a) {
        if (a.getEquipment() != null) {
            for (AmcEquipment eq : a.getEquipment()) {
                if (eq.getEquipmentName() == null || eq.getEquipmentName().isBlank()) continue;
                
                Product p = productRepo.findFirstByName(eq.getEquipmentName()).orElse(new Product());
                if (p.getId() == null) {
                    p.setName(eq.getEquipmentName());
                    p.setCategory(eq.getEquipmentType());
                    p.setDescription(eq.getSpecification());
                    p.setStatus("Active");
                    p.setStock(0);
                    p.setGstRate(java.math.BigDecimal.valueOf(18));
                }
                
                int qty = eq.getQuantity() != null ? eq.getQuantity() : 1;
                p.setStock(p.getStock() + qty);
                productRepo.save(p);
            }
        }
    }
    
    public AmcContract create(AmcContract a) { 
        if (a.getEquipment() != null) {
            a.getEquipment().forEach(e -> e.setAmcContract(a));
        }
        AmcContract saved = repo.save(a); 
        syncEquipmentToInventory(saved);
        return saved;
    }
    
    public AmcContract update(String id, AmcContract a) { 
        a.setId(id); 
        if (a.getEquipment() != null) {
            a.getEquipment().forEach(e -> e.setAmcContract(a));
        }
        AmcContract saved = repo.save(a); 
        syncEquipmentToInventory(saved);
        return saved;
    }
    
    public void delete(String id) { repo.deleteById(id); }
    
    public List<AmcContract> byVendor(String vendorName) { return repo.findByVendorName(vendorName); }
    
    public List<AmcContract> byStatus(String status) { return repo.findByStatus(status); }

    public AmcContract renew(String oldId) {
        AmcContract old = repo.findById(oldId).orElseThrow(() -> new RuntimeException("AMC not found"));
        
        AmcContract next = new AmcContract();
        next.setId("AMC-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        next.setVendorName(old.getVendorName());
        next.setVendorContact(old.getVendorContact());
        next.setCompanyName(old.getCompanyName());
        next.setVendorEmail(old.getVendorEmail());
        next.setVendorAddress(old.getVendorAddress());
        next.setSystemCapacity(old.getSystemCapacity());
        next.setInstallationLocation(old.getInstallationLocation());
        next.setInstallationDate(old.getInstallationDate());
        
        next.setMaintenanceScope(old.getMaintenanceScope());
        next.setReplacementCoverage(old.getReplacementCoverage());
        next.setServiceVisitFrequency(old.getServiceVisitFrequency());
        next.setSparePartsCovered(old.getSparePartsCovered());
        next.setLabourIncluded(old.getLabourIncluded());
        next.setNotes(old.getNotes());
        
        next.setAmcContractValue(old.getAmcContractValue());
        next.setGst(old.getGst());
        next.setTotalContractValue(old.getTotalContractValue());
        next.setPaymentTerms(old.getPaymentTerms());
        
        next.setStatus("Draft");

        if (old.getEquipment() != null) {
            for (AmcEquipment oe : old.getEquipment()) {
                AmcEquipment ne = new AmcEquipment();
                ne.setEquipmentType(oe.getEquipmentType());
                ne.setEquipmentName(oe.getEquipmentName());
                ne.setSpecification(oe.getSpecification());
                next.addEquipment(ne);
            }
        }
        
        return repo.save(next);
    }
}

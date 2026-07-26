package com.solar.micro.model;

import com.fasterxml.jackson.annotation.JsonManagedReference;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "amc_contracts")
@Getter @Setter @NoArgsConstructor
public class AmcContract {

    @Id
    @Column(length = 36)
    private String id; // amc_id (e.g., AMC-001)

    @Column(name = "vendor_name", length = 150)
    private String vendorName;

    @Column(name = "vendor_contact", length = 50)
    private String vendorContact;

    @Column(name = "company_name", length = 150)
    private String companyName;

    @Column(name = "vendor_email", length = 100)
    private String vendorEmail;

    @Column(name = "vendor_address", length = 500)
    private String vendorAddress;

    @Column(name = "system_capacity", length = 50)
    private String systemCapacity;

    @Column(name = "installation_location", length = 200)
    private String installationLocation;

    @Column(name = "installation_date")
    private LocalDate installationDate;

    // Dates
    @Column(name = "contract_start_date")
    private LocalDate contractStartDate;

    @Column(name = "amc_start_date")
    private LocalDate amcStartDate;

    @Column(name = "contract_end_date")
    private LocalDate contractEndDate;

    @Column(name = "amc_expiry_date")
    private LocalDate amcExpiryDate;

    @Column(name = "agreement_date")
    private LocalDate agreementDate;

    @Column(length = 20)
    private String status;

    // Scope & Coverage
    @Column(name = "maintenance_scope", columnDefinition = "TEXT")
    private String maintenanceScope;

    @Column(name = "replacement_coverage")
    private Boolean replacementCoverage = false;

    @Column(name = "service_visit_frequency", length = 50)
    private String serviceVisitFrequency;

    @Column(name = "spare_parts_covered")
    private Boolean sparePartsCovered = false;

    @Column(name = "labour_included")
    private Boolean labourIncluded = false;

    @Column(columnDefinition = "TEXT")
    private String notes;

    // Financial
    @Column(name = "amc_contract_value", precision = 12, scale = 2)
    private BigDecimal amcContractValue;

    @Column(precision = 10, scale = 2)
    private BigDecimal gst;

    @Column(name = "total_contract_value", precision = 12, scale = 2)
    private BigDecimal totalContractValue;

    @Column(name = "payment_terms", length = 200)
    private String paymentTerms;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @OneToMany(mappedBy = "amcContract", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    @JsonManagedReference
    private List<AmcEquipment> equipment = new ArrayList<>();

    public void addEquipment(AmcEquipment e) {
        equipment.add(e);
        e.setAmcContract(this);
    }

    public void removeEquipment(AmcEquipment e) {
        equipment.remove(e);
        e.setAmcContract(null);
    }

    @PrePersist
    public void prePersist() {
        if (id == null || id.isBlank()) id = "AMC-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        if (status == null) status = "Active";
    }
}
